import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Flame,
  Lock,
  Maximize,
  PinOff,
  Search,
  X,
  ExternalLink,
  Pause,
  Anchor,
  Play,
} from "lucide-react";
import { GraphEngine, type SimNode } from "@/lib/graph-engine";
import {
  EDGES,
  KIND_META,
  NODES,
  neighborsOf,
  type NodeKind,
  type SkillNode,
} from "@/lib/graph-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnchorDesk } from "@/components/anchor-desk";
import { AnchorWin } from "@/components/anchor-win";
import { anchorsForNode, useAnchorStore } from "@/lib/anchor-store";

const KIND_ORDER: NodeKind[] = ["hub", "core", "pmll", "community", "memory", "protocol"];

export function GraphApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const alphaRef = useRef<HTMLSpanElement>(null);

  const [selected, setSelected] = useState<SimNode | null>(null);
  const [hovered, setHovered] = useState<SimNode | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SimNode[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const anchored = useAnchorStore((s) => s.entries);
  const lastWin = useAnchorStore((s) => s.lastWin);
  const winOpen = useAnchorStore((s) => s.winOpen);
  const dismissWin = useAnchorStore((s) => s.dismissWin);
  const replayWin = useAnchorStore((s) => s.replayWin);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GraphEngine(canvas, {
      onSelect: setSelected,
      onHover: setHovered,
      onFrozenChange: setFrozen,
      onMatches: (nodes) => {
        setMatches(nodes);
        setResultsOpen(nodes.length > 0);
      },
      onTickMeta: ({ alpha, frozen: isFrozen }) => {
        const el = alphaRef.current;
        if (!el) return;
        el.textContent = isFrozen ? "frozen" : alpha.toFixed(3);
      },
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setQuery(query);
  }, [query]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const row of Object.values(anchored)) {
      if (row.nodeId) ids.add(row.nodeId);
    }
    if (ids.size === 0 && lastWin) ids.add(lastWin.nodeId ?? "pmll");
    engineRef.current?.setAnchored(ids);
  }, [anchored, lastWin]);

  useEffect(() => {
    if (!winOpen || !lastWin) return;
    engineRef.current?.seal(lastWin.nodeId ?? "pmll");
  }, [winOpen, lastWin]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (ev.key === "Escape") {
        if (winOpen) {
          dismissWin();
          return;
        }
        if (deskOpen) {
          setDeskOpen(false);
          return;
        }
        if (query) {
          setQuery("");
          setResultsOpen(false);
          return;
        }
        engineRef.current?.select(null);
        return;
      }
      if ((ev.key === "/" || (ev.key === "k" && (ev.metaKey || ev.ctrlKey))) && !typing) {
        ev.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (ev.key === "r") engineRef.current?.reheat();
      if (ev.key === "f") {
        const eng = engineRef.current;
        if (!eng) return;
        if (eng.isFrozen()) eng.reheat();
        else eng.freeze();
      }
      if (ev.key === "0") engineRef.current?.fit({ animate: true });
      if (ev.key === "p") engineRef.current?.focusNode("pmll");
      if (ev.key === "a") setDeskOpen((open) => !open);
      if (ev.key === "w" && lastWin) replayWin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, deskOpen, lastWin, replayWin, winOpen, dismissWin]);

  const neighborList = useMemo(
    () => (selected ? neighborsOf(selected.id) : []),
    [selected],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full bg-bg"
        aria-label="Force-directed skill graph"
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
        <header className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm rounded-xl bg-surface/90 p-4 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-medium tracking-wide text-subtle uppercase">
              skills.stellar.org
            </p>
            <h1 className="mt-1 font-display text-xl leading-tight tracking-[-0.03em] text-fg sm:text-2xl">
              Lattice
            </h1>
            <p className="mt-1 text-sm leading-snug text-muted">
              Stellar skill graph with PMLL persistent memory as a first-class node.
            </p>
            {lastWin ? (
              <button
                type="button"
                className="mt-3 inline-flex h-10 items-center text-xs font-medium text-fg hover:text-accent"
                onClick={() => replayWin()}
              >
                Sealed · {lastWin.id.slice(0, 6)}…{lastWin.id.slice(-4)}
              </button>
            ) : (
              <p className="mt-3 text-xs text-subtle">Store a digest to seal the lattice.</p>
            )}
          </div>

          <div className="relative w-full sm:w-[22rem]">
            <label className="sr-only" htmlFor="skill-search">
              Search skills
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input
              id="skill-search"
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setResultsOpen(matches.length > 0)}
              placeholder="Search skills, owners, tags"
              className="bg-surface/90 pr-10 pl-10"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-subtle hover:text-fg"
                onClick={() => {
                  setQuery("");
                  setResultsOpen(false);
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
            {resultsOpen && query && (
              <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-10 overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-panel)]">
                <p className="px-3 pt-2 pb-1 text-xs font-medium text-subtle tabular-nums">
                  {matches.length} {matches.length === 1 ? "match" : "matches"}
                </p>
                <ul className="max-h-56 overflow-auto py-1">
                  {matches.slice(0, 8).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-fg/6"
                        onClick={() => {
                          engineRef.current?.focusNode(n.id);
                          setResultsOpen(false);
                        }}
                      >
                        <span className="truncate text-sm text-fg">{n.label}</span>
                        <span className="shrink-0 text-xs text-subtle">
                          {KIND_META[n.kind].label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </header>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="pointer-events-auto flex max-w-full flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => engineRef.current?.reheat()}
                aria-label="Reheat simulation"
              >
                <Flame />
                Reheat
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  if (eng.isFrozen()) eng.reheat();
                  else eng.freeze();
                }}
                aria-pressed={frozen}
                aria-label={frozen ? "Resume simulation" : "Freeze simulation"}
              >
                {frozen ? <Flame /> : <Pause />}
                {frozen ? "Resume" : "Freeze"}
              </Button>
              <Button
                type="button"
                onClick={() => engineRef.current?.fit({ animate: true })}
                aria-label="Fit graph in view"
              >
                <Maximize />
                Fit
              </Button>
              <Button
                type="button"
                onClick={() => engineRef.current?.unpinAll()}
                aria-label="Unpin all nodes"
              >
                <PinOff />
                Unpin
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => engineRef.current?.focusNode("pmll")}
              >
                PMLL
              </Button>
              <Button
                type="button"
                aria-pressed={deskOpen}
                aria-label="Open PMLL anchor desk"
                onClick={() => setDeskOpen((open) => !open)}
              >
                <Anchor />
                Anchor
              </Button>
              <Button asChild variant="primary">
                <Link to="/play">
                  <Play />
                  Play
                </Link>
              </Button>
            </div>
            <div className="hidden items-center gap-3 rounded-lg bg-surface/80 px-3 py-2 text-xs text-subtle shadow-[var(--shadow-border)] sm:flex">
              <span className="tabular-nums">
                {NODES.length} nodes · {EDGES.length} edges
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                {frozen ? <Lock className="size-3" /> : null}
                <span ref={alphaRef} className="tabular-nums">
                  1.000
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>Drag nodes · scroll zoom · double-click to unpin</span>
            </div>
            <Legend />
          </div>

          {deskOpen ? (
            <AnchorDesk
              node={selected}
              onClose={() => setDeskOpen(false)}
              onFocusNode={(id) => engineRef.current?.focusNode(id)}
            />
          ) : (
            <Inspector
              node={selected}
              neighbors={neighborList}
              hoverLabel={hovered && hovered.id !== selected?.id ? hovered.label : null}
              anchoredCount={selected ? anchorsForNode(anchored, selected.id).length : 0}
              onClose={() => engineRef.current?.select(null)}
              onFocus={(id) => engineRef.current?.focusNode(id)}
              onAnchor={() => setDeskOpen(true)}
            />
          )}
        </div>
      </div>

      {winOpen ? <AnchorWin onContinue={dismissWin} /> : null}
    </div>
  );
}

