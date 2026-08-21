import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  bumpOnLedger,
  emptyLedger,
  getFromLedger,
  hashPayload,
  initLedger,
  storeOnLedger,
  type AnchorEntry,
  type AnchorLedger,
  type HashResult,
} from "@/lib/pmll-anchor";

const ADMIN_KEY = "lattice-pmll-admin";

interface AnchorState extends AnchorLedger {
  error: string | null;
  lastHash: HashResult | null;
  lastGet: { id: string; commitment: string | null; matched: boolean } | null;
  lastWin: AnchorEntry | null;
  winOpen: boolean;
  init: () => void;
  setContractId: (id: string) => void;
  setSourceAccount: (id: string) => void;
  hash: (payload: string, idHint?: string) => Promise<HashResult>;
  store: (opts: {
    payload: string;
    nodeId?: string;
    idHint?: string;
  }) => Promise<AnchorEntry>;
  get: (id: string, expected?: string) => string | null;
  bump: (id: string) => void;
  dismissWin: () => void;
  replayWin: () => void;
  clearError: () => void;
}

function ensureAdmin(): string {
  if (typeof window === "undefined") return "local-admin";
  const existing = window.localStorage.getItem(ADMIN_KEY);
  if (existing) return existing;
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const id = `local-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  window.localStorage.setItem(ADMIN_KEY, id);
  return id;
}

export const useAnchorStore = create<AnchorState>()(
  persist(
    (set, get) => ({
      ...emptyLedger(),
      error: null,
      lastHash: null,
      lastGet: null,
      lastWin: null,
      winOpen: false,
      init: () => {
        try {
          const next = initLedger(get(), ensureAdmin());
          set({ ...next, error: null });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "init failed" });
        }
      },
      setContractId: (contractId) => set({ contractId }),
      setSourceAccount: (sourceAccount) => set({ sourceAccount }),
      hash: async (payload, idHint) => {
        const result = await hashPayload(payload, idHint);
        set({ lastHash: result, error: null });
        return result;
      },
      store: async ({ payload, nodeId, idHint }) => {
        const state = get();
        if (!state.initialized) {
          try {
            const next = initLedger(state, ensureAdmin());
            set({ ...next, error: null });
          } catch (err) {
            const message = err instanceof Error ? err.message : "init failed";
            set({ error: message });
            throw err;
          }
        }
        const hashed = await hashPayload(payload, idHint);
        const after = storeOnLedger(get(), {
          id: hashed.id,
          commitment: hashed.commitment,
          payload,
          nodeId,
        });
        const entry = after.entries[hashed.id];
        set({
          ...after,
          lastHash: hashed,
          lastWin: entry,
          winOpen: true,
          error: null,
          lastGet: null,
        });
        return entry;
      },
      get: (id, expected) => {
        const commitment = getFromLedger(get(), id);
        const matched = expected ? commitment === expected : commitment != null;
        set({
          lastGet: { id, commitment, matched },
          events: [
            {
              topics: ["pmll", "anchor"] as const,
              id,
              commitment: commitment ?? "",
              at: Date.now(),
              kind: "get" as const,
            },
            ...get().events,
          ].slice(0, 80),
        });
        return commitment;
      },
      bump: (id) => {
        try {
          const next = bumpOnLedger(get(), id);
          set({ ...next, error: null });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "bump failed" });
        }
      },
      dismissWin: () => set({ winOpen: false }),
      replayWin: () => {
        const last = get().lastWin;
        if (last) set({ winOpen: true });
      },
      clearError: () => set({ error: null }),
    }),
    {
      name: "lattice-pmll-anchor",
      partialize: (state) => ({
        initialized: state.initialized,
        admin: state.admin,
        contractId: state.contractId,
        sourceAccount: state.sourceAccount,
        entries: state.entries,
        events: state.events,
        lastWin: state.lastWin,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.lastWin) {
          const list = Object.values(state.entries ?? {}).sort(
            (a, b) => b.storedAt - a.storedAt,
          );
          if (list[0]) state.lastWin = list[0];
        }
        state.winOpen = false;
      },
    },
  ),
);

export function entriesList(entries: Record<string, AnchorEntry>): AnchorEntry[] {
  return Object.values(entries).sort((a, b) => b.storedAt - a.storedAt);
}

export function anchorsForNode(
  entries: Record<string, AnchorEntry>,
  nodeId: string,
): AnchorEntry[] {
  return entriesList(entries).filter((e) => e.nodeId === nodeId);
}
