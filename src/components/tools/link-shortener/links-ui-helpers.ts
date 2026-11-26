import type { StoredCreatorLink } from "./types";

/** localStorage key for persisted creator links. */
export const CREATOR_STORAGE_KEY = "mrv_creator_links";

// ---------------------------------------------------------------------------
// Storage helpers — SSR-safe, exception-guarded
// ---------------------------------------------------------------------------

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

/**
 * Maps raw backend or validation error strings to user-friendly messages.
 */
export function formatLinkError(error: string, retryAfter?: number): string {
  switch (error) {
    case "taken":
      return "That custom name is already taken. Try another.";
    case "reserved":
      return "That custom name is reserved by the system. Choose a different one.";
    case "blocked_domain":
      return "This destination domain is blocked due to security or policy violations.";
    case "invalid_url":
    case "invalid_request":
      return "Check the link and custom name (3–40 letters, numbers, - or _; password at least 4 characters).";
    case "rate_limited":
      return typeof retryAfter === "number" && retryAfter > 0
        ? `Too many requests. Please try again in ${retryAfter}s.`
        : "Too many requests. Please try again in a moment.";
    case "server_error":
      return "Something went wrong on our end. Please try again later.";
    case "not_found":
      return "Link not found or it may have been deleted.";
    case "unauthorized":
      return "Invalid creator token. You are not authorized to manage this link.";
    case "forbidden_status_transition":
      return "Links under moderation review or blocked by administrators cannot have their status altered.";
    default:
      if (error.includes("[") && error.includes("]")) {
        return "Check the link and custom name (3–40 letters, numbers, - or _; password at least 4 characters).";
      }
      return error || "An unexpected error occurred.";
  }
}

// ---------------------------------------------------------------------------
// Storage serialisation
// ---------------------------------------------------------------------------

interface RawCandidate {
  code?: unknown;
  creatorToken?: unknown;
  url?: unknown;
  createdAt?: unknown;
}

/**
 * Safely parses raw JSON from localStorage into validated StoredCreatorLink array.
 * Handles corrupted data, wrong types, and missing fields.
 */
export function parseStoredLinks(rawJson: string | null): StoredCreatorLink[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredCreatorLink =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RawCandidate).code === "string" &&
        ((item as RawCandidate).code as string).trim().length > 0 &&
        typeof (item as RawCandidate).creatorToken === "string" &&
        ((item as RawCandidate).creatorToken as string).trim().length > 0,
    );
  } catch {
    return [];
  }
}

/**
 * Reads stored links from localStorage with SSR and exception guards.
 */
export function loadStoredLinks(): StoredCreatorLink[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    return parseStoredLinks(storage.getItem(CREATOR_STORAGE_KEY));
  } catch {
    return [];
  }
}

/**
 * Writes stored links to localStorage with SSR and exception guards.
 * Never logs creator tokens.
 */
export function saveStoredLinks(links: StoredCreatorLink[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CREATOR_STORAGE_KEY, JSON.stringify(links));
  } catch {
    // Ignore storage quota exceeded or disabled storage
  }
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Formats ISO timestamp into localized medium date + short time string.
 */
export function formatLinkDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "Unknown";
  }
}

// ---------------------------------------------------------------------------
// Status badge metadata
// ---------------------------------------------------------------------------

export interface StatusBadgeInfo {
  label: string;
  badgeCls: string;
  description: string;
  canReenable: boolean;
  canDisable: boolean;
}

/**
 * Returns UI badge metadata and permissions for a link status.
 */
export function getStatusBadge(status: string, expiresAt?: string | null): StatusBadgeInfo {
  if (status === "active" && expiresAt) {
    const exp = new Date(expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
      return {
        label: "Expired",
        badgeCls: "bg-amber-500/15 text-amber-800 border-amber-500/30",
        description: "Expiration time has passed. Visitors receive a 410 Gone page.",
        canReenable: false,
        canDisable: false,
      };
    }
  }
  switch (status) {
    case "active":
      return {
        label: "Active",
        badgeCls: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30",
        description: "Redirecting visitors normally.",
        canReenable: false,
        canDisable: true,
      };
    case "disabled":
      return {
        label: "Disabled",
        badgeCls: "bg-neutral-500/15 text-neutral-700 border-neutral-500/30",
        description: "Disabled by creator. Visitors receive a 410 Gone page.",
        canReenable: true,
        canDisable: false,
      };
    case "pending_review":
      return {
        label: "Under Review",
        badgeCls: "bg-amber-500/15 text-amber-800 border-amber-500/30",
        description:
          "Flagged for community review. Interstitial warning notice is shown to visitors.",
        canReenable: false,
        canDisable: false,
      };
    case "blocked":
      return {
        label: "Blocked",
        badgeCls: "bg-red-500/15 text-red-800 border-red-500/30",
        description: "Blocked by administrators due to policy violations.",
        canReenable: false,
        canDisable: false,
      };
    default:
      return {
        label: status,
        badgeCls: "bg-neutral-500/15 text-neutral-700 border-neutral-500/30",
        description: "Unknown status.",
        canReenable: false,
        canDisable: false,
      };
  }
}