function Legend() {
  return (
    <ul className="pointer-events-none hidden flex-wrap gap-x-3 gap-y-1 text-xs text-subtle sm:flex">
      {KIND_ORDER.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full bg-accent"
            style={{
              width: Math.max(6, KIND_META[kind].radius * 0.55),
              height: Math.max(6, KIND_META[kind].radius * 0.55),
              opacity: KIND_META[kind].fill,
            }}
          />
          {KIND_META[kind].label}
        </li>
      ))}
    </ul>
  );
}

function Inspector({
  node,
  neighbors,
  hoverLabel,
  anchoredCount,
  onClose,
  onFocus,
  onAnchor,
}: {
  node: SkillNode | null;
  neighbors: ReturnType<typeof neighborsOf>;
  hoverLabel: string | null;
  anchoredCount: number;
  onClose: () => void;
  onFocus: (id: string) => void;
  onAnchor: () => void;
}) {
  if (!node) {
    return (
      <aside className="pointer-events-auto hidden w-80 rounded-xl bg-surface/90 p-4 shadow-[var(--shadow-panel)] sm:block">
        <p className="font-display text-lg text-fg">Inspect</p>
        <p className="mt-1 text-sm leading-normal text-muted">
          Click a node for skill details, relations, and source. Search highlights matches
          on the lattice.
        </p>
        {hoverLabel ? (
          <p className="mt-3 text-xs text-subtle">Hovering {hoverLabel}</p>
        ) : (
          <p className="mt-3 text-xs text-subtle">
            / search · R reheat · F freeze · 0 fit · P PMLL · A anchor · W sealed
          </p>
        )}
      </aside>
    );
  }

  return (
    <aside className="pointer-events-auto max-h-[42vh] w-full overflow-auto rounded-xl bg-surface/90 p-4 shadow-[var(--shadow-panel)] sm:max-h-[min(72vh,36rem)] sm:w-80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            {KIND_META[node.kind].label}
            {node.status === "planned" ? " · planned" : null}
            {anchoredCount > 0 ? ` · ${anchoredCount} digest${anchoredCount === 1 ? "" : "s"}` : null}
          </p>
          <h2 className="mt-1 font-display text-xl leading-tight text-fg">{node.title}</h2>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close details">
          <X />
        </Button>
      </div>
      {node.owner ? (
        <p className="mt-1 text-xs text-subtle">{node.owner}</p>
      ) : null}
      <p className="mt-3 text-sm leading-normal text-muted">{node.summary}</p>
      {node.tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {node.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-sm bg-surface-2 px-2 py-1 text-xs text-muted"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {node.url ? (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 text-sm font-medium text-fg hover:text-accent"
          >
            Open source
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
        <Button type="button" onClick={onAnchor}>
          <Anchor />
          Anchor
        </Button>
      </div>
      {neighbors.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            Relations
          </p>
          <ul className="mt-2 space-y-1">
            {neighbors.map((rel) => (
              <li key={`${rel.direction}-${rel.kind}-${rel.node.id}`}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-left",
                    "hover:bg-fg/6",
                  )}
                  onClick={() => onFocus(rel.node.id)}
                >
                  <span className="truncate text-sm text-fg">{rel.node.label}</span>
                  <span className="shrink-0 text-xs text-subtle">
                    {rel.direction === "out" ? rel.kind.replace("_", " ") : `from ${rel.kind.replace("_", " ")}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
