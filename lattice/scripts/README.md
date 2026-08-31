# the persistence in memory

Competition-mode ARC-AGI-3 agent. Run with `ARC_API_KEY` in the environment only.

```bash
export ARC_API_KEY="…"   # never commit
python3 lattice/scripts/persistence_in_memory.py
```

## v1.5 (strongest closed card)

https://arcprize.org/scorecards/cfeeae13-dce8-457e-be23-a57725eeac91

- `competition_mode: true`, 25/25 environments, 3/183 levels, 2138 actions
- LP85 L1 in 5 clicks at (6, 33)
- VC33 L1 in 11 clicks at (61, 32) (human baseline 7)
- R11L L1 in 118 clicks at (36, 20)

Write-up: [`docs/ARC-AGI3-PERSISTENCE.md`](../../docs/ARC-AGI3-PERSISTENCE.md)
JSONL level-ups: [`docs/arc-agi3-levelups.jsonl`](../../docs/arc-agi3-levelups.jsonl)

## JSONL loop recipes (from our own public cards)

These are ingested at the start of each run (`ingest_jsonl`) and tried a few times per life, then the agent explores:

- LP85 `ACTION6` (6, 33)
- VC33 `ACTION6` (61, 32)
- R11L `ACTION6` (36, 20) and (36, 26)

Community PRs: [#51](https://github.com/arcprize/ARC-AGI-Community-Leaderboard/pull/51) (this method), [#52](https://github.com/arcprize/ARC-AGI-Community-Leaderboard/pull/52) (World Model Agent).
