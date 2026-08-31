#!/usr/bin/env python3
"""PMLL merge-ascend — ARC-AGI-3 competition-mode agent.

Merges the public community-board *methods* (not their paid model weights)
into a PMLL silo:

- Tycho / baseline1 / NOOA: executable transition world model
- Retrodict: a rule must have matched recorded history before we trust it
- OPINE-World: falsify predictions that miss (CEGIS)
- TELL / Continual Harness: persist the model across cards
- the persistence in memory: JSONL recipes + per-life tried set

No LLM. ARC_API_KEY from env only.
"""
from __future__ import annotations

import importlib.util
import json
import os
import random
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pim", HERE / "persistence_in_memory.py")
pim = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(pim)

AGENT = "pmll merge ascend"
VERSION = "2.1-merge"
OUT = Path("/tmp/arc-persistence")
JSONL = OUT / "v2.merge.jsonl"
LATTICE = HERE.parents[1] / "docs" / "arc-agi3-method-lattice.json"
DEADLINE_SEC = 13 * 60 + 20
SOURCE_URL = "https://github.com/drQedwards/pmll"
PRIOR = "cfeeae13-dce8-457e-be23-a57725eeac91"


def extra_key(extra: dict) -> str:
    if not extra:
        return ""
    return json.dumps(extra, sort_keys=True, separators=(",", ":"))


class WorldModel:
    """Falsification-tested transition table. Retrodicts JSONL history."""

    def __init__(self) -> None:
        # (game, sig, action, extra_s) -> stats
        self.edge: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
        self.level_edge: Dict[str, List[Tuple[str, dict]]] = defaultdict(list)
        self.methods: List[dict] = []

    def load_methods(self) -> None:
        if LATTICE.exists():
            data = json.loads(LATTICE.read_text())
            self.methods = list(data.get("board") or [])
            print("LATTICE methods={0}".format(len(self.methods)), flush=True)

    def remember(self, game: str, sig0: str, action: str, extra: dict,
                 sig1: str, level_up: bool, changed: bool) -> None:
        k = (game, sig0, action, extra_key(extra))
        rec = self.edge.get(k) or {
            "ok": 0, "fail": 0, "up": 0, "change": 0, "next": sig1,
        }
        rec["ok"] += 1
        if changed:
            rec["change"] += 1
        if level_up:
            rec["up"] += 1
            rec["next"] = sig1
            pair = (action, extra)
            if pair not in self.level_edge[game]:
                self.level_edge[game].insert(0, pair)
        self.edge[k] = rec

    def falsify(self, game: str, sig0: str, action: str, extra: dict, predicted: str, actual: str) -> None:
        k = (game, sig0, action, extra_key(extra))
        rec = self.edge.get(k)
        if rec is None:
            return
        if predicted and predicted != actual:
            rec["fail"] = rec.get("fail", 0) + 1

    def trusted(self, rec: dict) -> bool:
        ok = rec.get("ok") or 0
        fail = rec.get("fail") or 0
        return ok > 0 and fail * 2 <= ok

    def ingest_jsonl(self) -> int:
        n = 0
        seen = set()
        paths = list(OUT.glob("*.jsonl")) + list(OUT.glob("v1*/*.jsonl"))
        for path in paths:
            key = str(path.resolve())
            if key in seen or not path.exists():
                continue
            seen.add(key)
            last: Dict[str, dict] = {}
            for line in path.open():
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                game = o.get("game")
                if not game or "sig" not in o:
                    continue
                prev = last.get(game)
                if prev and prev.get("sig"):
                    changed = prev.get("sig") != o.get("sig")
                    up = bool(o.get("level_up") or (o.get("levels") or 0) > (prev.get("levels") or 0))
                    self.remember(
                        game, prev["sig"], o.get("action") or "ACTION6",
                        o.get("xy") or {}, o.get("sig") or "", up, changed,
                    )
                    n += 1
                last[game] = o
        return n

    def plan(self, game: str, sig: str) -> Optional[Tuple[str, dict]]:
        """Greedy: trusted level-up edge on this signature, else trusted changer."""
        ups = []
        chg = []
        for (g, s, action, extra_s), rec in self.edge.items():
            if g != game or s != sig or not self.trusted(rec):
                continue
            extra = json.loads(extra_s) if extra_s else {}
            if rec.get("up"):
                ups.append((rec["up"], action, extra))
            elif rec.get("change"):
                chg.append((rec["change"], action, extra))
        if ups:
            ups.sort(key=lambda t: t[0], reverse=True)
            return ups[0][1], ups[0][2]
        if self.level_edge.get(game):
            return self.level_edge[game][0]
        if chg:
            chg.sort(key=lambda t: t[0], reverse=True)
            return chg[0][1], chg[0][2]
        return None

    def dump(self) -> dict:
        edges = []
        for (g, s, a, e), rec in self.edge.items():
            if rec.get("up") or rec.get("change"):
                edges.append({"game": g, "sig": s, "action": a, "extra": e, **rec})
        return {
            "version": VERSION,
            "methods": [m.get("name") for m in self.methods],
            "edges": edges[:400],
            "level_edge": {
                k: [{"action": a, "extra": x} for a, x in v[:8]]
                for k, v in self.level_edge.items()
            },
        }


