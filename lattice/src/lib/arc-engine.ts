/** Local ARC-AGI-3 Full Play Test harness. Matches three.arcprize.org cmd protocol. */

export const GRID = 64;
export const ACTION_NAMES = [
  "RESET",
  "ACTION1",
  "ACTION2",
  "ACTION3",
  "ACTION4",
  "ACTION5",
  "ACTION6",
  "ACTION7",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];
export type GameState = "NOT_STARTED" | "NOT_FINISHED" | "WIN" | "GAME_OVER";

export const PALETTE = [
  "#000000",
  "#0074d9",
  "#ff4136",
  "#2ecc40",
  "#ffdc00",
  "#aaaaaa",
  "#f012be",
  "#ff851b",
  "#7fdbff",
  "#870c25",
  "#111111",
  "#f4f4f5",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#34495e",
];

export interface ActionInput {
  id: number;
  data: Record<string, number | string>;
}

export interface FrameResponse {
  game_id: string;
  guid: string;
  frame: number[][][];
  state: GameState;
  score: number;
  levels_completed: number;
  win_levels: number;
  action_input: ActionInput;
  available_actions: number[];
}

export interface GameInfo {
  game_id: string;
  title: string;
  summary: string;
  tags?: string[];
}

export interface Scorecard {
  card_id: string;
  tags: string[];
  opened_at: number;
  closed_at: number | null;
  games: Record<
    string,
    { guid: string; state: GameState; score: number; actions: number }
  >;
}

export interface PlayLog {
  step: number;
  action: ActionName;
  detail: string;
  state: GameState;
  score: number;
}

const GAMES: GameInfo[] = [
  {
    game_id: "bc01",
    title: "Beacon",
    summary: "Reach the green cell. ACTION1–4 move, ACTION6 click-steps, ACTION7 undo.",
  },
  {
    game_id: "lk02",
    title: "Latch",
    summary: "Stand on the key, press ACTION5, then walk onto the lock.",
  },
];

export function asLiveFrame(json: unknown, fallbackId = ""): FrameResponse {
  const d = (json ?? {}) as Record<string, unknown>;
  const frame = Array.isArray(d.frame) ? (d.frame as number[][][]) : [];
  const actions = Array.isArray(d.available_actions)
    ? (d.available_actions as number[])
    : [1, 2, 3, 4];
  const state = (typeof d.state === "string" ? d.state : "NOT_FINISHED") as GameState;
  return {
    game_id: typeof d.game_id === "string" ? d.game_id : fallbackId,
    guid: typeof d.guid === "string" ? d.guid : "",
    frame,
    state,
    score: typeof d.score === "number" ? d.score : 0,
    levels_completed: typeof d.levels_completed === "number" ? d.levels_completed : 0,
    win_levels: typeof d.win_levels === "number" ? d.win_levels : 1,
    action_input: (d.action_input as ActionInput) ?? { id: 0, data: {} },
    available_actions: actions,
  };
}

export function actionIndex(name: ActionName): number {
  if (name === "RESET") return 0;
  return Number(name.replace("ACTION", "")) || 0;
}

function emptyGrid(fill = 0): number[][] {
  return Array.from({ length: GRID }, () => new Array<number>(GRID).fill(fill));
}

function cloneGrid(g: number[][]): number[][] {
  return g.map((row) => row.slice());
}

