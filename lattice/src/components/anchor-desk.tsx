import { useEffect, useMemo, useState } from "react";
import { Anchor, Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  bumpCmd,
  composeEpisode,
  getCmd,
  hashPayload,
  initCmd,
  invokeScript,
  shortHex,
  storeCmd,
  ttlRemaining,
  type HashResult,
} from "@/lib/pmll-anchor";
import { anchorsForNode, entriesList, useAnchorStore } from "@/lib/anchor-store";
import type { SkillNode } from "@/lib/graph-data";

function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1200);
  };
  return { copied, copy };
}

function HexRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-xs text-subtle">{label}</span>
      <button
        type="button"
        onClick={onCopy}
        className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-fg tabular-nums hover:text-accent"
        aria-label={`Copy ${label}`}
      >
        <span className="truncate">{shortHex(value, 8)}</span>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function CmdBlock({
  label,
  cmd,
  copied,
  onCopy,
}: {
  label: string;
  cmd: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</p>
        <Button type="button" size="sm" variant="ghost" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-muted">
        {cmd}
      </pre>
    </div>
  );
}

export function AnchorDesk({
  node,
  onClose,
  onFocusNode,
}: {
  node: SkillNode | null;
  onClose: () => void;
  onFocusNode: (id: string) => void;
}) {
  const store = useAnchorStore();
  const { copied, copy } = useCopied();
  const [note, setNote] = useState("");
  const [hint, setHint] = useState("");
  const [preview, setPreview] = useState<HashResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const payload = useMemo(
    () =>
      composeEpisode({
        nodeId: node?.id,
        skill: node?.label,
        title: node?.title,
        summary: node?.summary,
        note,
      }),
    [node, note],
  );

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void hashPayload(payload, hint.trim() || undefined).then((h) => {
        if (!cancelled) setPreview(h);
      });
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [payload, hint]);

  const list = entriesList(store.entries);
  const nodeAnchors = node ? anchorsForNode(store.entries, node.id) : [];
  const source = store.sourceAccount || store.admin;
  const invokeOpts = preview
    ? {
        contractId: store.contractId,
        id: preview.id,
        commitment: preview.commitment,
        source,
      }
    : null;

  const onStore = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const entry = await store.store({
        payload,
        nodeId: node?.id,
        idHint: hint.trim() || undefined,
      });
      const got = store.get(entry.id, entry.commitment);
      setStatus(
        got === entry.commitment
          ? "Stored and verified. Payload off-chain; 32-byte digest on the ledger."
          : "Stored, but get() did not match. Check the id.",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "store failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="pointer-events-auto flex max-h-[min(78vh,40rem)] w-full flex-col overflow-hidden rounded-xl bg-surface/95 shadow-[var(--shadow-panel)] sm:max-h-[min(82vh,44rem)] sm:w-[22.5rem]">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            PMLL Anchor
          </p>
          <h2 className="mt-1 font-display text-xl leading-tight text-fg">
            32-byte commit
          </h2>
          <p className="mt-1 text-xs leading-snug text-muted">
            Payload stays off-chain. Digest is SHA-256, same as the helper CLI.
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close anchor desk">
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 pb-4">
        <div className="rounded-md bg-surface-2 p-3">
          <p className="text-xs text-subtle">
            {store.initialized ? `Admin ${store.admin}` : "Ledger not initialized"}
            {" · "}
            TTL 30d
            {" · "}
            {list.length} stored
          </p>
          <label className="mt-2 block text-xs text-subtle" htmlFor="contract-id">
            Contract C-address
          </label>
          <Input
            id="contract-id"
            value={store.contractId}
            onChange={(e) => store.setContractId(e.target.value)}
            placeholder="$PMLL_CONTRACT_ID"
            className="mt-1 h-10 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <label className="mt-2 block text-xs text-subtle" htmlFor="source-account">
            Source account
          </label>
          <Input
            id="source-account"
            value={store.sourceAccount ?? ""}
            onChange={(e) => store.setSourceAccount(e.target.value)}
            placeholder="$STELLAR_ACCOUNT"
            className="mt-1 h-10 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            Episode
          </p>
          {node ? (
            <p className="mt-1 text-sm text-fg">
              {node.title}
              <span className="text-subtle"> · {node.id}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Select a node, or write a free episode below.
            </p>
          )}
          <label className="mt-2 block text-xs text-subtle" htmlFor="episode-note">
            Note
          </label>
          <textarea
            id="episode-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="spatial=lattice inspect, agent=drq"
            className="mt-1 w-full resize-none rounded-md bg-bg px-3 py-2 text-sm text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/70"
          />
          <label className="mt-2 block text-xs text-subtle" htmlFor="id-hint">
            ID hint (optional)
          </label>
          <Input
            id="id-hint"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="SHA-256 of hint becomes the id"
            className="mt-1 h-10 text-sm"
            autoComplete="off"
          />
        </div>

        {preview ? (
          <div className="space-y-1.5 rounded-md bg-bg p-3 shadow-[var(--shadow-border)]">
            <HexRow
              label="commitment"
              value={preview.commitment}
              copied={copied === "commitment"}
              onCopy={() => void copy("commitment", preview.commitment)}
            />
            <HexRow
              label="id"
              value={preview.id}
              copied={copied === "id"}
              onCopy={() => void copy("id", preview.id)}
            />
            <p className="pt-1 text-xs text-subtle tabular-nums">
              {preview.payload.length} bytes payload · not written on-chain
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={() => void onStore()} disabled={busy}>
            <Anchor />
            Store
          </Button>
          <Button
            type="button"
            disabled={!preview}
            onClick={() => {
              if (!preview) return;
              const got = store.get(preview.id, preview.commitment);
              setStatus(
                got === preview.commitment
                  ? "get() matched the commitment."
                  : got
                    ? "get() returned a different digest."
                    : "get() missed — not on the ledger (or TTL expired).",
              );
            }}
          >
            Get
          </Button>
          <Button
            type="button"
            disabled={!preview || !store.entries[preview.id]}
            onClick={() => {
              if (!preview) return;
              store.bump(preview.id);
              setStatus("TTL extended 30 days.");
            }}
          >
            Bump
          </Button>
        </div>

        {status || store.error ? (
          <p className={cn("text-sm leading-snug", store.error ? "text-danger" : "text-muted")}>
            {store.error ?? status}
          </p>
        ) : null}

        {preview && invokeOpts ? (
          <details className="rounded-md bg-bg p-3 shadow-[var(--shadow-border)]" open>
            <summary className="cursor-pointer text-xs font-medium text-subtle">
              stellar contract invoke
            </summary>
            <div className="mt-3 space-y-4">
              <Button
                type="button"
                className="w-full"
                onClick={() => void copy("script", invokeScript(invokeOpts))}
              >
                {copied === "script" ? <Check /> : <Copy />}
                {copied === "script" ? "Copied full script" : "Copy full script"}
              </Button>
              <CmdBlock
                label="init"
                cmd={initCmd(invokeOpts)}
                copied={copied === "init"}
                onCopy={() => void copy("init", initCmd(invokeOpts))}
              />
              <CmdBlock
                label="store"
                cmd={storeCmd(invokeOpts)}
                copied={copied === "store"}
                onCopy={() => void copy("store", storeCmd(invokeOpts))}
              />
              <CmdBlock
                label="get"
                cmd={getCmd(invokeOpts)}
                copied={copied === "get"}
                onCopy={() => void copy("get", getCmd(invokeOpts))}
              />
              <CmdBlock
                label="bump"
                cmd={bumpCmd(invokeOpts)}
                copied={copied === "bump"}
                onCopy={() => void copy("bump", bumpCmd(invokeOpts))}
              />
            </div>
          </details>
        ) : null}

        {nodeAnchors.length > 0 ? (
          <p className="text-xs text-subtle tabular-nums">
            {nodeAnchors.length} digest{nodeAnchors.length === 1 ? "" : "s"} for this node
          </p>
        ) : null}

        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">Ledger</p>
          {list.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Empty. Store hashes a payload and writes only the 32-byte digest.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {list.slice(0, 12).map((row) => {
                const days = Math.ceil(ttlRemaining(row) / 86_400_000);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-fg/6"
                      onClick={() => {
                        if (row.nodeId) onFocusNode(row.nodeId);
                        const got = store.get(row.id, row.commitment);
                        setStatus(
                          got === row.commitment
                            ? `Verified ${shortHex(row.id)}`
                            : "get() miss or mismatch",
                        );
                      }}
                    >
                      <span className="truncate font-mono text-xs text-fg">
                        {shortHex(row.id, 5)}
                      </span>
                      <span className="shrink-0 text-xs text-subtle tabular-nums">
                        {days}d ttl
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
