---
name: pmll
description: Persistent spatial memory for AI agents (off-chain today; Stellar commitment anchoring planned). Use when working with PMLL, pmll-memory-mcp, agent memory layers, Context+, PPM context stitching, or on-chain memory commitments via Soroban.
---

# PMLL

Gives AI agents persistent spatial memory so they can retain long-term context, form symbiotic memory layers, and maintain durable state across sessions.

PMLL provides durable, structured memory primitives useful for agentic workflows. It supports the PPM project, Context+ pipelines, and supermodeltools/cli for analysis and visualization. **On-chain commitment anchoring on Stellar (storing 32-byte hashes of off-chain memory via a Soroban contract) is planned.**

## Highlights

- Persistent, addressable spatial memory (off-chain today).
- PPM-based context stitching and MCP tools for memory ingestion and retrieval.
- Integration with forloopcodes/contextplus for hierarchical indexing and supermodeltools/cli for graphing and analysis.
- Planned: atomic Soroban `pmll-anchor` contract that stores only a 32-byte commitment + emits events (full payload stays off-chain).

## Quick start

1. Install the memory MCP package:

```bash
pip install pmll-memory-mcp
# or via npm: npx pmll-memory-mcp
# or: npm install -g pmll-memory-mcp
```

2. Register it with your MCP client (Claude Desktop example — `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pmll-memory-mcp": {
      "command": "npx",
      "args": ["pmll-memory-mcp"]
    }
  }
}
```

(If installed via pip you can use `"command": "pmll-memory-mcp"` instead.)

3. Restart the client / start a fresh session. The agent now has access to the full set of memory tools (`init`, `peek`, `set`, `resolve`, `flush`, graph ops, solution engine, etc.). Call `init` once at the start of a task, then `peek` before expensive operations.
