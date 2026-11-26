export interface StoredCreatorLink {
  code: string;
  creatorToken: string;
  url?: string;
  createdAt?: string;
}

export interface LinkStats {
  code: string;
  url: string;
  status: "active" | "disabled" | "blocked" | "pending_review" | string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  hasPassword?: boolean;
  lastClickedAt: string | null;
}
