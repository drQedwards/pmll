import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hexArg, shortHex, storeCmd } from "@/lib/pmll-anchor";
import { useAnchorStore } from "@/lib/anchor-store";
import { NODES } from "@/lib/graph-data";

export function AnchorWin({ onContinue }: { onContinue: () => void }) {
  const lastWin = useAnchorStore((s) => s.lastWin);
  const contractId = useAnchorStore((s) => s.contractId);
  const sourceAccount = useAnchorStore((s) => s.sourceAccount);
  const admin = useAnchorStore((s) => s.admin);
  const [copied, setCopied] = useState<"cmd" | "id" | "commitment" | null>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" || ev.key === "Enter") {
        ev.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  if (!lastWin) return null;

  const node = lastWin.nodeId ? NODES.find((n) => n.id === lastWin.nodeId) : null;
  const cmd = storeCmd({
    contractId,
    id: lastWin.id,
    commitment: lastWin.commitment,
    source: sourceAccount || admin,
  });

  const copy = async (label: "cmd" | "id" | "commitment", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div
      className="win-backdrop pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-bg/80"
        aria-label="Dismiss seal"
        onClick={onContinue}
      />
      <div className="win-panel relative w-full max-w-md rounded-xl bg-surface p-5 shadow-[var(--shadow-panel)] sm:p-6">
        <p className="win-line text-xs font-medium tracking-wide text-subtle uppercase">
          Win · PMLL anchor
        </p>
        <h2 id="win-title" className="win-line mt-2 font-display text-3xl leading-tight text-fg sm:text-4xl">
          Sealed.
        </h2>
        <p className="win-line mt-2 text-sm leading-normal text-muted">
          32-byte digest verified. Payload stays off-chain.
          {node ? ` Bound to ${node.title}.` : ""}
        </p>

        <dl className="win-line mt-5 space-y-2 rounded-md bg-bg p-3 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-subtle">commitment</dt>
            <dd>
              <button
                type="button"
                className="font-mono text-xs text-fg tabular-nums hover:text-accent"
                onClick={() => void copy("commitment", hexArg(lastWin.commitment))}
              >
                {copied === "commitment" ? "copied" : shortHex(lastWin.commitment, 8)}
              </button>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-subtle">id</dt>
            <dd>
              <button
                type="button"
                className="font-mono text-xs text-fg tabular-nums hover:text-accent"
                onClick={() => void copy("id", hexArg(lastWin.id))}
              >
                {copied === "id" ? "copied" : shortHex(lastWin.id, 8)}
              </button>
            </dd>
          </div>
        </dl>

        <pre className="win-line mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg p-3 font-mono text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]">
          {cmd}
        </pre>

        <div className="win-line mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={onContinue}>
            Continue
          </Button>
          <Button type="button" onClick={() => void copy("cmd", cmd)}>
            {copied === "cmd" ? <Check /> : <Copy />}
            {copied === "cmd" ? "Copied" : "Copy store"}
          </Button>
        </div>
      </div>
    </div>
  );
}
