# Lattice

Stellar skills graph + PMLL commitment desk + ARC-AGI-3 Full Play Test.

This folder is the playable surface that sits on [PMLL](https://github.com/drQedwards/pmll) and [skills.stellar.org](https://skills.stellar.org).

## What it does

1. **Graph** — force-directed map of Stellar skills with PMLL as a first-class node.
2. **Anchor** — SHA-256 32-byte commitments, local ledger, and exact `stellar contract invoke` lines for `init` / `store` / `get` / `bump`.
3. **Win** — sealing a commitment pulses the graph and shows the receipt.
4. **Play** — ARC-AGI-3 Full Play Test against `https://three.arcprize.org`. Default game is `ls20`. A `WIN` hashes the episode and stores it through PMLL.
5. **the persistence in memory** — competition-mode public-set agent in `scripts/persistence_in_memory.py`. Sequential REST play, PMLL frame/action silo, 429 backoff. Set `ARC_API_KEY` in the environment only.

## Protocol (ARC-AGI-3)

Matches [docs.arcprize.org](https://docs.arcprize.org) and the [full play test](https://docs.arcprize.org/full-play-test):

- `GET /api/games` → open scorecard → `RESET` → `ACTION1–7` → close scorecard
- 64×64 frames, discrete actions, session cookies proxied server-side
- `ARC_API_KEY` is **server-only**. Never put it in a `VITE_` var or a client bundle.

Closed competition-mode card: https://arcprize.org/scorecards/fa62e88d-607e-402d-91d4-ca61ad597cab

## Stellar invoke (store)

```bash
stellar contract invoke \
  --id $PMLL_CONTRACT_ID \
  --source-account $STELLAR_ACCOUNT \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --network testnet \
  --send yes \
  -- \
  store \
  --id 0x<32-byte-id> \
  --commitment 0x<32-byte-sha256>
```

Only the digest goes on-chain. The episode payload stays off-chain.

## Layout

```
src/lib/pmll-anchor.ts    SHA-256 + invoke command builders
src/lib/anchor-store.ts   local ledger (init/store/get/bump + TTL)
src/lib/graph-*.ts        skill graph + canvas engine
src/lib/arc-*.ts          local harness + live API proxy
src/components/           graph HUD, anchor desk, sealed win, play test
src/routes/play.tsx       /play
scripts/                  ARC-AGI-3 competition agent (the persistence in memory)
contracts/pmll-anchor/    Soroban contract (mirrors ../pmll-anchor)
```
