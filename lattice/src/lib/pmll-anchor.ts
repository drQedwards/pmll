/** PMLL helper: SHA-256 commitment + derived id. Matches pmll-anchor/helper. */

export const TTL_LEDGERS = 30 * 17_280;
export const LEDGER_MS = 5_000;
export const TTL_MS = TTL_LEDGERS * LEDGER_MS;
export const DEFAULT_CONTRACT_PLACEHOLDER = "$PMLL_CONTRACT_ID";
export const DEFAULT_SOURCE_PLACEHOLDER = "$STELLAR_ACCOUNT";
export const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export interface HashResult {
  payload: string;
  commitment: string;
  id: string;
}

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(buf);
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (s.length !== 64 || /[^0-9a-f]/i.test(s)) {
    throw new Error("expected 32-byte hex");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function shortHex(hex: string, keep = 6): string {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export function hexArg(hex: string): string {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `0x${s.toLowerCase()}`;
}

export async function hashPayload(payload: string, idHint?: string): Promise<HashResult> {
  const enc = new TextEncoder();
  const commitmentBytes = await sha256Bytes(enc.encode(payload));
  const idBytes = idHint
    ? await sha256Bytes(enc.encode(idHint))
    : await sha256Bytes(commitmentBytes);
  return {
    payload,
    commitment: toHex(commitmentBytes),
    id: toHex(idBytes),
  };
}

export function composeEpisode(opts: {
  iso?: string;
  agent?: string;
  nodeId?: string;
  skill?: string;
  title?: string;
  summary?: string;
  note?: string;
}): string {
  const iso = opts.iso ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const agent = opts.agent ?? "lattice";
  const parts = [`episode:${iso} agent=${agent}`];
  if (opts.nodeId) parts[0] += ` node=${opts.nodeId}`;
  if (opts.skill) parts[0] += ` skill=${opts.skill}`;
  const body: string[] = [parts[0]];
  if (opts.note?.trim()) body.push(opts.note.trim());
  if (opts.title) body.push(opts.title);
  if (opts.summary) body.push(opts.summary);
  return body.join("\n");
}

function resolveContractId(id: string): string {
  const t = id.trim();
  if (!t || t === "C..." || t === "C…") return DEFAULT_CONTRACT_PLACEHOLDER;
  return t;
}

function resolveSource(source?: string): string {
  const t = source?.trim() ?? "";
  if (!t || t.startsWith("local-")) return DEFAULT_SOURCE_PLACEHOLDER;
  return t;
}

function invokeHeader(opts: {
  contractId: string;
  source?: string;
  send: "yes" | "no";
}): string[] {
  return [
    "stellar contract invoke \\",
    `  --id ${resolveContractId(opts.contractId)} \\`,
    `  --source-account ${resolveSource(opts.source)} \\`,
    `  --rpc-url ${TESTNET_RPC_URL} \\`,
    `  --network-passphrase "${TESTNET_PASSPHRASE}" \\`,
    "  --network testnet \\",
    `  --send ${opts.send} \\`,
    "  -- \\",
  ];
}

export function initCmd(opts: { contractId: string; source?: string; admin?: string }): string {
  const admin = resolveSource(opts.admin || opts.source);
  return [
    ...invokeHeader({ contractId: opts.contractId, source: opts.source, send: "yes" }),
    "  init \\",
    `  --admin ${admin}`,
  ].join("\n");
}

export function storeCmd(opts: {
  contractId: string;
  id: string;
  commitment: string;
  source?: string;
}): string {
  return [
    ...invokeHeader({ contractId: opts.contractId, source: opts.source, send: "yes" }),
    "  store \\",
    `  --id ${hexArg(opts.id)} \\`,
    `  --commitment ${hexArg(opts.commitment)}`,
  ].join("\n");
}

export function getCmd(opts: { contractId: string; id: string; source?: string }): string {
  return [
    ...invokeHeader({ contractId: opts.contractId, source: opts.source, send: "no" }),
    "  get \\",
    `  --id ${hexArg(opts.id)}`,
  ].join("\n");
}

export function bumpCmd(opts: { contractId: string; id: string; source?: string }): string {
  return [
    ...invokeHeader({ contractId: opts.contractId, source: opts.source, send: "yes" }),
    "  bump \\",
    `  --id ${hexArg(opts.id)}`,
  ].join("\n");
}

export function invokeScript(opts: {
  contractId: string;
  id: string;
  commitment: string;
  source?: string;
}): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "# PMLL 32-byte commitment — payload stays off-chain.",
    "# Substitute $PMLL_CONTRACT_ID (C…) and $STELLAR_ACCOUNT (G… or CLI identity).",
    "",
    "# 1. one-time init (admin auth)",
    initCmd(opts),
    "",
    "# 2. store the digest",
    storeCmd(opts),
    "",
    "# 3. verify (simulation only)",
    getCmd(opts),
    "",
    "# 4. extend TTL (~30 days)",
    bumpCmd(opts),
  ].join("\n");
}

