# 🤖 Colab-Sandbox-MCP — AI Agent Linux Shell via Google Colab

Give any AI agent a full Linux shell — running on a free Google Colab GPU, tunneled to your browser with a persistent MCP server.

![MCP](https://img.shields.io/badge/MCP-Server-FF6B6B?style=for-the-badge)
![Colab](https://img.shields.io/badge/Google-Colab-F9AB00?style=for-the-badge)
![Linux](https://img.shields.io/badge/Linux-Shell-blue?style=for-the-badge)

## ✨ Features

- **🐧 Full Linux shell** — apt, git, python, node — everything works
- **🆓 Free GPU** — runs on Google's Colab runtime (T4 GPU included)
- **🌐 Browser-accessible** — webterm UI, no SSH client needed
- **🤖 AI-agent native** — MCP protocol, works with Claude, Cursor, and any MCP-compatible agent
- **🔒 Isolated** — your local machine stays clean, all work happens in Colab
- **⚡ Persistent** — Colab stays alive while the tab is open

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/unn-known1/colab-sandbox-mcp.git
cd colab-sandbox-mcp

# Open run.ipynb in Google Colab and run all cells
# Copy the MCP server URL it gives you

# In your AI agent, add to MCP config:
{
  "mcpServers": {
    "colab-sandbox": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-http", "YOUR_COLAB_SERVER_URL"]
    }
  }
}
```

## 🏗️ Architecture

```
Your AI Agent → MCP Client → Google Colab (MCP Server)
                               ↓
                         Webterm (browser)
                               ↓
                         Linux Shell + T4 GPU
```

## 💡 Use Cases

- Give Claude/Cursor a sandboxed Linux environment for heavy tasks
- Run GPU-accelerated code without your local machine
- Test AI agent tool usage in an isolated environment
- Persistent development environment that doesn't drain your laptop battery

## ⚙️ Requirements

- Google account (free)
- Google Colab (free tier works, Pro recommended for longer sessions)

## ⭐ If this helped you, star the repo!

MIT License — built with 💻 by [Gaurang Patel](https://github.com/unn-known1)