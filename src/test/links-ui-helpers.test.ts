import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  formatLinkDate,
  formatLinkError,
  getStatusBadge,
  loadStoredLinks,
  parseStoredLinks,
  saveStoredLinks,
  CREATOR_STORAGE_KEY,
} from "@/components/tools/link-shortener/links-ui-helpers";

describe("Link Shortener UI Helpers", () => {
  describe("formatLinkError", () => {
    it("maps standard domain and validation errors", () => {
      expect(formatLinkError("taken")).toBe("That custom name is already taken. Try another.");
      expect(formatLinkError("reserved")).toBe(
        "That custom name is reserved by the system. Choose a different one.",
      );
      expect(formatLinkError("blocked_domain")).toBe(
        "This destination domain is blocked due to security or policy violations.",
      );
      expect(formatLinkError("invalid_url")).toBe(
        "Check the link and custom name (3–40 letters, numbers, - or _; password at least 4 characters).",
      );
      expect(formatLinkError("invalid_request")).toBe(
        "Check the link and custom name (3–40 letters, numbers, - or _; password at least 4 characters).",
      );
      expect(formatLinkError("server_error")).toBe(
        "Something went wrong on our end. Please try again later.",
      );
      expect(formatLinkError("not_found")).toBe("Link not found or it may have been deleted.");
      expect(formatLinkError("unauthorized")).toBe(
        "Invalid creator token. You are not authorized to manage this link.",
      );
      expect(formatLinkError("forbidden_status_transition")).toBe(
        "Links under moderation review or blocked by administrators cannot have their status altered.",
      );
    });

    it("formats rate limit error with retry seconds", () => {
      expect(formatLinkError("rate_limited", 30)).toBe(
        "Too many requests. Please try again in 30s.",
      );
      expect(formatLinkError("rate_limited")).toBe(
        "Too many requests. Please try again in a moment.",
      );
      expect(formatLinkError("rate_limited", 0)).toBe(
        "Too many requests. Please try again in a moment.",
      );
    });

    it("handles Zod validation error strings gracefully", () => {
      const zodErr = '[{"code":"invalid_string","message":"3–40 letters"}]';
      expect(formatLinkError(zodErr)).toBe(
        "Check the link and custom name (3–40 letters, numbers, - or _; password at least 4 characters).",
      );
    });

    it("falls back to raw string or default message", () => {
      expect(formatLinkError("Custom error message")).toBe("Custom error message");
      expect(formatLinkError("")).toBe("An unexpected error occurred.");
    });
  });

  describe("parseStoredLinks", () => {
    it("returns empty array for null, empty or invalid json", () => {
      expect(parseStoredLinks(null)).toEqual([]);
      expect(parseStoredLinks("")).toEqual([]);
      expect(parseStoredLinks("   ")).toEqual([]);
      expect(parseStoredLinks("{ broken json")).toEqual([]);
      expect(parseStoredLinks('{"not": "an array"}')).toEqual([]);
      expect(parseStoredLinks("12345")).toEqual([]);
    });

    it("filters out invalid items and keeps valid links", () => {
      const mixed = [
        { code: "valid-1", creatorToken: "token-1", url: "https://example.com/1" },
        null,
        "not an object",
        { code: "", creatorToken: "token-2" }, // empty code
        { code: "no-token" }, // missing token
        { code: "valid-2", creatorToken: "token-2" },
      ];
      const result = parseStoredLinks(JSON.stringify(mixed));
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: "valid-1",
        creatorToken: "token-1",
        url: "https://example.com/1",
      });
      expect(result[1]).toEqual({
        code: "valid-2",
        creatorToken: "token-2",
      });
    });
  });

  describe("formatLinkDate", () => {
    it("formats null or empty as Never", () => {
      expect(formatLinkDate(null)).toBe("Never");
      expect(formatLinkDate(undefined)).toBe("Never");
      expect(formatLinkDate("")).toBe("Never");
    });

    it("formats invalid dates as Unknown", () => {
      expect(formatLinkDate("not-a-date")).toBe("Unknown");
    });

    it("formats valid ISO timestamp", () => {
      const formatted = formatLinkDate("2026-06-15T12:00:00.000Z");
      expect(formatted).not.toBe("Never");
      expect(formatted).not.toBe("Unknown");
      expect(formatted.length).toBeGreaterThan(5);
    });
  });

  describe("getStatusBadge", () => {
    it("returns correct metadata for active", () => {
      const b = getStatusBadge("active");
      expect(b.label).toBe("Active");
      expect(b.canDisable).toBe(true);
      expect(b.canReenable).toBe(false);
    });

    it("returns Expired when active link has expiresAt in the past", () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const b = getStatusBadge("active", past);
      expect(b.label).toBe("Expired");
      expect(b.canDisable).toBe(false);
      expect(b.canReenable).toBe(false);

      const future = new Date(Date.now() + 60_000).toISOString();
      const active = getStatusBadge("active", future);
      expect(active.label).toBe("Active");
    });

    it("returns correct metadata for disabled", () => {
      const b = getStatusBadge("disabled");
      expect(b.label).toBe("Disabled");
      expect(b.canDisable).toBe(false);
      expect(b.canReenable).toBe(true);
    });

    it("returns correct metadata for pending_review", () => {
      const b = getStatusBadge("pending_review");
      expect(b.label).toBe("Under Review");
      expect(b.canDisable).toBe(false);
      expect(b.canReenable).toBe(false);
    });

    it("returns correct metadata for blocked", () => {
      const b = getStatusBadge("blocked");
      expect(b.label).toBe("Blocked");
      expect(b.canDisable).toBe(false);
      expect(b.canReenable).toBe(false);
    });

    it("handles unknown status", () => {
      const b = getStatusBadge("custom_status");
      expect(b.label).toBe("custom_status");
      expect(b.canDisable).toBe(false);
      expect(b.canReenable).toBe(false);
    });
  });

  describe("loadStoredLinks and saveStoredLinks", () => {
    let mockStore: Record<string, string> = {};

    beforeEach(() => {
      mockStore = {};
      const mockStorage = {
        getItem: vi.fn((k: string) => mockStore[k] ?? null),
        setItem: vi.fn((k: string, v: string) => {
          mockStore[k] = v;
        }),
        removeItem: vi.fn((k: string) => {
          delete mockStore[k];
        }),
      };
      vi.stubGlobal("window", { localStorage: mockStorage });
      vi.stubGlobal("localStorage", mockStorage);
    });

    it("loads empty array when localStorage has no data", () => {
      expect(loadStoredLinks()).toEqual([]);
    });

    it("saves and reloads links from localStorage", () => {
      const sample = [
        { code: "abc", creatorToken: "tok-1", url: "https://example.com" },
        { code: "xyz", creatorToken: "tok-2" },
      ];
      saveStoredLinks(sample);
      expect(mockStore[CREATOR_STORAGE_KEY]).toBeDefined();

      const loaded = loadStoredLinks();
      expect(loaded).toEqual(sample);
    });

    it("recovers gracefully from corrupted storage", () => {
      mockStore[CREATOR_STORAGE_KEY] = "{ corrupt";
      expect(loadStoredLinks()).toEqual([]);
    });
  });
});
