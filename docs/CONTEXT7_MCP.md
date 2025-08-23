Context7 MCP Integration

Overview
- Context7 provides up-to-date, version-specific docs/examples to LLMs via the Model Context Protocol (MCP).
- Package: `@upstash/context7-mcp` (runs as a local MCP server via `npx`).

What’s included in this repo
- NPM script: `npm run mcp:context7` and `npm run mcp:context7:auth`.
- Cursor project config: `.cursor/mcp.json` (local stdio server using `npx`).
- Claude sample config: `.claude/context7.mcp.sample.json`.
- Env placeholder: `CONTEXT7_API_KEY` added to `.env.example`.

Quick start
1) Get an API key: https://context7.com/dashboard
2) Set `CONTEXT7_API_KEY` in your environment (optional but recommended):
   - macOS/Linux: `export CONTEXT7_API_KEY=...`
   - Windows (Powershell): `$Env:CONTEXT7_API_KEY = "..."`
3) Run locally (stdio):
   - `npm run mcp:context7:auth` (uses `$CONTEXT7_API_KEY`)

Editor setup
- Cursor (project-level): `.cursor/mcp.json` is created and points to a local server via `npx`. Replace `YOUR_API_KEY` or run with the `:auth` script.
- Cursor (remote server alt): use
  {
    "mcpServers": {
      "context7": {
        "url": "https://mcp.context7.com/mcp",
        "headers": { "CONTEXT7_API_KEY": "YOUR_API_KEY" }
      }
    }
  }
- Claude Code (local): copy `.claude/context7.mcp.sample.json` into your Claude config (per Claude docs) and replace `YOUR_API_KEY` or run via CLI:
  `claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY`
- VS Code (Copilot MCP, local):
  "mcp": { "servers": { "context7": { "type": "stdio", "command": "npx", "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"] } } }

Notes
- Using the remote server (`https://mcp.context7.com/mcp`) avoids local installs; add the `CONTEXT7_API_KEY` header.
- For local `npx` usage, no permanent install is required; the provided npm scripts are convenient wrappers.
- Do not commit real API keys. Keep `.env` local and untracked.

