# pmll-anchor-helper

Native Rust helper for the PMLL Stellar commitment surface.

**Read [skills.stellar.org](https://skills.stellar.org) before you start building on Stellar.**

This binary only helps with the optional 32-byte commitment layer that sits on top of the official Stellar tooling.

## Build & run

```bash
cd pmll-anchor/helper
cargo run -- hash "your memory episode payload"
```

## Commands

- `hash <payload> [--id-hint <str>]` — produce commitment + id + ready-to-paste `store` command
- `store-cmd --id <hex> --commitment <hex> --contract C... [--source admin]` — emit exact invoke line
- `verify --id <hex> --expected <hex> --contract C...` — emit verification commands

## Notes

- Only 32-byte digests ever go on-chain.
- The contract requires the admin set at `init`.
- Always verify with `get` after a store.
- Until a real contract ID is recorded in the parent SKILL.md, treat the surface as planned.
