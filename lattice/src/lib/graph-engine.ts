import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import {
  EDGES,
  EDGE_META,
  KIND_META,
  NODES,
  type EdgeKind,
  type NodeKind,
  type SkillNode,
} from "./graph-data";

export interface SimNode extends SimulationNodeDatum, SkillNode {
  r: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  kind: EdgeKind;
  weight: number;
}

export interface EngineCallbacks {
  onSelect: (node: SimNode | null) => void;
  onHover: (node: SimNode | null) => void;
  onFrozenChange: (frozen: boolean) => void;
  onMatches: (nodes: SimNode[]) => void;
  onTickMeta: (meta: { alpha: number; frozen: boolean }) => void;
}

const CLUSTER_X: Record<NodeKind, number> = {
  hub: 0,
  core: -160,
  community: 170,
  pmll: 20,
  memory: 70,
  protocol: -150,
};

const CLUSTER_Y: Record<NodeKind, number> = {
  hub: -10,
  core: -30,
  community: 20,
  pmll: 90,
  memory: 150,
  protocol: 110,
};

function mulberry32(seed: number) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export class GraphEngine {
  readonly canvas: HTMLCanvasElement;
  readonly nodes: SimNode[];
  readonly links: SimLink[];
  private sim: Simulation<SimNode, SimLink>;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private x = 0;
  private y = 0;
  private k = 1;
  private frozen = false;
  private raf = 0;
  private needsDraw = true;
  private ticks = 0;
  private fitted = false;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private matchIds = new Set<string>();
  private query = "";
  private dragging: SimNode | null = null;
  private panning = false;
  private moved = false;
  private lastPx = 0;
  private lastPy = 0;
  private downPx = 0;
  private downPy = 0;
  private lastTap = 0;
  private lastTapId: string | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchStartK = 1;
  private pinchMidX = 0;
  private pinchMidY = 0;
  private camFrom = { x: 0, y: 0, k: 1 };
  private camTo = { x: 0, y: 0, k: 1 };
  private camT = 1;
  private camDur = 250;
  private camStart = 0;
  private reduceMotion = false;
  private anchoredIds = new Set<string>();
  private sealId: string | null = null;
  private sealUntil = 0;
  private frameNow = 0;
  private colors = {
    bg: "#0a0a0b",
    fg: "#f4f4f5",
    muted: "#a1a1aa",
    subtle: "#71717a",
    accent: "#c8ccd4",
  };
  private readonly cb: EngineCallbacks;
  private readonly ro: ResizeObserver;
  private boundFrame: (t: number) => void;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.cb = callbacks;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rng = mulberry32(20260821);
    this.nodes = NODES.map((n) => {
      const r = KIND_META[n.kind].radius;
      return {
        ...n,
        r,
        x: CLUSTER_X[n.kind] + (rng() - 0.5) * 140,
        y: CLUSTER_Y[n.kind] + (rng() - 0.5) * 110,
        vx: 0,
        vy: 0,
      };
    });
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = EDGES.filter((e) => byId.has(e.source) && byId.has(e.target)).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      kind: e.kind,
      weight: e.weight,
    }));

    this.sim = forceSimulation(this.nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(this.links)
          .id((d) => d.id)
          .distance((d) => {
            const s = this.refNode(d.source);
            const t = this.refNode(d.target);
            const extra = d.kind === "contains" ? 10 : d.kind === "similar_to" ? -6 : 0;
            return 28 + (s?.r ?? 8) + (t?.r ?? 8) + extra;
          })
          .strength((d) => 0.35 + d.weight * 0.15),
      )
      .force(
        "charge",
        forceManyBody<SimNode>().strength((d) => {
          if (d.kind === "hub") return -520;
          if (d.kind === "pmll") return -380;
          if (d.kind === "core") return -220;
          return -140;
        }),
      )
      .force("collide", forceCollide<SimNode>().radius((d) => d.r + 10).iterations(2))
      .force("x", forceX<SimNode>((d) => CLUSTER_X[d.kind]).strength(0.055))
      .force("y", forceY<SimNode>((d) => CLUSTER_Y[d.kind]).strength(0.055))
      .force("center", forceCenter(0, 0).strength(0.03))
      .alphaDecay(0.022)
      .velocityDecay(0.32);

    this.sim.on("tick", () => {
      this.ticks += 1;
      if (!this.fitted && this.ticks === 24) {
        this.fit({ animate: false });
        this.fitted = true;
      }
      this.needsDraw = true;
      this.cb.onTickMeta({ alpha: this.sim.alpha(), frozen: this.frozen });
      this.schedule();
    });

    this.boundFrame = this.frame.bind(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("dblclick", this.onDblClick);
    canvas.style.touchAction = "none";
  }

  start() {
    this.readColors();
    this.resize();
    this.sim.alpha(1).restart();
    this.schedule();
  }

  destroy() {
    this.sim.stop();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("dblclick", this.onDblClick);
  }

  reheat() {
    this.frozen = false;
    this.sim.alpha(0.9).alphaTarget(0).restart();
    this.cb.onFrozenChange(false);
    this.cb.onTickMeta({ alpha: this.sim.alpha(), frozen: false });
    this.needsDraw = true;
    this.schedule();
  }

  freeze() {
    this.frozen = true;
    this.sim.stop();
    this.cb.onFrozenChange(true);
    this.cb.onTickMeta({ alpha: 0, frozen: true });
    this.needsDraw = true;
    this.schedule();
  }

  isFrozen() {
    return this.frozen;
  }

  unpinAll() {
    for (const n of this.nodes) {
      n.fx = undefined;
      n.fy = undefined;
    }
    if (!this.frozen) this.reheat();
    else {
      this.needsDraw = true;
      this.schedule();
    }
  }

  setQuery(raw: string) {
    this.query = raw.trim().toLowerCase();
    this.matchIds.clear();
    const hits: SimNode[] = [];
    if (this.query) {
      for (const n of this.nodes) {
        const hay =
          `${n.label} ${n.title} ${n.summary} ${n.owner ?? ""} ${n.tags.join(" ")} ${n.kind}`.toLowerCase();
        if (hay.includes(this.query)) {
          this.matchIds.add(n.id);
          hits.push(n);
        }
      }
    }
    this.cb.onMatches(hits);
    this.needsDraw = true;
    this.schedule();
    if (hits.length === 1) this.focusNode(hits[0].id);
    else if (hits.length > 1) this.fitTo(hits, true);
  }

  select(id: string | null) {
    this.selectedId = id;
    const node = id ? (this.nodes.find((n) => n.id === id) ?? null) : null;
    this.cb.onSelect(node);
    this.needsDraw = true;
    this.schedule();
  }

  focusNode(id: string) {
    const n = this.nodes.find((x) => x.id === id);
    if (!n || n.x == null || n.y == null) return;
    this.select(id);
    const targetK = clamp(this.k < 1.1 ? 1.35 : this.k, 0.8, 2.2);
    const tx = this.width / 2 - n.x * targetK;
    const ty = this.height / 2 - n.y * targetK;
    this.animateCam(tx, ty, targetK);
  }

  setAnchored(ids: Iterable<string>) {
    this.anchoredIds = new Set(ids);
    this.needsDraw = true;
    this.schedule();
  }

  seal(id: string) {
    const target = this.nodes.some((n) => n.id === id) ? id : "pmll";
    this.anchoredIds.add(target);
    this.sealId = target;
    this.sealUntil = performance.now() + 2800;
    this.focusNode(target);
    if (!this.frozen) this.sim.alpha(0.32).restart();
    this.needsDraw = true;
    this.schedule();
  }

  fit(opts: { animate?: boolean } = {}) {
    this.fitTo(this.nodes, opts.animate ?? true);
  }

  private fitTo(nodes: SimNode[], animate: boolean) {
    if (!nodes.length || this.width < 8) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - n.r);
      minY = Math.min(minY, n.y - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    if (!Number.isFinite(minX)) return;
    const pad = 72;
    const bw = Math.max(40, maxX - minX);
    const bh = Math.max(40, maxY - minY);
    const k = clamp(
      Math.min((this.width - pad * 2) / bw, (this.height - pad * 2) / bh),
      0.25,
      2.4,
    );
    const tx = (this.width - bw * k) / 2 - minX * k;
    const ty = (this.height - bh * k) / 2 - minY * k;
    if (animate) this.animateCam(tx, ty, k);
    else {
      this.x = tx;
      this.y = ty;
      this.k = k;
      this.needsDraw = true;
    }
  }

  private animateCam(tx: number, ty: number, tk: number) {
    if (this.reduceMotion) {
      this.x = tx;
      this.y = ty;
      this.k = tk;
      this.camT = 1;
      this.needsDraw = true;
      this.schedule();
      return;
    }
    this.camFrom = { x: this.x, y: this.y, k: this.k };
    this.camTo = { x: tx, y: ty, k: tk };
    this.camT = 0;
    this.camStart = performance.now();
    this.camDur = 280;
    this.schedule();
  }

  private readColors() {
    const s = getComputedStyle(this.canvas);
    const pick = (name: string, fb: string) => {
      const v = s.getPropertyValue(name).trim();
      return v || fb;
    };
    this.colors = {
      bg: pick("--color-bg", "#0a0a0b"),
      fg: pick("--color-fg", "#f4f4f5"),
      muted: pick("--color-muted", "#a1a1aa"),
      subtle: pick("--color-subtle", "#71717a"),
      accent: pick("--color-accent", "#c8ccd4"),
    };
  }

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.needsDraw = true;
    this.schedule();
  }

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(this.boundFrame);
  }

  private frame(now: number) {
    this.raf = 0;
    this.frameNow = now;
    if (this.camT < 1) {
      const u = clamp((now - this.camStart) / this.camDur, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      this.x = this.camFrom.x + (this.camTo.x - this.camFrom.x) * e;
      this.y = this.camFrom.y + (this.camTo.y - this.camFrom.y) * e;
      this.k = this.camFrom.k + (this.camTo.k - this.camFrom.k) * e;
      this.camT = u;
      this.needsDraw = true;
    }
    if (now < this.sealUntil) this.needsDraw = true;
    if (this.needsDraw) {
      this.draw();
      this.needsDraw = false;
    }
    const running = !this.frozen && this.sim.alpha() > this.sim.alphaMin();
    if (running || this.camT < 1 || this.dragging || this.panning || now < this.sealUntil) {
      this.schedule();
    }
  }

  private screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.x) / this.k, y: (sy - this.y) / this.k };
  }

  private hit(sx: number, sy: number): SimNode | null {
    const w = this.screenToWorld(sx, sy);
    const slop = 6 / this.k;
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (n.x == null || n.y == null) continue;
      const dx = n.x - w.x;
      const dy = n.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d <= n.r + slop && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  private eventPos(ev: PointerEvent | WheelEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  private onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    this.canvas.setPointerCapture(ev.pointerId);
    const p = this.eventPos(ev);
    this.pointers.set(ev.pointerId, p);
    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchStartK = this.k;
      this.pinchMidX = (pts[0].x + pts[1].x) / 2;
      this.pinchMidY = (pts[0].y + pts[1].y) / 2;
      this.dragging = null;
      this.panning = false;
      return;
    }
    const node = this.hit(p.x, p.y);
    this.downPx = p.x;
    this.downPy = p.y;
    this.lastPx = p.x;
    this.lastPy = p.y;
    this.moved = false;
    if (node) {
      this.dragging = node;
      node.fx = node.x;
      node.fy = node.y;
      if (!this.frozen) this.sim.alphaTarget(0.22).restart();
    } else {
      this.panning = true;
    }
    this.schedule();
  };

  private onPointerMove = (ev: PointerEvent) => {
    const p = this.eventPos(ev);
    if (this.pointers.has(ev.pointerId)) this.pointers.set(ev.pointerId, p);

    if (this.pointers.size === 2 && this.pinchStartDist > 0) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const scale = dist / this.pinchStartDist;
      this.zoomAt(this.pinchMidX, this.pinchMidY, this.pinchStartK * scale);
      this.x += midX - this.pinchMidX;
      this.y += midY - this.pinchMidY;
      this.pinchMidX = midX;
      this.pinchMidY = midY;
      this.needsDraw = true;
      this.schedule();
      return;
    }

    if (this.dragging) {
      if (Math.hypot(p.x - this.downPx, p.y - this.downPy) > 3) this.moved = true;
      const w = this.screenToWorld(p.x, p.y);
      this.dragging.fx = w.x;
      this.dragging.fy = w.y;
      this.dragging.x = w.x;
      this.dragging.y = w.y;
      this.needsDraw = true;
      this.schedule();
      return;
    }
    if (this.panning) {
      const dx = p.x - this.lastPx;
      const dy = p.y - this.lastPy;
      if (Math.hypot(p.x - this.downPx, p.y - this.downPy) > 3) this.moved = true;
      this.x += dx;
      this.y += dy;
      this.lastPx = p.x;
      this.lastPy = p.y;
      this.needsDraw = true;
      this.schedule();
      return;
    }
    const node = this.hit(p.x, p.y);
    const id = node?.id ?? null;
    if (id !== this.hoveredId) {
      this.hoveredId = id;
      this.cb.onHover(node);
      this.canvas.style.cursor = node ? "grab" : "grab";
      this.needsDraw = true;
      this.schedule();
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinchStartDist = 0;
    if (this.dragging) {
      if (!this.frozen) this.sim.alphaTarget(0);
      const node = this.dragging;
      this.dragging = null;
      if (!this.moved) {
        const now = performance.now();
        if (this.lastTapId === node.id && now - this.lastTap < 320) {
          node.fx = undefined;
          node.fy = undefined;
          if (!this.frozen) this.sim.alpha(0.4).restart();
        } else {
          this.select(node.id);
        }
        this.lastTap = now;
        this.lastTapId = node.id;
      }
      this.needsDraw = true;
      this.schedule();
      return;
    }
    if (this.panning) {
      this.panning = false;
      if (!this.moved) this.select(null);
      this.needsDraw = true;
      this.schedule();
    }
  };

  private onDblClick = (ev: MouseEvent) => {
    const p = this.eventPos(ev as unknown as PointerEvent);
    const node = this.hit(p.x, p.y);
    if (node) {
      node.fx = undefined;
      node.fy = undefined;
      if (!this.frozen) this.sim.alpha(0.5).restart();
      this.needsDraw = true;
      this.schedule();
    } else {
      this.fit({ animate: true });
    }
  };

  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const p = this.eventPos(ev);
    const delta = ev.deltaY;
    const zoom = Math.exp(-delta * 0.0016);
    this.zoomAt(p.x, p.y, this.k * zoom);
    this.needsDraw = true;
    this.schedule();
  };

  private zoomAt(sx: number, sy: number, nextK: number) {
    const k = clamp(nextK, 0.18, 5.5);
    const wx = (sx - this.x) / this.k;
    const wy = (sy - this.y) / this.k;
    this.k = k;
    this.x = sx - wx * k;
    this.y = sy - wy * k;
  }

  private draw() {
    const { ctx, dpr, width, height, k, x, y, colors } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);

    const searching = this.matchIds.size > 0;
    const selected = this.selectedId;
    const hovered = this.hoveredId;

    const dimOf = (id: string) => {
      if (searching && !this.matchIds.has(id) && id !== selected && id !== hovered) return 0.12;
      if (selected && id !== selected && id !== hovered && !this.isNeighbor(selected, id)) return 0.22;
      return 1;
    };

    for (const link of this.links) {
      const s = this.refNode(link.source);
      const t = this.refNode(link.target);
      if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;
      const dim = Math.min(dimOf(s.id), dimOf(t.id));
      const involved =
        selected === s.id ||
        selected === t.id ||
        hovered === s.id ||
        hovered === t.id ||
        (searching && this.matchIds.has(s.id) && this.matchIds.has(t.id));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = involved
        ? `rgba(200, 204, 212, ${0.55 * dim})`
        : `rgba(200, 204, 212, ${0.16 * dim})`;
      ctx.lineWidth = ((involved ? 1.35 : 0.85) * (0.7 + link.weight * 0.3)) / k;
      if (link.kind === "similar_to") ctx.setLineDash([4 / k, 4 / k]);
      else if (link.kind === "implements") ctx.setLineDash([7 / k, 4 / k]);
      else if (link.kind === "references") ctx.setLineDash([10 / k, 5 / k]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const n of this.nodes) {
      if (n.x == null || n.y == null) continue;
      const dim = dimOf(n.id);
      const isSel = n.id === selected;
      const isHov = n.id === hovered;
      const isMatch = this.matchIds.has(n.id);
      const fillA = KIND_META[n.kind].fill * dim;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.kind === "pmll") {
        ctx.fillStyle = `rgba(232, 234, 238, ${0.92 * dim})`;
      } else if (n.kind === "hub") {
        ctx.fillStyle = `rgba(244, 244, 245, ${fillA})`;
      } else {
        ctx.fillStyle = `rgba(200, 204, 212, ${fillA})`;
      }
      ctx.fill();

      if (isSel || isHov || isMatch || n.kind === "pmll" || n.kind === "hub") {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3 / k, 0, Math.PI * 2);
        ctx.strokeStyle = isMatch || isSel || n.kind === "pmll"
          ? `rgba(232, 234, 238, ${0.9 * dim})`
          : `rgba(200, 204, 212, ${0.45 * dim})`;
        ctx.lineWidth = (isSel || isMatch ? 2 : 1.15) / k;
        ctx.stroke();
      }

      if (n.fx != null && n.fy != null) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6 / k, 0, Math.PI * 2);
        ctx.fillStyle = colors.bg;
        ctx.fill();
      }

      if (this.anchoredIds.has(n.id)) {
        const t = this.frameNow || performance.now();
        const sealing = n.id === this.sealId && t < this.sealUntil;
        const pulse = this.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t / 380);
        const burst = sealing ? ((this.sealUntil - t) / 2800) * 16 : 0;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (5 + pulse * 3.5 + burst) / k, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232, 234, 238, ${(0.28 + pulse * 0.42) * dim})`;
        ctx.lineWidth = (1.5 + pulse * 0.8) / k;
        ctx.stroke();
        if (sealing && !this.reduceMotion) {
          const u = 1 - (this.sealUntil - t) / 2800;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + (8 + u * 22) / k, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(232, 234, 238, ${Math.max(0, 0.45 * (1 - u))})`;
          ctx.lineWidth = 1.2 / k;
          ctx.stroke();
        }
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `500 ${12}px ${getComputedStyle(this.canvas).fontFamily || "IBM Plex Sans, sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const showAllLabels = k > 1.65;
    for (const n of this.nodes) {
      if (n.x == null || n.y == null) continue;
      const isSel = n.id === selected;
      const isHov = n.id === hovered;
      const isMatch = this.matchIds.has(n.id);
      const important =
        n.kind === "hub" || n.kind === "pmll" || (n.kind === "core" && k > 0.72);
      if (!(isSel || isHov || isMatch || important || showAllLabels)) continue;
      if (searching && !isMatch && !isSel && !isHov) continue;
      const sx = n.x * k + x;
      const sy = n.y * k + y + n.r * k + 6;
      if (sx < -40 || sx > width + 40 || sy < -20 || sy > height + 20) continue;
      const label = n.label;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(10, 10, 11, 0.85)";
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = isSel || isMatch || n.kind === "pmll" ? colors.fg : colors.muted;
      ctx.fillText(label, sx, sy);
    }

    const showEdgeLabels = k > 1.05 || selected || hovered;
    if (showEdgeLabels) {
      ctx.font = `500 ${10}px ${getComputedStyle(this.canvas).fontFamily || "IBM Plex Sans, sans-serif"}`;
      ctx.textBaseline = "middle";
      for (const link of this.links) {
        const s = this.refNode(link.source);
        const t = this.refNode(link.target);
        if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;
        const involved =
          selected === s.id ||
          selected === t.id ||
          hovered === s.id ||
          hovered === t.id;
        if (!involved && k < 1.45) continue;
        const mx = ((s.x + t.x) / 2) * k + x;
        const my = ((s.y + t.y) / 2) * k + y;
        const screenLen = Math.hypot((t.x - s.x) * k, (t.y - s.y) * k);
        if (screenLen < 56) continue;
        const text = EDGE_META[link.kind].label;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(10, 10, 11, 0.78)";
        ctx.beginPath();
        const rr = 3;
        const bw = tw + 8;
        const bh = 14;
        ctx.roundRect(mx - bw / 2, my - bh / 2, bw, bh, rr);
        ctx.fill();
        ctx.fillStyle = involved ? colors.fg : colors.subtle;
        ctx.fillText(text, mx, my);
      }
    }
  }

  private refNode(ref: string | number | SimNode | undefined): SimNode | null {
    if (ref == null) return null;
    if (typeof ref === "number") return this.nodes[ref] ?? null;
    if (typeof ref === "string") return this.nodes.find((n) => n.id === ref) ?? null;
    return ref;
  }

  private isNeighbor(id: string, other: string) {
    for (const link of this.links) {
      const s = this.refNode(link.source);
      const t = this.refNode(link.target);
      if (!s || !t) continue;
      if ((s.id === id && t.id === other) || (t.id === id && s.id === other)) return true;
    }
    return false;
  }
}
