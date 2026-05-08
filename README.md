# colab-sandbox-mcp

MCP server that gives agents (Claude Code, opencode) a full Linux shell via your Google Colab runtime, tunnelled through [webterm](https://github.com/unn-Known1/webterm) + Cloudflare.

## How it works

```
Colab runtime
  └─ webterm (node server.js)
  └─ cloudflared → https://xyz.trycloudflare.com
                          │  HTTP  POST /api/exec
                          │  HTTP  GET  /api/files/...
                    MCP server (this repo, runs locally)
                          │  stdio
                    Claude Code / opencode
```

---

## 1. Start webterm in Colab

Paste this cell and run it:

```python
%%bash
git clone https://github.com/unn-Known1/webterm /tmp/webterm 2>/dev/null || true
cd /tmp/webterm
npm install --silent
node server.js &
sleep 2
cloudflared tunnel --url http://localhost:3000 2>&1 | grep -o 'https://.*trycloudflare.com'
```

Copy the printed `https://....trycloudflare.com` URL.

---

## 2. Install and build this MCP server

```bash
git clone https://github.com/unn-Known1/colab-sandbox-mcp
cd colab-sandbox-mcp
npm install
npm run build
```

---

## 3. Configure your client

### Claude Code (`~/.claude/claude_desktop_config.json` or via `claude mcp add`)

```json
{
  "mcpServers": {
    "colab-sandbox": {
      "command": "node",
      "args": ["/absolute/path/to/colab-sandbox-mcp/dist/index.js"]
    }
  }
}
```

Or with `claude mcp add`:
```bash
claude mcp add colab-sandbox node /absolute/path/to/colab-sandbox-mcp/dist/index.js
```

### opencode (`~/.config/opencode/config.json`)

```json
{
  "mcp": {
    "colab-sandbox": {
      "command": ["node", "/absolute/path/to/colab-sandbox-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

---

## 4. Use it

In your agent session, the first message should connect:

```
Use the colab-sandbox MCP. Connect to https://xyz.trycloudflare.com
```

Then the agent can call:

| Tool | What it does |
|------|-------------|
| `connect(url, pin?)` | Point MCP at the tunnel URL |
| `status()` | Verify session is alive |
| `run(command, cwd?, timeout_ms?)` | Execute any shell command |
| `read_file(path)` | Read a file |
| `write_file(path, content)` | Write a file |
| `list_files(path?)` | List a directory |

---

## Tips

- Colab sessions die after ~12h or on disconnect. Re-run the cell and `connect()` with the new URL.
- For GPU-heavy tasks, set `timeout_ms` to something large: `run("python train.py", timeout_ms=3600000)`
- If you set a PIN in webterm's `.env`, pass it to `connect(url, pin)`.
- Tunnel URL changes every Colab restart — the only thing you need to update is the `connect()` call.