function uid(prefix: string) {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return `${prefix}-${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

interface Session {
  guid: string;
  game_id: string;
  card_id: string;
  state: GameState;
  score: number;
  levels_completed: number;
  win_levels: number;
  px: number;
  py: number;
  gx: number;
  gy: number;
  keyed: boolean;
  grid: number[][];
  history: Array<{ grid: number[][]; px: number; py: number; keyed: boolean }>;
  actionId: number;
  actionsTaken: number;
}

function paintBeacon(s: Session) {
  const g = emptyGrid(0);
  const x0 = 8;
  const y0 = 10;
  const w = 13;
  const h = 9;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      g[y][x] = edge ? 5 : 10;
    }
  }
  for (let x = x0 + 4; x < x0 + 10; x++) g[y0 + 4][x] = 5;
  g[y0 + 4][x0 + 6] = 10;
  s.px = x0 + 2;
  s.py = y0 + 2;
  s.gx = x0 + w - 3;
  s.gy = y0 + h - 3;
  g[s.py][s.px] = 8;
  g[s.gy][s.gx] = 3;
  s.grid = g;
  s.keyed = false;
}

function paintLatch(s: Session) {
  const g = emptyGrid(0);
  const x0 = 10;
  const y0 = 12;
  const w = 15;
  const h = 9;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      g[y][x] = edge ? 5 : 10;
    }
  }
  s.px = x0 + 2;
  s.py = y0 + 4;
  s.gx = x0 + w - 3;
  s.gy = y0 + 4;
  g[s.py][s.px] = 8;
  g[y0 + 4][x0 + 6] = 4;
  g[s.gy][s.gx] = 2;
  s.grid = g;
  s.keyed = false;
}

function snapshot(s: Session) {
  s.history.push({
    grid: cloneGrid(s.grid),
    px: s.px,
    py: s.py,
    keyed: s.keyed,
  });
  if (s.history.length > 40) s.history.shift();
}

function paintActor(s: Session) {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (s.grid[y][x] === 8) s.grid[y][x] = 10;
    }
  }
  if (s.game_id === "lk02") {
    if (!s.keyed) {
      /* key cell restored if player left it */
    }
  }
  s.grid[s.py][s.px] = 8;
  if (s.game_id === "bc01") s.grid[s.gy][s.gx] = s.px === s.gx && s.py === s.gy ? 8 : 3;
  if (s.game_id === "lk02") {
    const keyX = 16;
    const keyY = 16;
    if (!(s.px === keyX && s.py === keyY) && !s.keyed) s.grid[keyY][keyX] = 4;
    if (!(s.px === s.gx && s.py === s.gy)) s.grid[s.gy][s.gx] = s.keyed ? 3 : 2;
  }
}

const DELTA: Record<number, [number, number]> = {
  1: [0, -1],
  2: [0, 1],
  3: [-1, 0],
  4: [1, 0],
};

function walkable(s: Session, x: number, y: number) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false;
  const c = s.grid[y][x];
  return c !== 5;
}

function tryMove(s: Session, dx: number, dy: number): boolean {
  const nx = s.px + dx;
  const ny = s.py + dy;
  if (!walkable(s, nx, ny)) return false;
  snapshot(s);
  s.px = nx;
  s.py = ny;
  paintActor(s);
  return true;
}

function checkWin(s: Session) {
  if (s.game_id === "bc01" && s.px === s.gx && s.py === s.gy) {
    s.state = "WIN";
    s.levels_completed = 1;
    s.score = 1;
  }
  if (s.game_id === "lk02" && s.keyed && s.px === s.gx && s.py === s.gy) {
    s.state = "WIN";
    s.levels_completed = 1;
    s.score = 1;
  }
}

function respond(s: Session, action: ActionName, extra: Record<string, number | string> = {}): FrameResponse {
  s.actionId += 1;
  return {
    game_id: s.game_id,
    guid: s.guid,
    frame: [cloneGrid(s.grid)],
    state: s.state,
    score: s.score,
    levels_completed: s.levels_completed,
    win_levels: s.win_levels,
    action_input: { id: s.actionId, data: { action, ...extra } },
    available_actions: s.state === "NOT_FINISHED" ? [1, 2, 3, 4, 5, 6, 7] : [],
  };
}

export class ArcHarness {
  scorecard: Scorecard | null = null;
  session: Session | null = null;
  log: PlayLog[] = [];

  listGames(): GameInfo[] {
    return GAMES.slice();
  }

  openScorecard(tags: string[] = ["lattice", "full-play-test"]): Scorecard {
    this.scorecard = {
      card_id: uid("card"),
      tags,
      opened_at: Date.now(),
      closed_at: null,
      games: {},
    };
    this.log = [];
    this.note("RESET", "scorecard opened", "NOT_STARTED", 0);
    return this.scorecard;
  }

  closeScorecard(): Scorecard {
    if (!this.scorecard) throw new Error("no scorecard");
    this.scorecard.closed_at = Date.now();
    if (this.session) this.recordGame();
    return this.scorecard;
  }

  reset(game_id: string): FrameResponse {
    if (!this.scorecard) this.openScorecard();
    if (!this.scorecard) throw new Error("no scorecard");
    if (this.session) this.recordGame();
    const game = GAMES.find((g) => g.game_id === game_id) ?? GAMES[0];
    const s: Session = {
      guid: uid("guid"),
      game_id: game.game_id,
      card_id: this.scorecard.card_id,
      state: "NOT_FINISHED",
      score: 0,
      levels_completed: 0,
      win_levels: 1,
      px: 0,
      py: 0,
      gx: 0,
      gy: 0,
      keyed: false,
      grid: emptyGrid(),
      history: [],
      actionId: 0,
      actionsTaken: 0,
    };
    if (game.game_id === "lk02") paintLatch(s);
    else paintBeacon(s);
    this.session = s;
    this.note("RESET", `${game.game_id} guid=${s.guid}`, s.state, 0);
    return respond(s, "RESET");
  }

  cmd(action: ActionName, xy?: { x: number; y: number }): FrameResponse {
    const s = this.session;
    if (!s) throw new Error("no session — RESET first");
    if (action === "RESET") return this.reset(s.game_id);
    if (s.state !== "NOT_FINISHED") {
      throw new Error("game ended — RESET is the only valid action");
    }
    s.actionsTaken += 1;
    let detail: string = action;
    if (action === "ACTION1" || action === "ACTION2" || action === "ACTION3" || action === "ACTION4") {
      const n = Number(action.slice(6));
      const [dx, dy] = DELTA[n];
      const ok = tryMove(s, dx, dy);
      detail = ok ? `${action} → (${s.px},${s.py})` : `${action} blocked`;
    } else if (action === "ACTION5") {
      if (s.game_id === "lk02" && s.px === 16 && s.py === 16) {
        snapshot(s);
        s.keyed = true;
        paintActor(s);
        detail = "ACTION5 picked key";
      } else {
        detail = "ACTION5 no-op";
      }
    } else if (action === "ACTION6") {
      const x = xy?.x ?? 0;
      const y = xy?.y ?? 0;
      const dx = Math.sign(x - s.px);
      const dy = Math.sign(y - s.py);
      const stepX = dx !== 0 && walkable(s, s.px + dx, s.py) ? dx : 0;
      const stepY = stepX === 0 && dy !== 0 && walkable(s, s.px, s.py + dy) ? dy : 0;
      if (stepX || stepY) tryMove(s, stepX, stepY);
      detail = `ACTION6 (${x},${y}) → (${s.px},${s.py})`;
    } else if (action === "ACTION7") {
      const prev = s.history.pop();
      if (prev) {
        s.grid = cloneGrid(prev.grid);
        s.px = prev.px;
        s.py = prev.py;
        s.keyed = prev.keyed;
        detail = "ACTION7 undo";
      } else {
        detail = "ACTION7 empty";
      }
    }
    checkWin(s);
    this.note(action, detail, s.state, s.score);
    return respond(s, action, xy ?? {});
  }

  solvePath(): ActionName[] {
    const s = this.session;
    if (!s) return [];
    const target = s.game_id === "lk02" && !s.keyed ? { x: 16, y: 16 } : { x: s.gx, y: s.gy };
    const start = `${s.px},${s.py}`;
    const q: Array<{ x: number; y: number; path: ActionName[] }> = [{ x: s.px, y: s.py, path: [] }];
    const seen = new Set([start]);
    const dirs: Array<[ActionName, number, number]> = [
      ["ACTION1", 0, -1],
      ["ACTION2", 0, 1],
      ["ACTION3", -1, 0],
      ["ACTION4", 1, 0],
    ];
    while (q.length) {
      const cur = q.shift()!;
      if (cur.x === target.x && cur.y === target.y) return cur.path;
      for (const [act, dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const k = `${nx},${ny}`;
        if (seen.has(k) || !walkable(s, nx, ny)) continue;
        seen.add(k);
        q.push({ x: nx, y: ny, path: [...cur.path, act] });
      }
    }
    return [];
  }

  pos() {
    return this.session ? { x: this.session.px, y: this.session.py } : { x: 0, y: 0 };
  }

  private recordGame() {
    const s = this.session;
    const card = this.scorecard;
    if (!s || !card) return;
    card.games[s.game_id] = {
      guid: s.guid,
      state: s.state,
      score: s.score,
      actions: s.actionsTaken,
    };
  }

  private note(action: ActionName, detail: string, state: GameState, score: number) {
    this.log.push({
      step: this.log.length + 1,
      action,
      detail,
      state,
      score,
    });
    if (this.log.length > 80) this.log.shift();
  }
}
