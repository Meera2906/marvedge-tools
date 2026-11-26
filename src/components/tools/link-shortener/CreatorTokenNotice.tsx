import { useState } from "react";
import { AlertTriangle, Check, Copy, Key } from "lucide-react";

interface CreatorTokenNoticeProps {
  token: string;
  code: string;
  onDismiss?: () => void;
}

export function CreatorTokenNotice({ token, code, onDismiss }: CreatorTokenNoticeProps) {
  const [copied, setCopied] = useState(false);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback or ignore clipboard errors
    }
  };

  return (
    <div
      role="region"
      aria-label="Creator Management Key Notice"
      className="relative rounded-2xl border border-amber-500/40 bg-amber-50/70 p-5 text-[#000000] shadow-xs"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-900">
          <Key className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-sm text-amber-950">
              Save Your Creator Management Key for{" "}
              <span className="font-mono text-xs">/go/{code}</span>
            </h4>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs font-medium text-amber-900/70 underline underline-offset-2 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2]"
              >
                Dismiss notice
              </button>
            )}
          </div>

          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            <strong>Important:</strong> This key is the <em>only</em> way to edit, view statistics,
            change passwords, or disable your link. Because Marvedge does not require accounts or
            store your email, <strong>lost keys cannot be recovered</strong>.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-amber-300/80 bg-[#FFFFFF] px-3 py-2 font-mono text-xs text-[#000000] select-all shadow-inner">
              <span className="truncate">{token}</span>
            </div>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-400/80 bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-amber-950 shadow-xs transition-colors hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-800" aria-hidden="true" />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-800/90">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              Saved automatically to your device&apos;s browser storage for quick management below.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
