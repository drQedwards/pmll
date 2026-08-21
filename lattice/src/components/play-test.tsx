import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Anchor, ArrowLeft, Play, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArcHarness,
  GRID,
  PALETTE,
  actionIndex,
  type ActionName,
  type FrameResponse,
  type GameInfo,
  type PlayLog,
  type Scorecard,
} from "@/lib/arc-engine";
import { LiveArc } from "@/lib/arc-live";
import { composeEpisode } from "@/lib/pmll-anchor";
import { useAnchorStore } from "@/lib/anchor-store";
import { AnchorWin } from "@/components/anchor-win";

const ACTION_HINT: Record<number, string> = {
  1: "Up",
  2: "Down",
  3: "Left",
  4: "Right",
  5: "Use",
  6: "Click",
  7: "Undo",
};

function paintFrame(canvas: HTMLCanvasElement, frame: number[][]) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(css.width * dpr));
  const h = Math.max(1, Math.floor(css.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, w, h);

  let minX = GRID;
  let minY = GRID;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (frame[y][x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return;
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(GRID - 1, maxX + pad);
  maxY = Math.min(GRID - 1, maxY + pad);
  const gw = maxX - minX + 1;
  const gh = maxY - minY + 1;
  const cell = Math.max(1, Math.floor(Math.min(w / gw, h / gh)));
  const ox = Math.floor((w - cell * gw) / 2);
  const oy = Math.floor((h - cell * gh) / 2);
  const img = ctx.createImageData(cell * gw, cell * gh);
  const data = img.data;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const hex = PALETTE[frame[minY + y][minX + x] & 15] ?? PALETTE[0];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      for (let py = 0; py < cell; py++) {
        for (let px = 0; px < cell; px++) {
          const i = ((y * cell + py) * cell * gw + (x * cell + px)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, ox, oy);
  canvas.dataset.originX = String(minX);
  canvas.dataset.originY = String(minY);
  canvas.dataset.cell = String(cell);
  canvas.dataset.ox = String(ox);
  canvas.dataset.oy = String(oy);
  canvas.dataset.gw = String(gw);
}

export function PlayTest() {
  const harness = useRef(new ArcHarness());
  const liveRef = useRef(new LiveArc());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(true);
  const [games, setGames] = useState<GameInfo[]>(() => harness.current.listGames());
  const [gameId, setGameId] = useState("ls20");
  const [frame, setFrame] = useState<FrameResponse | null>(null);
  const frameRef = useRef<FrameResponse | null>(null);
  const [card, setCard] = useState<Scorecard | null>(null);
  const [log, setLog] = useState<PlayLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const store = useAnchorStore();
  const winOpen = useAnchorStore((s) => s.winOpen);
  const dismissWin = useAnchorStore((s) => s.dismissWin);
  frameRef.current = frame;

  const sync = useCallback((res: FrameResponse) => {
    setFrame(res);
    setCard(harness.current.scorecard);
    setLog(harness.current.log.slice());
    setError(null);
    const canvas = canvasRef.current;
    if (canvas && res.frame[0]) paintFrame(canvas, res.frame[0]);
  }, []);

  const sealWin = useCallback(
    async (res: FrameResponse) => {
      if (res.state !== "WIN") return;
      const payload = composeEpisode({
        agent: "lattice",
        skill: "ARC-AGI-3",
        nodeId: "arc-agi-3",
        title: "Full Play Test WIN",
        note: `game=${res.game_id} guid=${res.guid} score=${res.score} levels=${res.levels_completed}/${res.win_levels}`,
      });
      try {
        await store.store({ payload, nodeId: "arc-agi-3" });
      } catch {
        /* overlay still from store */
      }
    },
    [store],
  );

  const pushLog = useCallback((action: ActionName, detail: string, res: FrameResponse) => {
    setLog((prev) =>
      [
        ...prev,
        {
          step: prev.length + 1,
          action,
          detail,
          state: res.state,
          score: res.score,
        },
      ].slice(-80),
    );
  }, []);

  const send = useCallback(
    async (action: ActionName, xy?: { x: number; y: number }) => {
      try {
        setBusy(true);
        let res: FrameResponse;
        if (live) {
          const idx = actionIndex(action);
          if (
            action !== "RESET" &&
            frame?.available_actions?.length &&
            idx > 0 &&
            !frame.available_actions.includes(idx)
          ) {
            return null;
          }
          res = action === "RESET" ? await liveRef.current.reset(gameId) : await liveRef.current.cmd(action, xy);
          setCard({
            card_id: liveRef.current.cardId ?? "",
            tags: ["lattice", "full-play-test"],
            opened_at: Date.now(),
            closed_at: null,
            games: {},
          });
        } else {
          res = action === "RESET" ? harness.current.reset(gameId) : harness.current.cmd(action, xy);
          setCard(harness.current.scorecard);
          setLog(harness.current.log.slice());
        }
        sync(res);
        if (live) {
          const extra = xy ? ` (${xy.x},${xy.y})` : "";
          pushLog(action, `${action}${extra}`, res);
        }
        if (res.state === "WIN") await sealWin(res);
        return res;
      } catch (err) {
        setError(err instanceof Error ? err.message : "action failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [frame, gameId, live, pushLog, sealWin, sync],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const list = await liveRef.current.listGames();
        if (cancelled) return;
        setLive(true);
        setGames(list);
        const preferred =
          list.find((g) => g.game_id.startsWith("ls20"))?.game_id ?? list[0]?.game_id;
        if (!preferred) throw new Error("no games");
        setGameId(preferred);
        await liveRef.current.openScorecard();
        const res = await liveRef.current.reset(preferred);
        if (cancelled) return;
        setCard({
          card_id: liveRef.current.cardId ?? "",
          tags: ["lattice", "full-play-test"],
          opened_at: Date.now(),
          closed_at: null,
          games: {},
        });
        sync(res);
        pushLog("RESET", `${preferred} live`, res);
      } catch (err) {
        if (cancelled) return;
        setLive(false);
        const local = harness.current.listGames();
        setGames(local);
        const id = local[0]?.game_id ?? "bc01";
        setGameId(id);
        harness.current.openScorecard();
        sync(harness.current.reset(id));
        setError(err instanceof Error ? `${err.message} — sandbox` : "sandbox");
      } finally {
        if (!cancelled) {
          setBusy(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushLog, sync]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const map: Record<string, ActionName> = {
        KeyW: "ACTION1",
        ArrowUp: "ACTION1",
        KeyS: "ACTION2",
        ArrowDown: "ACTION2",
        KeyA: "ACTION3",
        ArrowLeft: "ACTION3",
        KeyD: "ACTION4",
        ArrowRight: "ACTION4",
        Space: "ACTION5",
        KeyF: "ACTION5",
      };
      if (ev.code in map) {
        ev.preventDefault();
        void send(map[ev.code]);
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyZ") {
        ev.preventDefault();
        void send("ACTION7");
      }
      if (ev.code === "KeyR" && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        void send("RESET");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const current = frameRef.current;
      if (current?.frame[0]) paintFrame(canvas, current.frame[0]);
    });
    ro.observe(canvas);
    const onClick = (ev: PointerEvent) => {
      const current = frameRef.current;
      if (!current || current.state !== "NOT_FINISHED") return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const originX = Number(canvas.dataset.originX ?? 0);
      const originY = Number(canvas.dataset.originY ?? 0);
      const cell = Number(canvas.dataset.cell ?? 1);
      const ox = Number(canvas.dataset.ox ?? 0);
      const oy = Number(canvas.dataset.oy ?? 0);
      const px = (ev.clientX - rect.left) * dpr;
      const py = (ev.clientY - rect.top) * dpr;
      const x = originX + Math.floor((px - ox) / cell);
      const y = originY + Math.floor((py - oy) / cell);
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
      void send("ACTION6", { x, y });
    };
    canvas.addEventListener("pointerdown", onClick);
    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, [send]);
  useEffect(() => {
    const h = harness.current;
    window.__controlsTest = {
      getPos: () => h.pos(),
      setKeys: async (codes: string[]) => {
        const map: Record<string, ActionName> = {
          KeyA: "ACTION3",
          ArrowLeft: "ACTION3",
          KeyD: "ACTION4",
          ArrowRight: "ACTION4",
          KeyW: "ACTION1",
          KeyS: "ACTION2",
        };
        for (const c of codes) {
          const a = map[c];
          if (a) await send(a);
        }
      },
    };
    return () => {
      delete window.__controlsTest;
    };
  }, [send]);

  const runRandom = async () => {
    setBusy(true);
    try {
      let res = await send("RESET");
      const acts: ActionName[] = [
        "ACTION1",
        "ACTION2",
        "ACTION3",
        "ACTION4",
        "ACTION5",
        "ACTION6",
        "ACTION7",
      ];
      for (let i = 0; i < 5; i++) {
        if (!res || res.state === "WIN" || res.state === "GAME_OVER") break;
        await new Promise((r) => setTimeout(r, 280));
        const action = acts[Math.floor(Math.random() * acts.length)];
        const xy = action === "ACTION6" ? { x: 12 + i, y: 12 } : undefined;
        res = await send(action, xy);
      }
      if (live) {
        try {
          await liveRef.current.closeScorecard();
        } catch {
          /* already closed or no card */
        }
        setCard((c) => (c ? { ...c, closed_at: Date.now() } : c));
      } else {
        harness.current.closeScorecard();
        setCard({ ...harness.current.scorecard! });
      }
    } finally {
      setBusy(false);
    }
  };

  const runSolve = async () => {
    setBusy(true);
    try {
      let res = frame;
      if (!res || res.state !== "NOT_FINISHED") res = await send("RESET");
      for (let n = 0; n < 80; n++) {
        const s = harness.current.session;
        if (!s || s.state !== "NOT_FINISHED") break;
        if (s.game_id === "lk02" && !s.keyed && s.px === 16 && s.py === 16) {
          res = await send("ACTION5");
          await new Promise((r) => setTimeout(r, 90));
          continue;
        }
        const path = harness.current.solvePath();
        if (!path.length) break;
        res = await send(path[0]);
        await new Promise((r) => setTimeout(r, 90));
      }
    } finally {
      setBusy(false);
    }
  };

  const state = frame?.state ?? "NOT_STARTED";

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      <header className="flex shrink-0 items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            ARC-AGI-3 · {live ? "Live" : "Sandbox"}
          </p>
          <h1 className="font-display text-xl leading-tight text-fg sm:text-2xl">Play</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild>
            <Link to="/">
              <ArrowLeft />
              Lattice
            </Link>
          </Button>
          <Button type="button" onClick={() => void send("RESET")} disabled={busy || !ready}>
            <RotateCcw />
            Reset
          </Button>
          {!live ? (
            <Button type="button" variant="primary" onClick={() => void runSolve()} disabled={busy}>
              <Play />
              Solve to win
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-[minmax(0,1fr)_22rem] sm:p-4 sm:pt-0">
        <div className="relative min-h-[42vh] overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-panel)] sm:min-h-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 size-full touch-none"
            aria-label="ARC-AGI-3 game frame"
          />
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
          <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-panel)]">
            <label className="text-xs text-subtle" htmlFor="game-id">
              Game
            </label>
            <select
              id="game-id"
              value={gameId}
              onChange={(e) => {
                const id = e.target.value;
                setGameId(id);
                void (async () => {
                  try {
                    setBusy(true);
                    if (live) {
                      liveRef.current.guid = null;
                      const res = await liveRef.current.reset(id);
                      sync(res);
                      pushLog("RESET", id, res);
                    } else {
                      sync(harness.current.reset(id));
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "reset failed");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="mt-1 h-11 w-full rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none"
            >
              {games.map((g) => (
                <option key={g.game_id} value={g.game_id}>
                  {g.game_id} — {g.title}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm leading-snug text-muted">
              {games.find((g) => g.game_id === gameId)?.summary}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-subtle">state</dt>
                <dd className="font-mono text-fg">{state}</dd>
              </div>
              <div>
                <dt className="text-subtle">score</dt>
                <dd className="font-mono text-fg tabular-nums">{frame?.score ?? 0}</dd>
              </div>
              <div>
                <dt className="text-subtle">levels</dt>
                <dd className="font-mono text-fg tabular-nums">
                  {frame?.levels_completed ?? 0}/{frame?.win_levels ?? 1}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">card</dt>
                <dd className="truncate font-mono text-fg">{card?.card_id ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-medium tracking-wide text-subtle uppercase">Actions</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([1, 2, 3, 4, 5, 7] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  disabled={
                    busy ||
                    !ready ||
                    state !== "NOT_FINISHED" ||
                    (frame?.available_actions?.length ? !frame.available_actions.includes(n) : false)
                  }
                  onClick={() => void send(`ACTION${n}` as ActionName)}
                >
                  {n === 7 ? <Undo2 /> : null}
                  {ACTION_HINT[n]}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-subtle">WASD / arrows · Space use · click ACTION6 · R reset</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void runRandom()} disabled={busy}>
                Random agent
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      if (live) await liveRef.current.closeScorecard();
                      else harness.current.closeScorecard();
                      setCard((c) => (c ? { ...c, closed_at: Date.now() } : c));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "close failed");
                    }
                  })();
                }}
                disabled={!card || card.closed_at != null}
              >
                Close scorecard
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 rounded-xl bg-surface p-4 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-medium tracking-wide text-subtle uppercase">Log</p>
            <ol className="mt-2 max-h-48 space-y-1 overflow-auto font-mono text-xs text-muted sm:max-h-none">
              {log.slice(-16).map((row) => (
                <li key={row.step} className="flex justify-between gap-2">
                  <span className={cn(row.state === "WIN" ? "text-fg" : "")}>{row.detail}</span>
                  <span className="shrink-0 text-subtle">{row.state}</span>
                </li>
              ))}
            </ol>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          </div>
        </aside>
      </div>

      {winOpen ? (
        <AnchorWin onContinue={dismissWin} />
      ) : state === "WIN" && !winOpen ? (
        <div className="pointer-events-none absolute top-20 right-4 rounded-md bg-surface px-3 py-2 text-xs text-muted shadow-[var(--shadow-panel)]">
          <Anchor className="mr-1 inline size-3.5" />
          WIN sealed to PMLL
        </div>
      ) : null}
    </div>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getPos: () => { x: number; y: number };
      setKeys: (codes: string[]) => void | Promise<void>;
    };
  }
}
