"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronUp,
  Clock,
  ExternalLink,
  Key,
  Link2,
  Loader2,
  Lock,
  MousePointerClick,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { getLinkInfo, updateLink } from "@/lib/links.functions";
import { CopyBtn, ErrorNote, inputCls } from "../ui";
import { formatLinkDate, formatLinkError, getStatusBadge } from "./links-ui-helpers";
import type { LinkStats, StoredCreatorLink } from "./types";

interface CreatorLinkManagerProps {
  links: StoredCreatorLink[];
  onRemove: (code: string) => void;
  onAddManual: (link: StoredCreatorLink) => void;
  onUpdateStored: (code: string, patch: Partial<StoredCreatorLink>) => void;
}

const EXPIRY_PRESETS = [
  { label: "1 hour", h: 1 },
  { label: "24 hours", h: 24 },
  { label: "7 days", h: 168 },
  { label: "30 days", h: 720 },
  { label: "Custom date/time", h: -1 },
  { label: "Never (remove expiry)", h: 0 },
];

export function CreatorLinkManager({
  links,
  onRemove,
  onAddManual,
  onUpdateStored,
}: CreatorLinkManagerProps) {
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importToken, setImportToken] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportErr(null);
    const code = importCode.trim().replace(/^\/go\//, "");
    const token = importToken.trim();
    if (!code || !token) {
      setImportErr("Please enter both the short code and the creator token.");
      return;
    }
    setImportBusy(true);
    try {
      const res = await getLinkInfo({ data: { code, creatorToken: token } });
      if (!res.ok) {
        setImportErr(formatLinkError(res.error));
        return;
      }
      onAddManual({
        code: res.link.code,
        creatorToken: token,
        url: res.link.url,
        createdAt: res.link.createdAt,
      });
      setImportCode("");
      setImportToken("");
      setShowImport(false);
    } catch {
      setImportErr("Failed to verify link info. Check the details and try again.");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <section aria-labelledby="creator-links-heading" className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D6CCB5] pt-8">
        <div>
          <h3 id="creator-links-heading" className="font-serif text-xl font-normal text-[#000000]">
            Manage Your Short Links
          </h3>
          <p className="mt-0.5 text-xs text-[#4A4740]">
            Track clicks, edit expiration, modify passwords, or disable links created on this
            device.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowImport((s) => !s)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#000000] shadow-xs transition-colors hover:bg-[#E8DFCA]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2]"
        >
          {showImport ? (
            <ChevronUp className="h-3.5 w-3.5 text-[#537190]" />
          ) : (
            <Plus className="h-3.5 w-3.5 text-[#537190]" />
          )}
          {showImport ? "Hide Import" : "Import Link Key"}
        </button>
      </div>

      {showImport && (
        <form
          onSubmit={handleImport}
          className="rounded-2xl border border-[#D6CCB5] bg-[#FAF7F0] p-4 text-xs shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 font-semibold text-sm text-[#000000]">
            <Key className="h-4 w-4 text-[#537190]" />
            Import Link Managed Elsewhere
          </div>
          <p className="text-[#4A4740]">
            Have a creator token from another browser or device? Paste the code and token here to
            add it to your local dashboard.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-[#000000] mb-1">
                Short Code (e.g. summer-sale)
              </label>
              <input
                type="text"
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="summer-sale"
                className={inputCls.replace("bg-[#FAF7F0]", "bg-[#FFFFFF]")}
              />
            </div>
            <div>
              <label className="block font-medium text-[#000000] mb-1">Creator Token</label>
              <input
                type="text"
                value={importToken}
                onChange={(e) => setImportToken(e.target.value)}
                placeholder="Paste your 43-character token"
                className={inputCls.replace("bg-[#FAF7F0]", "bg-[#FFFFFF]")}
              />
            </div>
          </div>
          <ErrorNote msg={importErr} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setImportErr(null);
              }}
              className="rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1.5 font-semibold text-[#4A4740] hover:bg-[#FAF7F0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importBusy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#000000] px-4 py-1.5 font-semibold text-[#FFFFFF] hover:bg-[#1A1A1A] disabled:opacity-50"
            >
              {importBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Import &amp; Verify
            </button>
          </div>
        </form>
      )}

      {links.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6CCB5] bg-[#FAF7F0]/60 p-8 text-center">
          <Link2 className="mx-auto h-7 w-7 text-[#7895B2]" aria-hidden="true" />
          <h4 className="mt-2 text-sm font-semibold text-[#000000]">
            No saved links on this device
          </h4>
          <p className="mt-1 text-xs text-[#4A4740] max-w-sm mx-auto">
            Any short links you create will appear here automatically with real-time click
            statistics and management tools.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <CreatorLinkCard
              key={link.code}
              item={link}
              onRemove={onRemove}
              onUpdateStored={onUpdateStored}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CreatorLinkCard({
  item,
  onRemove,
  onUpdateStored,
}: {
  item: StoredCreatorLink;
  onRemove: (code: string) => void;
  onUpdateStored: (code: string, patch: Partial<StoredCreatorLink>) => void;
}) {
  const [stats, setStats] = useState<LinkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [showExpiryEdit, setShowExpiryEdit] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(1);
  const [customExpiry, setCustomExpiry] = useState("");

  const [showPwEdit, setShowPwEdit] = useState(false);
  const [newPw, setNewPw] = useState("");

  const [copiedToken, setCopiedToken] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await getLinkInfo({
        data: { code: item.code, creatorToken: item.creatorToken },
      });
      if (!res.ok) {
        setErr(formatLinkError(res.error));
      } else {
        setStats(res.link);
        if (res.link.url && res.link.url !== item.url) {
          onUpdateStored(item.code, { url: res.link.url });
        }
      }
    } catch {
      setErr("Could not retrieve link info.");
    } finally {
      setLoading(false);
    }
  }, [item.code, item.creatorToken, item.url, onUpdateStored]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const toggleStatus = async () => {
    if (!stats) return;
    const nextStatus = stats.status === "disabled" ? "active" : "disabled";
    setActionErr(null);
    setActionMsg(null);
    setActionBusy(true);
    try {
      const res = await updateLink({
        data: {
          code: item.code,
          creatorToken: item.creatorToken,
          status: nextStatus,
        },
      });
      if (!res.ok) {
        setActionErr(formatLinkError(res.error));
      } else {
        setStats((prev) => (prev ? { ...prev, status: res.link.status } : prev));
        setActionMsg(
          `Link successfully ${res.link.status === "active" ? "re-enabled" : "disabled"}.`,
        );
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch {
      setActionErr("Failed to update link status.");
    } finally {
      setActionBusy(false);
    }
  };

  const saveExpiry = async () => {
    setActionErr(null);
    setActionMsg(null);
    let expiresAt: string | null = null;
    const preset = EXPIRY_PRESETS[selectedPreset];
    if (!preset) return;
    if (preset.h > 0) {
      expiresAt = new Date(Date.now() + preset.h * 3600e3).toISOString();
    } else if (preset.h === -1) {
      if (!customExpiry) {
        setActionErr("Please choose a future expiry date and time.");
        return;
      }
      const d = new Date(customExpiry);
      if (d <= new Date()) {
        setActionErr("The expiry date must be in the future.");
        return;
      }
      expiresAt = d.toISOString();
    } else {
      expiresAt = null;
    }

    setActionBusy(true);
    try {
      const res = await updateLink({
        data: {
          code: item.code,
          creatorToken: item.creatorToken,
          expiresAt,
        },
      });
      if (!res.ok) {
        setActionErr(formatLinkError(res.error));
      } else {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                expiresAt: res.link.expiresAt,
              }
            : prev,
        );
        setShowExpiryEdit(false);
        setActionMsg("Expiration updated.");
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch {
      setActionErr("Failed to update expiration.");
    } finally {
      setActionBusy(false);
    }
  };

  const savePassword = async (remove = false) => {
    setActionErr(null);
    setActionMsg(null);
    if (!remove && newPw.length < 4) {
      setActionErr("Password must be at least 4 characters.");
      return;
    }
    setActionBusy(true);
    try {
      const res = await updateLink({
        data: {
          code: item.code,
          creatorToken: item.creatorToken,
          password: remove ? null : newPw,
        },
      });
      if (!res.ok) {
        setActionErr(formatLinkError(res.error));
      } else {
        setShowPwEdit(false);
        setNewPw("");
        setActionMsg(remove ? "Password protection removed." : "Password updated.");
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch {
      setActionErr("Failed to update password.");
    } finally {
      setActionBusy(false);
    }
  };

  const copyCreatorToken = async () => {
    try {
      await navigator.clipboard.writeText(item.creatorToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Ignore
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = `${origin}/go/${item.code}`;
  const badge = getStatusBadge(stats?.status ?? "loading", stats?.expiresAt);

  return (
    <article
      aria-label={`Short link ${item.code}`}
      className="rounded-2xl border border-[#D6CCB5] bg-[#FFFFFF] p-5 shadow-xs transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#000000] underline decoration-[#D6CCB5] underline-offset-4 hover:decoration-[#000000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2]"
            >
              /go/{item.code}
              <ExternalLink className="h-3 w-3 text-[#537190]" aria-hidden="true" />
            </a>
            <CopyBtn text={shortUrl} />

            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.badgeCls}`}
              title={badge.description}
            >
              {badge.label}
            </span>
          </div>

          <p className="truncate text-xs text-[#4A4740]" title={stats?.url || item.url}>
            Target:{" "}
            <span className="font-mono text-[#000000]">
              {stats?.url || item.url || "Loading target URL…"}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={loading || actionBusy}
          title="Refresh stats"
          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#D6CCB5] p-2 text-[#4A4740] hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#D6CCB5]/60 pt-3 text-xs sm:grid-cols-4">
        <div className="flex items-center gap-2 text-[#4A4740]">
          <MousePointerClick className="h-4 w-4 text-[#537190]" aria-hidden="true" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#537190]">
              Clicks
            </span>
            <span className="font-mono font-semibold text-[#000000]">{stats?.clicks ?? 0}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#4A4740]">
          <Clock className="h-4 w-4 text-[#537190]" aria-hidden="true" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#537190]">
              Last Clicked
            </span>
            <span className="text-[#000000]">
              {stats ? formatLinkDate(stats.lastClickedAt) : "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#4A4740]">
          <Calendar className="h-4 w-4 text-[#537190]" aria-hidden="true" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#537190]">
              Created
            </span>
            <span className="text-[#000000]">
              {formatLinkDate(item.createdAt || stats?.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#4A4740]">
          <Calendar className="h-4 w-4 text-[#537190]" aria-hidden="true" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#537190]">
              Expires
            </span>
            <span className="text-[#000000]">
              {stats?.expiresAt ? formatLinkDate(stats.expiresAt) : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Moderation Warnings */}
      {stats?.status === "pending_review" && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Under Community Review:</strong> This link received reports and displays an
            interstitial warning to visitors. It cannot be re-activated until an administrator
            reviews it.
          </div>
        </div>
      )}
      {stats?.status === "blocked" && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs text-red-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong>Blocked:</strong> This link was disabled by administrators for security or
            policy violations. It cannot be edited or reactivated.
          </div>
        </div>
      )}

      {/* Inline Feedback Alerts */}
      <ErrorNote msg={err || actionErr} />
      {actionMsg && (
        <p className="mt-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2">
          {actionMsg}
        </p>
      )}

      {/* Management Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D6CCB5]/60 pt-3">
        {badge.canDisable && (
          <button
            type="button"
            onClick={toggleStatus}
            disabled={actionBusy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#9F2D18] hover:bg-[#D95338]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2] disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            Disable Link
          </button>
        )}
        {badge.canReenable && (
          <button
            type="button"
            onClick={toggleStatus}
            disabled={actionBusy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2] disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            Enable Link
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setShowExpiryEdit((s) => !s);
            setShowPwEdit(false);
          }}
          disabled={stats?.status === "blocked"}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#000000] hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2] disabled:opacity-50"
        >
          <Calendar className="h-3.5 w-3.5 text-[#537190]" aria-hidden="true" />
          Edit Expiry
        </button>

        <button
          type="button"
          onClick={() => {
            setShowPwEdit((s) => !s);
            setShowExpiryEdit(false);
          }}
          disabled={stats?.status === "blocked"}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#000000] hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2] disabled:opacity-50"
        >
          <Lock className="h-3.5 w-3.5 text-[#537190]" aria-hidden="true" />
          Password
        </button>

        <button
          type="button"
          onClick={copyCreatorToken}
          title="Copy the creator token for this link"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#000000] hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2]"
        >
          {copiedToken ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Key Copied</span>
            </>
          ) : (
            <>
              <Key className="h-3.5 w-3.5 text-[#537190]" aria-hidden="true" />
              <span>Copy Key</span>
            </>
          )}
        </button>

        <div className="ml-auto">
          {confirmForget ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#4A4740]">Forget from this browser?</span>
              <button
                type="button"
                onClick={() => onRemove(item.code)}
                className="rounded-lg bg-[#D95338] px-2 py-1 text-[11px] font-semibold text-[#FFFFFF] hover:bg-[#9F2D18]"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmForget(false)}
                className="rounded-lg border border-[#D6CCB5] bg-[#FFFFFF] px-2 py-1 text-[11px] font-semibold text-[#4A4740]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmForget(true)}
              title="Remove this link from this browser's list"
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#4A4740] hover:text-[#9F2D18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7895B2]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Forget
            </button>
          )}
        </div>
      </div>

      {/* Sub-panel: Expiry Editor */}
      {showExpiryEdit && (
        <div className="mt-3 rounded-xl border border-[#D6CCB5] bg-[#FAF7F0] p-3 text-xs space-y-2">
          <label className="block font-semibold text-[#000000]">Choose New Expiration:</label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(+e.target.value)}
              className={inputCls.replace("bg-[#FAF7F0]", "bg-[#FFFFFF]")}
            >
              {EXPIRY_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
            {EXPIRY_PRESETS[selectedPreset]?.h === -1 && (
              <input
                type="datetime-local"
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                className={inputCls.replace("bg-[#FAF7F0]", "bg-[#FFFFFF]")}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowExpiryEdit(false)}
              className="rounded-lg border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1 font-semibold text-[#4A4740]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveExpiry}
              disabled={actionBusy}
              className="rounded-lg bg-[#000000] px-3.5 py-1 font-semibold text-[#FFFFFF] hover:bg-[#1A1A1A] disabled:opacity-50"
            >
              Save Expiry
            </button>
          </div>
        </div>
      )}

      {/* Sub-panel: Password Editor */}
      {showPwEdit && (
        <div className="mt-3 rounded-xl border border-[#D6CCB5] bg-[#FAF7F0] p-3 text-xs space-y-2">
          <label className="block font-semibold text-[#000000]">Update Password:</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 4 characters"
            className={inputCls.replace("bg-[#FAF7F0]", "bg-[#FFFFFF]")}
          />
          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => savePassword(true)}
              disabled={actionBusy}
              className="rounded-lg border border-[#D6CCB5] bg-[#FFFFFF] px-2.5 py-1 font-semibold text-[#9F2D18] hover:bg-[#D95338]/10 disabled:opacity-50"
            >
              Remove Password
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPwEdit(false)}
                className="rounded-lg border border-[#D6CCB5] bg-[#FFFFFF] px-3 py-1 font-semibold text-[#4A4740]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => savePassword(false)}
                disabled={actionBusy || !newPw}
                className="rounded-lg bg-[#000000] px-3.5 py-1 font-semibold text-[#FFFFFF] hover:bg-[#1A1A1A] disabled:opacity-50"
              >
                Set Password
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