export interface AnchorEvent {
  topics: readonly ["pmll", "anchor"];
  id: string;
  commitment: string;
  at: number;
  kind: "store" | "bump" | "get";
}

export interface AnchorEntry {
  id: string;
  commitment: string;
  payload: string;
  nodeId?: string;
  storedAt: number;
  lastBumpAt: number;
  ttlUntil: number;
}

export interface AnchorLedger {
  initialized: boolean;
  admin: string;
  contractId: string;
  sourceAccount: string;
  entries: Record<string, AnchorEntry>;
  events: AnchorEvent[];
}

export function emptyLedger(): AnchorLedger {
  return {
    initialized: false,
    admin: "",
    contractId: "",
    sourceAccount: "",
    entries: {},
    events: [],
  };
}

export function initLedger(ledger: AnchorLedger, admin: string): AnchorLedger {
  if (ledger.initialized) throw new Error("already initialized");
  return {
    ...ledger,
    initialized: true,
    admin,
  };
}

export function storeOnLedger(
  ledger: AnchorLedger,
  entry: Omit<AnchorEntry, "storedAt" | "lastBumpAt" | "ttlUntil">,
  now = Date.now(),
): AnchorLedger {
  if (!ledger.initialized) throw new Error("not initialized");
  const next: AnchorEntry = {
    ...entry,
    storedAt: now,
    lastBumpAt: now,
    ttlUntil: now + TTL_MS,
  };
  return {
    ...ledger,
    entries: { ...ledger.entries, [entry.id]: next },
    events: [
      {
        topics: ["pmll", "anchor"] as const,
        id: entry.id,
        commitment: entry.commitment,
        at: now,
        kind: "store" as const,
      },
      ...ledger.events,
    ].slice(0, 80),
  };
}

export function getFromLedger(ledger: AnchorLedger, id: string): string | null {
  const row = ledger.entries[id];
  if (!row) return null;
  if (Date.now() > row.ttlUntil) return null;
  return row.commitment;
}

export function bumpOnLedger(ledger: AnchorLedger, id: string, now = Date.now()): AnchorLedger {
  if (!ledger.initialized) throw new Error("not initialized");
  const row = ledger.entries[id];
  if (!row) throw new Error("unknown id");
  const next: AnchorEntry = { ...row, lastBumpAt: now, ttlUntil: now + TTL_MS };
  return {
    ...ledger,
    entries: { ...ledger.entries, [id]: next },
    events: [
      {
        topics: ["pmll", "anchor"] as const,
        id,
        commitment: row.commitment,
        at: now,
        kind: "bump" as const,
      },
      ...ledger.events,
    ].slice(0, 80),
  };
}

export function ttlRemaining(entry: AnchorEntry, now = Date.now()): number {
  return Math.max(0, entry.ttlUntil - now);
}
