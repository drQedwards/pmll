# Water metric benchmark (PMLL vs no PMLL)

A/B harness: 24 Grok-Bot-style multi-turn repo-QA tasks x 4 turns over the docs in `corpus/`
(snapshot of this repo at 85f70e8), run three ways:

- **A**: no PMLL; every turn re-reads the full source doc into the prompt.
- **B-pertask**: PMLL `PMMemoryStore` (`mcp/pmll_memory_mcp/kv_store.py`) peek/set, silo flushed per task.
- **B-shared**: same, one silo across all tasks.

Scripts:
- `harness.py`: offline token counts with tiktoken (o200k_base), no API.
- `harness_xai.py [max_tasks]`: real calls to `POST https://api.x.ai/v1/responses` (model default `grok-4.7`, override `XAI_MODEL`), records API-reported usage to `raw_turns_xai.csv`. Needs `XAI_API_KEY`.
- `summarize_xai.py`: reductions, hit rates, cached-token effect, and water per 1M queries -> `summary_xai.csv`, `water_xai.csv`.
- `tests/mock_test.py`: runs the API harness against a mocked response (no network).

Water = tokens ratio x Wh/query x L/kWh with scenarios: low 0.24 Wh & 1.15 L/kWh (Google, arXiv:2508.15734);
mid 0.24 Wh & 4.226 L/kWh and high 3.0 Wh (assumed) & 7.482 L/kWh (Li et al., "Making AI Less Thirsty").
Assumes energy scales linearly with tokens. Task mix and "cache stores a short extracted fact" design strongly
drive the result; treat outputs as a scenario measurement, not a production figure.
