import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

// ── State ─────────────────────────────────────────────────────────────
const state = { url: '', pin: '' };

function base() { return state.url.replace(/\/$/, ''); }

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (state.pin) h['x-pin-token'] = state.pin;
  return h;
}

function tokenParam() { return state.pin ? `&token=${encodeURIComponent(state.pin)}` : ''; }

// ── Helpers ───────────────────────────────────────────────────────────
interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  error?: string;
}

async function execCommand(command: string, cwd?: string, timeout = 120_000): Promise<ExecResult> {
  const res = await fetch(`${base()}/api/exec`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ command, cwd, timeout }),
    signal: AbortSignal.timeout(timeout + 8_000), // a bit more than server timeout
  });
  return res.json() as Promise<ExecResult>;
}

function formatExec(r: ExecResult): string {
  const parts: string[] = [];
  if (r.stdout) parts.push(`stdout:\n${r.stdout.trimEnd()}`);
  if (r.stderr) parts.push(`stderr:\n${r.stderr.trimEnd()}`);
  parts.push(`exit_code: ${r.exitCode} (${r.duration}ms)`);
  return parts.join('\n\n');
}

// ── Tool definitions ──────────────────────────────────────────────────
const TOOLS: Tool[] = [
  {
    name: 'connect',
    description:
      'Set the Colab webterm tunnel URL for this session. Call this first before any other tool. ' +
      'The URL is the cloudflared HTTPS URL printed in the Colab cell output.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Tunnel URL, e.g. https://abc-def-123.trycloudflare.com',
        },
        pin: {
          type: 'string',
          description: 'PIN if you set one in webterm (.env PIN=...)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'status',
    description: 'Check whether the Colab session is reachable. Returns hostname and platform info.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'run',
    description:
      'Run a shell command in the Colab Linux environment. ' +
      'Returns stdout, stderr, and exit code. ' +
      'Supports long-running commands — increase timeout_ms for things like pip install or model training.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Bash command to run' },
        cwd: { type: 'string', description: 'Working directory (default: home)' },
        timeout_ms: {
          type: 'number',
          description: 'Max wait in milliseconds (default: 120000 = 2 min)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file from the Colab filesystem.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to file' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write (or overwrite) a text file in the Colab filesystem.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to file' },
        content: { type: 'string', description: 'File contents' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories at a given path in Colab.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Directory path (default: home)' } },
    },
  },
];

// ── Server ────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'colab-sandbox', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  // connect — no active session needed
  if (name === 'connect') {
    state.url = String(a.url ?? '');
    state.pin = String(a.pin ?? '');
    return { content: [{ type: 'text', text: `Connected → ${state.url}${state.pin ? ' (PIN set)' : ''}` }] };
  }

  // all other tools require an active session
  if (!state.url) {
    return {
      content: [{ type: 'text', text: 'Not connected. Call connect(url) first.' }],
      isError: true,
    };
  }

  try {
    // ── status ───────────────────────────────────────────────────
    if (name === 'status') {
      const res = await fetch(`${base()}/api/home`, {
        headers: headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { content: [{ type: 'text', text: `HTTP ${res.status}` }], isError: true };
      const data = (await res.json()) as Record<string, string>;
      return {
        content: [{
          type: 'text',
          text: `✓ reachable\nhostname: ${data.hostname}\nplatform: ${data.platform}\nhome: ${data.home}`,
        }],
      };
    }

    // ── run ──────────────────────────────────────────────────────
    if (name === 'run') {
      const result = await execCommand(
        String(a.command),
        a.cwd ? String(a.cwd) : undefined,
        a.timeout_ms ? Number(a.timeout_ms) : undefined,
      );
      if (result.error) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }
      return {
        content: [{ type: 'text', text: formatExec(result) }],
        isError: result.exitCode !== 0,
      };
    }

    // ── read_file ────────────────────────────────────────────────
    if (name === 'read_file') {
      const res = await fetch(
        `${base()}/api/files/read?path=${encodeURIComponent(String(a.path))}${tokenParam()}`,
        { headers: headers() },
      );
      const data = (await res.json()) as { content?: string; error?: string };
      if (data.error) return { content: [{ type: 'text', text: data.error }], isError: true };
      return { content: [{ type: 'text', text: data.content ?? '' }] };
    }

    // ── write_file ───────────────────────────────────────────────
    if (name === 'write_file') {
      const res = await fetch(`${base()}/api/files/write`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ path: a.path, content: a.content }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.error) return { content: [{ type: 'text', text: data.error }], isError: true };
      return { content: [{ type: 'text', text: `Written: ${String(a.path)}` }] };
    }

    // ── list_files ───────────────────────────────────────────────
    if (name === 'list_files') {
      const pathParam = a.path ? `path=${encodeURIComponent(String(a.path))}&` : '';
      const res = await fetch(
        `${base()}/api/files?${pathParam}${tokenParam().slice(1)}`,
        { headers: headers() },
      );
      const data = (await res.json()) as {
        path?: string;
        files?: Array<{ name: string; isDir: boolean; size: number }>;
        error?: string;
      };
      if (data.error) return { content: [{ type: 'text', text: data.error }], isError: true };
      const listing = (data.files ?? [])
        .map(f => `${f.isDir ? 'd' : '-'}  ${f.name}${f.isDir ? '/' : `  (${f.size}b)`}`)
        .join('\n');
      return { content: [{ type: 'text', text: `${data.path}:\n${listing}` }] };
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Request failed: ${msg}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);