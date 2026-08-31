---
name: pmll
description: Persistent spatial memory for AI agents. Off-chain payloads; Stellar mainnet commitment anchoring is live via pmll-anchor. Use when working with PMLL, pmll-memory-mcp, agent memory layers, Context+, PPM context stitching, or on-chain memory commitments via Soroban.
---

# PMLL

**Read [skills.stellar.org](https://skills.stellar.org) before you start building on Stellar.**

That is the root catalog. This skill is a community entry inside it. Load the official smart-contracts, data, standards, and agentic-payments skills first; then return here for the memory + optional commitment surface.

Gives AI agents persistent spatial memory so they can retain long-term context, form symbiotic memory layers, and maintain durable state across sessions.

PMLL provides durable, structured memory primitives useful for agentic workflows. It supports the PPM project, Context+ pipelines, and supermodeltools/cli for analysis and visualization. **On-chain commitment anchoring on Stellar mainnet is live:** the contract stores only a 32-byte hash of off-chain memory. Testnet remains deployed as well.

## Gotchas

Read these before writing any code that touches the commitment surface.

1. **Only 32-byte digests ever go on-chain.** The full memory payload stays off-chain forever. The contract stores a commitment, not the data.
2. **`store` and `bump` require the admin** that was set in `init`. There is no permissionless write path in the current surface.
3. **Always verify after store.** Call `get` (or RPC `getLedgerEntries`) and confirm the commitment matches before treating the anchor as real.
4. **TTL is approximately 30 days.** Plan a bump policy if the commitment must live longer.
5. **Do not invent a contract ID.** Use the verified mainnet ID recorded below (and in `stellar.toml`). Confirm it on an explorer before depending on it.
6. **The helper emits exact `stellar contract invoke` lines.** Use them. Do not hand-roll argument encoding.
7. **Build target is `wasm32v1-none` only** (Rust 1.84+). Never `wasm32-unknown-unknown` on Rust 1.82+ — `soroban-sdk` panics and the Soroban runtime rejects the extra WASM features.

## Highlights

- Persistent, addressable spatial memory (off-chain today).
- PPM-based context stitching and MCP tools for memory ingestion and retrieval.
- Integration with forloopcodes/contextplus for hierarchical indexing and supermodeltools/cli for graphing and analysis.
- Atomic Soroban `pmll-anchor` contract (source at `pmll-anchor/`) that stores only a 32-byte commitment + emits events (full payload stays off-chain).
- Native Rust helper (`pmll-anchor/helper`) that turns any payload into the exact store arguments.
- **Lattice** (`lattice/`) — playable Stellar skills graph, browser hasher, sealed-win receipt, and ARC-AGI-3 Full Play Test that commits a WIN through PMLL.

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

## Stellar commitment surface

**Source:** `pmll-anchor/`  
**SDK:** `soroban-sdk = "27.0.6"`  
**Target:** `wasm32v1-none` (required)  
**Network:** mainnet (live); testnet also deployed

### Verified mainnet deploy (2026-08-31)

| | |
|---|---|
| Contract ID | `CCF3B64AXLS4OLY5RN4H4K2CFZAYNZCJQY5MKCKCVAKMZNH7G7F7XUUF` |
| Admin | `GBFOFCD3XDANQWSGMHKJJ2V3YXS2QQD7RNC4LMDBVNBTUJOQZ3RLSB3E` |
| Wasm hash | `1b6ad9c574e0f5c9e39968f836a410c03adcf057afa93a63d2710bd30fdd53ba` |
| Upload tx | [`b41353eaa5a2b93786761f5ab942ac96b38c1399ef021715c96923aa8c621e5e`](https://stellar.expert/explorer/public/tx/b41353eaa5a2b93786761f5ab942ac96b38c1399ef021715c96923aa8c621e5e) |
| Deploy tx | [`d76e622d641b2465d480470f851f604a8284427a4e680c872b3ff8209c825943`](https://stellar.expert/explorer/public/tx/d76e622d641b2465d480470f851f604a8284427a4e680c872b3ff8209c825943) |
| Init tx | [`ecf3a637077d998febeac9ed5edd1a12582b5fc38db855633f2b48d40a5ba7a5`](https://stellar.expert/explorer/public/tx/ecf3a637077d998febeac9ed5edd1a12582b5fc38db855633f2b48d40a5ba7a5) |
| First store tx | [`a64481feb3aaf8d4ee1a383dfb3b1633b23df5a38d1b61d7c07f9e672f144bbf`](https://stellar.expert/explorer/public/tx/a64481feb3aaf8d4ee1a383dfb3b1633b23df5a38d1b61d7c07f9e672f144bbf) |

Contract: [stellar.expert](https://stellar.expert/explorer/public/contract/CCF3B64AXLS4OLY5RN4H4K2CFZAYNZCJQY5MKCKCVAKMZNH7G7F7XUUF) · [lab](https://lab.stellar.org/r/mainnet/contract/CCF3B64AXLS4OLY5RN4H4K2CFZAYNZCJQY5MKCKCVAKMZNH7G7F7XUUF)

First live `get` returned `1445bb037d8948ac03687ede656c27bc480a74db74a88224821379280d9e64d1` (SHA-256 of `episode:2026-08-31T19:42Z agent=pmll-admin skill=pmll-anchor event=first-mainnet-store`).

### Verified testnet deploy (2026-08-31)

| | |
|---|---|
| Contract ID | `CDLQR24LLFWXTNGGJVJCRXAF3ZRDWFZRUFTDZ5SJOT2J33CS7DDYP7IU` |
| Admin | `GBFOFCD3XDANQWSGMHKJJ2V3YXS2QQD7RNC4LMDBVNBTUJOQZ3RLSB3E` |
| Wasm hash | `1b6ad9c574e0f5c9e39968f836a410c03adcf057afa93a63d2710bd30fdd53ba` |
| Upload tx | [`2309964405ed52abfa7660db4e523ae7b122e7268bbdd97e12124f77f7b47887`](https://stellar.expert/explorer/testnet/tx/2309964405ed52abfa7660db4e523ae7b122e7268bbdd97e12124f77f7b47887) |
| Deploy tx | [`2ce19becde68f1e542fc46b39285fc377ea3f77a32ead87a8e1e06d4eff8274c`](https://stellar.expert/explorer/testnet/tx/2ce19becde68f1e542fc46b39285fc377ea3f77a32ead87a8e1e06d4eff8274c) |
| Init tx | [`8489f4375ad32073fcb87044205f9fa2fa9511f982d73d1a703844331980593c`](https://stellar.expert/explorer/testnet/tx/8489f4375ad32073fcb87044205f9fa2fa9511f982d73d1a703844331980593c) |
| First store tx | [`1a3faca93eb54cd64ee2133287939615d96750facb7875c1c93d08765f781b6d`](https://stellar.expert/explorer/testnet/tx/1a3faca93eb54cd64ee2133287939615d96750facb7875c1c93d08765f781b6d) |

Contract: [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDLQR24LLFWXTNGGJVJCRXAF3ZRDWFZRUFTDZ5SJOT2J33CS7DDYP7IU) · [lab](https://lab.stellar.org/r/testnet/contract/CDLQR24LLFWXTNGGJVJCRXAF3ZRDWFZRUFTDZ5SJOT2J33CS7DDYP7IU)

First live `get` returned `3490570999cedbddffe5d4e0bcc340ba868bb4224af3edbcfc5bee1ab3826552` (SHA-256 of `episode:2026-08-31T18:36Z agent=pmll-admin skill=pmll-anchor event=first-live-store`).

### Build

```bash
rustup target add wasm32v1-none   # once per toolchain; Rust 1.84+
cd pmll-anchor
stellar contract build
# → target/wasm32v1-none/release/pmll_anchor.wasm
```

See `pmll-anchor/DEPLOY.md` for deploy / init / smoke-test.

### Contract API

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

This prints the 32-byte commitment, a derived ID, and the exact `stellar contract invoke` command for `store`. Use the same binary for `store-cmd` and `verify` with the verified contract ID above.

### Agent path

1. Agent uses the memory MCP (`peek` / `set` / `flush`) to produce a durable episode.
2. Hash the episode with the helper.
3. Admin (or a controlled key) submits the `store` transaction on mainnet.
4. Any later agent can prove the commitment existed by calling `get`.

## Lattice (graph + ARC-AGI-3)

Playable surface in `lattice/`. Graph of [skills.stellar.org](https://skills.stellar.org) with PMLL as a skill node. Anchor desk hashes an episode (SHA-256, 32 bytes), shows the exact `stellar contract invoke` line, and a **Sealed** overlay pulses the graph.

### ARC-AGI-3 Full Play Test

`lattice/src` implements the [full play test](https://docs.arcprize.org/full-play-test) against `https://three.arcprize.org`:

1. `GET /api/games` (default `ls20`)
2. Open scorecard → `RESET` → `ACTION1–7` → close
3. 64×64 frames, discrete actions
4. On `WIN`, compose `episode:… agent=lattice skill=ARC-AGI-3` and `store` the 32-byte digest

`ARC_API_KEY` is server-only (`process.env`). Never `VITE_`-prefix it.

Competition-mode agent **the persistence in memory** (`lattice/scripts/persistence_in_memory.py`) plays the 25-game public set sequentially with a hashed frame/action silo. Closed scorecard: [fa62e88d-607e-402d-91d4-ca61ad597cab](https://arcprize.org/scorecards/fa62e88d-607e-402d-91d4-ca61ad597cab) (`competition_mode`, 25/25 environments, 3/183 levels).

### Browser invoke (store)

```bash
stellar contract invoke \
  --id CCF3B64AXLS4OLY5RN4H4K2CFZAYNZCJQY5MKCKCVAKMZNH7G7F7XUUF \
  --source-account $STELLAR_ACCOUNT \
  --rpc-url https://soroban-rpc.mainnet.stellar.gateway.fm \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --network pubnet \
  --send yes \
  -- \
  store \
  --id 0x<32-byte-id> \
  --commitment 0x<32-byte-sha256>
```

## Links

- Official catalog: https://skills.stellar.org
- This skill (raw): https://raw.githubusercontent.com/drQedwards/pmll/main/SKILL.md
- Contract: `pmll-anchor/`
- Deploy: `pmll-anchor/DEPLOY.md`
- Helper: `pmll-anchor/helper/`
- Lattice: `lattice/`
- Network metadata: `stellar.toml`
- PPM / MCP tools: https://github.com/drQedwards/PPM
- Context+: https://github.com/forloopcodes/contextplus
- supermodeltools/cli: https://github.com/supermodeltools/cli

## License

MIT