def choose(silo: pim.Silo, model: WorldModel, data: dict, tags: List[str],
           prev: Optional[dict], game: str) -> Tuple[str, dict, Optional[str]]:
    avail = [int(a) for a in (data.get("available_actions") or [1, 2, 3, 4])]
    fh = pim.frame_hash(data.get("frame"))
    sig = pim.signature(data.get("frame"))
    info = pim.analyze(data.get("frame"))

    def take(action: str, extra: dict) -> Optional[Tuple[str, dict]]:
        extra_s = extra_key(extra)
        if silo.peek(fh, action, extra_s):
            return None
        silo.set(fh, action, extra_s)
        return action, extra

    # Retrodict/Tycho: plan through trusted world-model edges first.
    planned = model.plan(game, sig)
    if planned:
        action, extra = planned
        if action == "ACTION6" and 6 in avail:
            hit = take(action, extra)
            if hit:
                return hit[0], hit[1], sig
        elif action.startswith("ACTION"):
            try:
                aid = int(action.replace("ACTION", ""))
            except ValueError:
                aid = 0
            if aid in avail:
                hit = take(action, extra)
                if hit:
                    return hit[0], hit[1], sig

    if silo.recipe_tries[game] < 6:
        for action, extra in list(silo.recipes.get(game, [])):
            if action == "ACTION6" and 6 not in avail:
                continue
            hit = take(action, extra)
            if hit:
                silo.recipe_tries[game] += 1
                return hit[0], hit[1], sig

    if 6 in avail:
        pts: List[Tuple[int, int]] = []
        if prev:
            pts.extend(pim.delta_cells(prev.get("frame"), data.get("frame")))
        small = [c for c in info["comps"] if 1 <= c["n"] <= 24]
        for c in small:
            interior = [(x, y) for x, y in c["cells"] if 1 <= x <= 62 and 1 <= y <= 62]
            pts.append((c["cx"], c["cy"]))
            pts.extend(interior[:12] or c["cells"][:8])
        for hx, hy in silo.click_hits.get(game, []):
            pts.extend(pim.neighbors(hx, hy))
        seen = set()
        ordered = []
        for p in pts:
            if p not in seen and 0 <= p[0] <= 63 and 0 <= p[1] <= 63:
                seen.add(p)
                ordered.append(p)
        random.shuffle(ordered)
        for x, y in ordered:
            hit = take("ACTION6", {"x": int(x), "y": int(y)})
            if hit:
                return hit[0], hit[1], sig
        if info["comps"]:
            c = random.choice(info["comps"])
            cell = random.choice(c["cells"])
            return "ACTION6", {"x": cell[0], "y": cell[1]}, sig
        return "ACTION6", {"x": random.randint(8, 55), "y": random.randint(8, 55)}, sig

    keys = [a for a in avail if a in (1, 2, 3, 4, 5, 7)]
    random.shuffle(keys)
    for a in keys:
        hit = take("ACTION{0}".format(a), {})
        if hit:
            return hit[0], hit[1], sig
    a = random.choice(avail) if avail else 1
    if a == 6:
        return "ACTION6", {"x": random.randint(0, 63), "y": random.randint(0, 63)}, sig
    return "ACTION{0}".format(a), {}, sig


