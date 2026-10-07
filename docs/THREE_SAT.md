# 3-SAT is decided exactly, not in polynomial time

`two_sat.py` decides width-2 formulas from implication-graph components, in time linear in n + m. That construction stops at width 2. A clause `(a ∨ b ∨ c)` is not a pair of implications.

`three_sat.py` decides 3-CNF by DPLL with unit propagation. It returns a satisfying assignment, or unsatisfiable after the search tree is exhausted. The bound is exponential. Nothing in this file places 3-SAT in P.

`SAT.py` / `SAT.h` remain the general CDCL surface. They are unchanged. Use `three_sat.py` when you want the small checked decider that matches family 002 in [drQedwards/math](https://github.com/drQedwards/math).

```bash
python tests/test_three_sat.py
```

The test enumerates all assignments for n ≤ 10.
