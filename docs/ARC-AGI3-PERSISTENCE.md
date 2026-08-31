# the persistence in memory

ARC-AGI-3 public-set agent for [PMLL](https://github.com/drQedwards/pmll). Named **the persistence in memory**. It treats each 64×64 frame as a short-term silo: hash the grid, remember which `ACTION1–7` changed it, prefer novel or previously-progressing moves, and click connected-component centroids on click games.

## Closed scorecard

| | |
|---|---|
| Agent | the persistence in memory |
| Mode | `competition_mode: true` (required for the unverified / community boards) |
| Card | `fa62e88d-607e-402d-91d4-ca61ad597cab` |
| URL | https://arcprize.org/scorecards/fa62e88d-607e-402d-91d4-ca61ad597cab |
| Score | 0.1299 (average of per-environment bests; pulled from the card, not self-reported) |
| Environments | 25 / 25 played, 0 fully won |
| Levels | 3 / 183 |
| Actions | 3887 |
| Source | https://github.com/drQedwards/pmll |
| Learned-from | https://arcprize.org/scorecards/8aaeff26-b817-4d32-b4cd-e4b9251370b1 (API GET 404 — traces are not shared across keys; method only) |

Progress that scored:

| Game | Tag | Levels | Notes |
|---|---|---|---|
| VC33 | click | 2 / 7 | Level 1 in 9 actions (human baseline 7). Env score 2.33 |
| R11L | click | 1 / 6 | Level 1 in 50 actions (human baseline 22). Env score 0.92 |

Click-tagged games as a group scored 0.34; keyboard and keyboard_click stayed at 0.

## How to run

```bash
export ARC_API_KEY="…"   # from https://three.arcprize.org — never commit
python3 lattice/scripts/persistence_in_memory.py
```

The script:

1. `GET /api/games`
2. Tries to read the learned-from scorecard (other users' cards are 404)
3. `POST /api/scorecard/open` with `competition_mode: true`, tags `the persistence in memory`
4. Plays every public game on **one** session (cookies / `AWSALB*` affinity), sequential, ~0.13 s pacing, exponential backoff on HTTP 429
5. `POST /api/scorecard/close` before the 15-minute auto-close

Logs land in `/tmp/arc-persistence/` (`card_id.txt`, `results.json`, `scorecard.json`). Do not copy `ARC_API_KEY` there into git.

## Method

- **Silo** — `(frame_hash, action, extra)` set so the same click or key is not retried on an identical board.
- **Progress recipes** — when `levels_completed` rises, the triggering action is stored against a coarse frame signature and replayed if that signature returns.
- **Clicks** — connected components of non-background colors; centroids first, then small blobs.
- **Keyboard** — frame-diff sprite tracking and greedy walk toward the nearest other blob, then `ACTION5`.
- **Level reset** — stall of 42 actions with no level-up, or `GAME_OVER` / HTTP 400, issues `RESET` (competition mode turns a full-game reset into a level reset).

A first four-worker run (`88ed21b2-…`) hit `RATE_LIMIT_EXCEEDED` (600 RPM) and did not close with a score. This card is the sequential competition run that replaced it.

## Leaderboards

- **ARC Prize Verified** (private eval) cannot be entered from this public-API run.
- **Unverified / live** ingest of competition-mode agent cards is batched about every 15 minutes on [three.arcprize.org](https://three.arcprize.org) / [arcprize.org/scorecards](https://arcprize.org/scorecards).
- **Community Leaderboard** is a GitHub PR with `scorecard_url` and no self-reported numeric score. See `submissions/the-persistence-in-memory/` on [ARC-AGI-Community-Leaderboard](https://github.com/arcprize/ARC-AGI-Community-Leaderboard).