def play_game(client: pim.Client, game: dict, card_id: str, deadline: float,
              silo: pim.Silo, model: WorldModel) -> dict:
    gid = game["game_id"]
    title = game.get("title") or gid
    tags = list(game.get("tags") or [])
    summary = {
        "game_id": gid, "title": title, "tags": tags,
        "best_levels": 0, "best_state": "NOT_PLAYED",
        "actions": 0, "resets": 0, "win_levels": None, "error": None,
    }
    try:
        data = client.cmd("RESET", {"game_id": gid, "card_id": card_id})
        summary["resets"] += 1
        silo.reset_episode()
        guid = data.get("guid")
        summary["win_levels"] = data.get("win_levels")
        stall = 0
        last_levels = int(data.get("levels_completed") or 0)
        prev = None
        budget, stall_after, cap = pim.budgets(tags, title)
        steps = 0
        while steps < budget and time.time() < deadline:
            state = data.get("state")
            levels = int(data.get("levels_completed") or 0)
            summary["best_levels"] = max(summary["best_levels"], levels)
            if state:
                summary["best_state"] = state
            if state == "WIN":
                break
            if data.get("_http") == 400 or state in ("GAME_OVER", "NOT_PLAYED") or stall >= stall_after:
                if time.time() + 2 > deadline:
                    break
                data = client.cmd("RESET", {"game_id": gid, "card_id": card_id, "guid": guid})
                summary["resets"] += 1
                silo.reset_episode()
                guid = data.get("guid") or guid
                stall = 0
                prev = None
                if data.get("state") == "NOT_PLAYED" and summary["resets"] > 2:
                    break
                continue
            name, extra, sig0 = choose(silo, model, data, tags, prev, title)
            body = {"game_id": gid, "guid": guid}
            body.update(extra)
            nxt = client.cmd(name, body)
            guid = nxt.get("guid") or guid
            summary["actions"] += 1
            steps += 1
            new_levels = int(nxt.get("levels_completed") or 0)
            sig1 = pim.signature(nxt.get("frame"))
            changed = pim.frame_hash(nxt.get("frame")) != pim.frame_hash(data.get("frame"))
            up = new_levels > last_levels
            with JSONL.open("a") as fh:
                fh.write(json.dumps({
                    "t": round(time.time(), 3), "game": title, "game_id": gid,
                    "action": name, "xy": extra or None, "state": nxt.get("state"),
                    "levels": new_levels, "sig": sig1, "level_up": up,
                }, separators=(",", ":")) + "\n")
            model.remember(title, sig0 or pim.signature(data.get("frame")),
                           name, extra, sig1, up, changed)
            if name == "ACTION6" and extra.get("x") is not None and changed:
                silo.click_hits[title].append((int(extra["x"]), int(extra["y"])))
                silo.click_hits[title] = silo.click_hits[title][-24:]
            if up:
                silo.note_progress(pim.signature(data.get("frame")), name, extra, title)
                stall = 0
                last_levels = new_levels
                budget = min(budget + 120, cap)
            else:
                stall += 1
            prev = data
            data = nxt
    except Exception as e:
        summary["error"] = "{0}: {1}".format(type(e).__name__, e)[:240]
    print("[{0}] state={1} levels={2} acts={3} resets={4} err={5}".format(
        title, summary["best_state"], summary["best_levels"],
        summary["actions"], summary["resets"], summary["error"]), flush=True)
    return summary


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    key = os.environ.get("ARC_API_KEY")
    if not key:
        raise SystemExit("ARC_API_KEY is not set")
    client = pim.Client(key)
    model = WorldModel()
    model.load_methods()
    ingested = model.ingest_jsonl()
    print("WORLD_MODEL edges={0} ingested={1} level_games={2}".format(
        len(model.edge), ingested, list(model.level_edge)), flush=True)

    status, games = client.req("GET", "/api/games")
    if status != 200 or not isinstance(games, list):
        raise SystemExit("games list failed {0}".format(status))
    games.sort(key=lambda g: (
        0 if pim.tag_kind(g.get("tags") or []) == "click" else 1,
        (g.get("baseline_actions") or [99])[0],
    ))

    status, opened = client.req("POST", "/api/scorecard/open", {
        "source_url": SOURCE_URL,
        "tags": [AGENT, "pmll", "merge-ascend", "competition", VERSION],
        "opaque": {
            "agent": AGENT,
            "version": VERSION,
            "method": "PMLL merge of public board methods: world-model + retrodict + CEGIS + JSONL silo",
            "lattice": "docs/arc-agi3-method-lattice.json",
            "prior": "https://arcprize.org/scorecards/{0}".format(PRIOR),
            "board_methods": [m.get("name") for m in model.methods],
        },
        "competition_mode": True,
    })
    if status != 200 or not isinstance(opened, dict) or not opened.get("card_id"):
        raise SystemExit("open failed {0} {1}".format(status, opened))
    card_id = opened["card_id"]
    print("OPENED", card_id, flush=True)
    (OUT / "card_id.txt").write_text(card_id)
    JSONL.write_text("")
    with JSONL.open("a") as fh:
        fh.write(json.dumps({"event": "open", "card_id": card_id, "version": VERSION}) + "\n")

    silo = pim.Silo()
    pim.ingest_jsonl(silo)
    deadline = time.time() + DEADLINE_SEC
    results = []
    for g in games:
        if time.time() >= deadline:
            break
        results.append(play_game(client, g, card_id, deadline, silo, model))
        (OUT / "results.json").write_text(json.dumps(results, indent=2))

    status, summary = client.req("POST", "/api/scorecard/close", {"card_id": card_id}, timeout=60)
    if status != 200:
        time.sleep(5)
        status, summary = client.req("GET", "/api/scorecard/{0}".format(card_id), timeout=60)
    (OUT / "scorecard.json").write_text(
        json.dumps(summary, indent=2) if isinstance(summary, dict) else str(summary)
    )
    (OUT / "world_model.json").write_text(json.dumps(model.dump(), indent=2))
    print("CLOSE status", status, flush=True)
    if isinstance(summary, dict):
        print("SCORE", summary.get("score"),
              "levels", summary.get("total_levels_completed"), "/", summary.get("total_levels"),
              "wins", summary.get("total_environments_completed"),
              "actions", summary.get("total_actions"), flush=True)
    print("URL https://arcprize.org/scorecards/{0}".format(card_id), flush=True)


if __name__ == "__main__":
    main()
