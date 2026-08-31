#!/usr/bin/env python3
"""the persistence in memory — ARC-AGI-3 competition-mode agent.

PMLL-style durable silo: hash frames, remember which actions changed the
board, track a keyboard sprite, and prefer novel or previously-progressing
moves. Sequential (one session) with 429 backoff. ARC_API_KEY from env only.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

ROOT = "https://three.arcprize.org"
AGENT = "the persistence in memory"
LEARNED_FROM = "https://arcprize.org/scorecards/8aaeff26-b817-4d32-b4cd-e4b9251370b1"
SOURCE_URL = "https://github.com/drQedwards/pmll"
DEADLINE_SEC = 13 * 60 + 20
MIN_INTERVAL = 0.13
MAX_ACTIONS_BASE = 140
MAX_ACTIONS_BONUS = 100
STALL_RESET_AFTER = 42
OUT = Path("/tmp/arc-persistence")

DIRS = {
    1: (0, -1),
    2: (0, 1),
    3: (-1, 0),
    4: (1, 0),
}


def last_grid(frame: Any) -> Optional[List[List[int]]]:
    if not frame:
        return None
    g = frame
    if isinstance(frame, list) and frame and isinstance(frame[0], list) and frame[0] and isinstance(frame[0][0], list):
        g = frame[-1]
    if not g or not g[0]:
        return None
    return g


def frame_hash(frame: Any) -> str:
    g = last_grid(frame)
    if not g:
        return "empty"
    raw = json.dumps(g, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def signature(frame: Any) -> str:
    g = last_grid(frame)
    if not g:
        return "empty"
    counts = Counter(int(v) for row in g for v in row)
    bg = counts.most_common(1)[0][0]
    n_fg = sum(n for c, n in counts.items() if c != bg)
    n_colors = len(counts)
    return "{0}:{1}:{2}:{3}".format(bg, n_fg, n_colors, len(counts) * n_fg % 997)


def analyze(frame: Any) -> Dict[str, Any]:
    g = last_grid(frame)
    empty = {"bg": 0, "comps": [], "grid": g, "h": 0, "w": 0}
    if not g:
        return empty
    h, w = len(g), len(g[0])
    counts = Counter(int(v) for row in g for v in row)
    bg = counts.most_common(1)[0][0]
    seen = [[False] * w for _ in range(h)]
    comps: List[Dict[str, Any]] = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or int(g[y][x]) == bg:
                continue
            color = int(g[y][x])
            stack = [(x, y)]
            seen[y][x] = True
            cells: List[Tuple[int, int]] = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and int(g[ny][nx]) == color:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            sx = sum(c[0] for c in cells) // len(cells)
            sy = sum(c[1] for c in cells) // len(cells)
            comps.append({"color": color, "cells": cells, "cx": sx, "cy": sy, "n": len(cells)})
    comps.sort(key=lambda c: (c["n"], c["color"]))
    return {"bg": bg, "comps": comps, "grid": g, "h": h, "w": w}


def moved_centroid(before: Any, after: Any) -> Optional[Tuple[int, int, int, int]]:
    g0 = last_grid(before)
    g1 = last_grid(after)
    if not g0 or not g1:
        return None
    h, w = min(len(g0), len(g1)), min(len(g0[0]), len(g1[0]))
    lost, gained = [], []
    for y in range(h):
        for x in range(w):
            a, b = int(g0[y][x]), int(g1[y][x])
            if a != b:
                lost.append((x, y, a))
                gained.append((x, y, b))
    if not lost or len(lost) > 80:
        return None
    lx = sum(p[0] for p in lost) // len(lost)
    ly = sum(p[1] for p in lost) // len(lost)
    gx = sum(p[0] for p in gained) // len(gained)
    gy = sum(p[1] for p in gained) // len(gained)
    return lx, ly, gx, gy


class Silo:
    """Cross-game short-term memory: tried pairs, progress recipes, move map."""

    def __init__(self) -> None:
        self.tried = set()
        self.progress: Dict[str, List[Tuple[str, dict]]] = defaultdict(list)
        self.moves: Dict[int, Tuple[int, int]] = {}
        self.click_hits: List[Tuple[int, int]] = []

    def peek(self, fh: str, action: str, extra: str = "") -> bool:
        return (fh, action, extra) in self.tried

    def set(self, fh: str, action: str, extra: str = "") -> None:
        self.tried.add((fh, action, extra))

    def note_progress(self, sig: str, action: str, extra: dict) -> None:
        rec = self.progress[sig]
        rec.append((action, extra))
        if len(rec) > 24:
            del rec[: len(rec) - 24]


class Client:
    def __init__(self, key: str) -> None:
        self.s = requests.Session()
        self.s.headers.update({
            "X-API-Key": key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        })
        self.last = 0.0

    def _pace(self) -> None:
        wait = MIN_INTERVAL - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)

    def req(self, method: str, path: str, body: Optional[dict] = None, timeout: int = 30) -> Tuple[int, Any]:
        backoff = 2.0
        for _ in range(8):
            self._pace()
            self.last = time.time()
            if method == "GET":
                r = self.s.get(ROOT + path, timeout=timeout)
            else:
                r = self.s.post(ROOT + path, json=body or {}, timeout=timeout)
            if r.status_code == 429:
                time.sleep(backoff)
                backoff = min(backoff * 2, 40)
                continue
            try:
                data = r.json() if r.content else {}
            except Exception:
                data = {"raw": r.text[:240]}
            return r.status_code, data
        return 429, {"error": "RATE_LIMIT_EXCEEDED"}

    def cmd(self, action: str, body: dict) -> dict:
        status, data = self.req("POST", "/api/cmd/{0}".format(action), body)
        if status == 400:
            data = dict(data or {})
            data["_http"] = 400
            return data
        if status != 200:
            raise RuntimeError("{0} {1} {2}".format(action, status, json.dumps(data)[:240]))
        return data


def choose(silo: Silo, data: dict, tags: List[str], prev: Optional[dict]) -> Tuple[str, dict]:
    avail = [int(a) for a in (data.get("available_actions") or [1, 2, 3, 4])]
    fh = frame_hash(data.get("frame"))
    sig = signature(data.get("frame"))
    info = analyze(data.get("frame"))
    click_only = "click" in tags and "keyboard" not in tags and "keyboard_click" not in tags
    keys = [a for a in avail if a in (1, 2, 3, 4, 5, 7)]

    if sig in silo.progress:
        act, extra = silo.progress[sig][-1]
        extra_s = json.dumps(extra, sort_keys=True)
        if not silo.peek(fh, act, extra_s):
            silo.set(fh, act, extra_s)
            return act, extra

    if 6 in avail:
        pts: List[Tuple[int, int]] = []
        for c in info["comps"]:
            pts.append((c["cx"], c["cy"]))
            if c["n"] <= 6:
                pts.extend(c["cells"][:3])
        for hx, hy in silo.click_hits[-8:]:
            pts.append((hx, hy))
            pts.append((max(0, hx - 1), hy))
            pts.append((min(63, hx + 1), hy))
        random.shuffle(pts)
        for x, y in pts:
            extra = "{0},{1}".format(x, y)
            if not silo.peek(fh, "ACTION6", extra):
                silo.set(fh, "ACTION6", extra)
                return "ACTION6", {"x": int(x), "y": int(y)}

    if silo.moves and any(a in avail for a in (1, 2, 3, 4)) and info["comps"]:
        player = None
        if prev:
            mv = moved_centroid(prev.get("frame"), data.get("frame"))
            if mv:
                player = (mv[2], mv[3])
        if player is None and info["comps"]:
            small = [c for c in info["comps"] if 1 <= c["n"] <= 12]
            if small:
                player = (small[0]["cx"], small[0]["cy"])
        if player:
            px, py = player
            targets = [(c["cx"], c["cy"]) for c in info["comps"] if abs(c["cx"] - px) + abs(c["cy"] - py) > 1]
            if targets:
                tx, ty = min(targets, key=lambda t: abs(t[0] - px) + abs(t[1] - py))
                dx, dy = tx - px, ty - py
                prefer = []
                if abs(dx) >= abs(dy):
                    prefer = ([4] if dx > 0 else [3]) + ([2] if dy > 0 else [1] if dy < 0 else [])
                else:
                    prefer = ([2] if dy > 0 else [1]) + ([4] if dx > 0 else [3] if dx < 0 else [])
                if abs(dx) + abs(dy) <= 2 and 5 in avail:
                    prefer = [5] + prefer
                for a in prefer:
                    name = "ACTION{0}".format(a)
                    if a in avail and not silo.peek(fh, name):
                        silo.set(fh, name)
                        return name, {}

    if not click_only:
        random.shuffle(keys)
        for a in keys:
            name = "ACTION{0}".format(a)
            if not silo.peek(fh, name):
                silo.set(fh, name)
                return name, {}

    if 6 in avail:
        info2 = info
        if info2["comps"]:
            c = random.choice(info2["comps"])
            cell = random.choice(c["cells"])
            return "ACTION6", {"x": cell[0], "y": cell[1]}
        return "ACTION6", {"x": random.randint(8, 55), "y": random.randint(8, 55)}

    if keys:
        a = random.choice(keys)
        return "ACTION{0}".format(a), {}
    a = random.choice(avail) if avail else 1
    if a == 6:
        return "ACTION6", {"x": random.randint(0, 63), "y": random.randint(0, 63)}
    return "ACTION{0}".format(a), {}


def play_game(client: Client, game: dict, card_id: str, deadline: float, silo: Silo) -> dict:
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
        guid = data.get("guid")
        summary["win_levels"] = data.get("win_levels")
        stall = 0
        last_levels = int(data.get("levels_completed") or 0)
        prev = None
        budget = MAX_ACTIONS_BASE
        steps = 0
        while steps < budget and time.time() < deadline:
            state = data.get("state")
            levels = int(data.get("levels_completed") or 0)
            summary["best_levels"] = max(summary["best_levels"], levels)
            if state:
                summary["best_state"] = state
            if state == "WIN":
                break
            if data.get("_http") == 400 or state in ("GAME_OVER", "NOT_PLAYED") or stall >= STALL_RESET_AFTER:
                if time.time() + 2 > deadline:
                    break
                data = client.cmd("RESET", {"game_id": gid, "card_id": card_id, "guid": guid})
                summary["resets"] += 1
                guid = data.get("guid") or guid
                stall = 0
                prev = None
                continue
            name, extra = choose(silo, data, tags, prev)
            body = {"game_id": gid, "guid": guid}
            body.update(extra)
            nxt = client.cmd(name, body)
            guid = nxt.get("guid") or guid
            summary["actions"] += 1
            steps += 1
            new_levels = int(nxt.get("levels_completed") or 0)
            mv = moved_centroid(data.get("frame"), nxt.get("frame"))
            if mv and name.startswith("ACTION"):
                try:
                    aid = int(name.replace("ACTION", ""))
                except ValueError:
                    aid = 0
                if aid in DIRS:
                    dx, dy = mv[2] - mv[0], mv[3] - mv[1]
                    if abs(dx) + abs(dy) > 0:
                        silo.moves[aid] = (1 if dx > 0 else -1 if dx < 0 else 0,
                                           1 if dy > 0 else -1 if dy < 0 else 0)
            if name == "ACTION6" and extra.get("x") is not None:
                if frame_hash(nxt.get("frame")) != frame_hash(data.get("frame")):
                    silo.click_hits.append((int(extra["x"]), int(extra["y"])))
                    if len(silo.click_hits) > 40:
                        silo.click_hits = silo.click_hits[-40:]
            if new_levels > last_levels:
                silo.note_progress(signature(data.get("frame")), name, extra)
                stall = 0
                last_levels = new_levels
                budget = min(budget + MAX_ACTIONS_BONUS, MAX_ACTIONS_BASE + 2 * MAX_ACTIONS_BONUS)
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


def learn_from_reference(client: Client) -> dict:
    card = LEARNED_FROM.rstrip("/").split("/")[-1]
    status, data = client.req("GET", "/api/scorecard/{0}".format(card))
    hint = {"http": status}
    if isinstance(data, dict):
        hint["score"] = data.get("score")
        hint["levels"] = data.get("total_levels_completed")
        hint["wins"] = data.get("total_environments_completed")
        hint["tags"] = data.get("tags")
        envs = data.get("environments") or []
        hint["env_count"] = len(envs)
        hint["titles"] = [e.get("title") or e.get("game_id") for e in envs[:25]]
    return hint


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    key = os.environ.get("ARC_API_KEY")
    if not key:
        raise SystemExit("ARC_API_KEY is not set")
    client = Client(key)

    learned = learn_from_reference(client)
    (OUT / "learned_from.json").write_text(json.dumps(learned, indent=2))
    print("LEARNED_FROM http={0} score={1} levels={2}".format(
        learned.get("http"), learned.get("score"), learned.get("levels")), flush=True)

    status, games = client.req("GET", "/api/games")
    if status != 200 or not isinstance(games, list):
        raise SystemExit("games list failed {0} {1}".format(status, games))
    games.sort(key=lambda g: (
        (g.get("baseline_actions") or [99])[0],
        sum(g.get("baseline_actions") or [99]),
    ))
    (OUT / "games.json").write_text(json.dumps(games, indent=2))

    status, opened = client.req("POST", "/api/scorecard/open", {
        "source_url": SOURCE_URL,
        "tags": [AGENT, "pmll", "persistence-in-memory", "competition"],
        "opaque": {
            "agent": AGENT,
            "method": "PMLL frame/action silo + sprite tracking + component clicks",
            "learned_from_scorecard": LEARNED_FROM,
            "learned_from_snapshot": learned,
        },
        "competition_mode": True,
    })
    if status != 200 or not isinstance(opened, dict) or not opened.get("card_id"):
        raise SystemExit("open failed {0} {1}".format(status, opened))
    card_id = opened["card_id"]
    print("OPENED", card_id, flush=True)
    (OUT / "card_id.txt").write_text(card_id)

    deadline = time.time() + DEADLINE_SEC
    silo = Silo()
    results = []
    for g in games:
        if time.time() >= deadline:
            break
        results.append(play_game(client, g, card_id, deadline, silo))
        (OUT / "results.json").write_text(json.dumps(results, indent=2))

    status, summary = client.req("POST", "/api/scorecard/close", {"card_id": card_id}, timeout=60)
    if status != 200:
        time.sleep(5)
        status, summary = client.req("GET", "/api/scorecard/{0}".format(card_id), timeout=60)
    (OUT / "scorecard.json").write_text(json.dumps(summary, indent=2) if isinstance(summary, dict) else str(summary))
    (OUT / "silo.json").write_text(json.dumps({
        "tried": len(silo.tried),
        "progress_sigs": len(silo.progress),
        "moves": {str(k): v for k, v in silo.moves.items()},
        "click_hits": silo.click_hits[-20:],
    }, indent=2))
    print("CLOSE status", status, flush=True)
    if isinstance(summary, dict):
        print("SCORE", summary.get("score"),
              "levels", summary.get("total_levels_completed"), "/", summary.get("total_levels"),
              "wins", summary.get("total_environments_completed"),
              "actions", summary.get("total_actions"), flush=True)
    print("URL https://arcprize.org/scorecards/{0}".format(card_id), flush=True)


if __name__ == "__main__":
    main()
