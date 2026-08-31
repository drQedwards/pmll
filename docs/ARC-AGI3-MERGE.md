# PMLL merge-ascend

PMLL does not download Tycho’s Claude Opus weights or Retrodict’s GPT-5.6 Sol run. Those 100% / 99.9% public-demo scores cost **$2,986** and **$654**. There is no LLM key in this environment.

What PMLL *does* merge is the **method lattice** — the public description of how those agents work — into one $0 executable loop.

## Board methods ingested

| Method | Public demo | Cost | Skill folded into PMLL |
|---|---|---|---|
| Tycho | 100.0% | $2,986 | Falsification-tested executable world model; plan through it |
| Retrodict | 99.9% | $654 | Log every frame; a rule must retrodict history before a live action |
| baseline1 | 99.0% | $400 | Build/verify an executable world model, then plan |
| NOOA | 85.1% | $332 | Reusable transition helpers; persist learning |
| OPINE-World | 78.4% | $1,040 | CEGIS: act, then rewrite/falsify the engine |
| TELL | 43.9% | $1,406 | Compound confirmed knowledge in durable memory |
| Continual Harness | 20.5% | $774 | Rewrite policy from trajectory evidence |
| the persistence in memory | 0.1756 | $0 | JSONL recipes, per-life silo |

Lattice file: [`arc-agi3-method-lattice.json`](arc-agi3-method-lattice.json).

## Loop

1. Ingest every prior JSONL into a transition table `(game, signature, action) → next signature, delta, level_up`.
2. Trust an edge only if it matched recorded history (`ok > 0` and `fail*2 ≤ ok`).
3. On a live frame, **plan** along trusted edges toward a `level_up` node (Tycho/baseline1).
4. Otherwise replay JSONL recipes, then explore.
5. After each action, **remember** or **falsify** (Retrodict + OPINE).
6. Persist `world_model.json` next to the silo.

```bash
export ARC_API_KEY="…"
python3 lattice/scripts/pmll_merge_ascend.py
```

## Live card

https://arcprize.org/scorecards/6d9ec3e7-a36d-47f2-91e7-a67effdef69a

v2.1-merge, `competition_mode: true`, 25/25 environments, **2/183** levels, score **0.254** (VC33 L1 in 3 actions at the 1.15× cap, LP85 L1 in 5). That is **up from v1.5’s 0.176**, and still a $0 public-set method card.

On the community board those 100% / 99.9% rows are *average environment scores near 100*. 0.254 on the same scale is about a quarter of one percent, not a pass of Tycho.

Passing that board without a coding-agent LLM and a few hundred dollars of inference is not a silo trick. PMLL merges the *loop* (log → hypothesize → falsify → plan → persist). It does not merge Opus/GPT-5.6 weights.
