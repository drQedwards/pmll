# the persistence in memory

ARC-AGI-3 public-set agent for [PMLL](https://github.com/drQedwards/pmll). Named **the persistence in memory**. It treats each 64×64 frame as a short-term silo: hash the grid, remember which `ACTION1–7` changed it, prefer novel or previously-progressing moves, and click connected-component centroids on click games.

## Closed scorecards

Both cards used `competition_mode: true` ([docs](https://docs.arcprize.org/toolkit/competition_mode)). Scores below are **from the closed cards**, not self-reported.

| | v1.0 | v1.1 |
|---|---|---|
| Card | `fa62e88d-607e-402d-91d4-ca61ad597cab` | `6424f517-8080-4c22-8039-accb5bf5877e` |
| URL | https://arcprize.org/scorecards/fa62e88d-607e-402d-91d4-ca61ad597cab | https://arcprize.org/scorecards/6424f517-8080-4c22-8039-accb5bf5877e |
| Score | 0.1299 | 0.0100 |
| Environments | 25 / 25, 0 fully won | 25 / 25, 0 fully won |
| Levels | **3 / 183** | 2 / 183 |
| Actions | 3887 | 3482 |
| Notes | Sequential novelty silo | Click-first + warm silo after [pmll#2](https://github.com/drQedwards/pmll/pull/2) |

v1.0 is the stronger card (VC33 × 2, R11L × 1). v1.1 got VC33 × 1, R11L × 1.

Learned-from https://arcprize.org/scorecards/8aaeff26-b817-4d32-b4cd-e4b9251370b1 is GET 404 with this key (traces are not shared). Method only.

## How to run

```bash
export ARC_API_KEY="…"   # from https://three.arcprize.org — never commit
python3 lattice/scripts/persistence_in_memory.py
```

1. `GET /api/games`
2. `POST /api/scorecard/open` with `competition_mode: true`, tags `the persistence in memory`
3. Play every public game on one session (cookies / `AWSALB*`), sequential, 429 backoff
4. `POST /api/scorecard/close` before the 15-minute auto-close

## Method

- **Silo** — `(frame_hash, action, extra)` so the same click or key is not retried on an identical board.
- **Progress recipes** — when `levels_completed` rises, store the action against a coarse frame signature.
- **Clicks** — connected components of non-background colors; centroids first.
- **Keyboard** — frame-diff sprite tracking; greedy walk toward the nearest other blob, then `ACTION5`.
- **Level reset** — stall of 42 actions, or `GAME_OVER` / HTTP 400, issues `RESET` (competition mode turns a full-game reset into a level reset).

A four-worker run (`88ed21b2-…`) hit `RATE_LIMIT_EXCEEDED` (600 RPM) and did not close. v1.0 replaced it.

## Leaderboards

- **ARC Prize Verified** (private eval) cannot be entered from this public-API run.
- **Unverified / live** ingest of competition-mode agent cards is batched about every 15 minutes.
- **Community Leaderboard** — [PR #51](https://github.com/arcprize/ARC-AGI-Community-Leaderboard/pull/51) (`submissions/the-persistence-in-memory/`). `scorecard_url` only, no numeric `score` field.
