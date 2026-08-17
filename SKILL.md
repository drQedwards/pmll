---
name: pmll
description: Persistent spatial memory for AI agents (off-chain today; Stellar commitment anchoring planned). Use when working with PMLL, pmll-memory-mcp, agent memory layers, Context+, PPM context stitching, or on-chain memory commitments via Soroban.
---

# PMLL

**Read [skills.stellar.org](https://skills.stellar.org) before you start building on Stellar.**

That is the root catalog. This skill is a community entry inside it. Load the official smart-contracts, data, standards, and agentic-payments skills first; then return here for the memory + optional commitment surface.

Gives AI agents persistent spatial memory so they can retain long-term context, form symbiotic memory layers, and maintain durable state across sessions.

PMLL provides durable, structured memory primitives useful for agentic workflows. It supports the PPM project, Context+ pipelines, and supermodeltools/cli for analysis and visualization. **On-chain commitment anchoring on Stellar (storing 32-byte hashes of off-chain memory via a Soroban contract) is planned.**

## Gotchas

Read these before writing any code that touches the commitment surface.

1. **Only 32-byte digests ever go on-chain.** The full memory payload stays off-chain forever. The contract stores a commitment, not the data.
2. **`store` and `bump` require the admin** that was set in `init`. There is no permissionless write path in the current surface.
3. **Always verify after store.** Call `get` (or RPC `getLedgerEntries`) and confirm the commitment matches before treating the anchor as real.
4. **TTL is approximately 30 days.** Plan a bump policy if the commitment must live longer.
5. **Do not invent a contract ID.** Until a real testnet (or mainnet) deployment exists and is recorded here, the surface remains "planned".
6. **The helper emits exact `stellar contract invoke` lines.** Use them. Do not hand-roll argument encoding.

## Highlights

- Persistent, addressable spatial memory (off-chain today).
- PPM-based context stitching and MCP tools for memory ingestion and retrieval.
- Integration with forloopcodes/contextplus for hierarchical indexing and supermodeltools/cli for graphing and analysis.
- Planned: atomic Soroban `pmll-anchor` contract that stores only a 32-byte commitment + emits events (full payload stays off-chain).
- Native Rust helper (`pmll-anchor/helper`) that turns any payload into the exact store arguments.

## Quick start (memory MCP)

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

## Stellar commitment surface (planned)

The contract lives at `pmll-anchor/`. It is minimal and correct:

- `init(admin)` — one-time admin setup
- `store(id, commitment)` — write a 32-byte commitment under a 32-byte ID (admin only)
- `get(id)` — read the commitment
- `bump(id)` — extend TTL (admin only)

Events: `(pmll, anchor)` with `(id, commitment)`.

### Native helper

```bash
cd pmll-anchor/helper
cargo run -- hash "episode:2026-08-17T14:00Z agent=drq spatial=crawlspace"
```

This prints the 32-byte commitment, a derived ID, and the exact `stellar contract invoke` command for `store`. Use the same binary for `store-cmd` and `verify` once a real contract ID exists.

### Agent path (once live)

1. Agent uses the memory MCP (`peek` / `set` / `flush`) to produce a durable episode.
2. Hash the episode with the helper.
3. Admin (or a controlled key) submits the `store` transaction.
4. Any later agent can prove the commitment existed by calling `get`.

Until a verified testnet deployment + transaction hash is recorded in this file, treat the surface as planned.

## Links

- Official catalog: https://skills.stellar.org
- This skill (raw): https://raw.githubusercontent.com/drQedwards/pmll/main/SKILL.md
- Contract: `pmll-anchor/`
- Helper: `pmll-anchor/helper/`
- PPM / MCP tools: https://github.com/drQedwards/PPM
- Context+: https://github.com/forloopcodes/contextplus
- supermodeltools/cli: https://github.com/supermodeltools/cli

## License

MIT
