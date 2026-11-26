# Link Shortener Verification Guide (Backend & Admin API)

This guide documents automated test verification, manual `curl.exe -i` procedures to validate the HTTP 302 redirect route (`app/go/[code]/route.ts`), status codes, response headers, security controls, and the administrative moderation API (`/api/admin/links/*`).

> **Note:** Browser UI verification scenarios (creator token notice, local storage manager, QR download) are documented on the frontend branch (`feat/t-00035-link-shortener-frontend`).

---

## 1. Environment & Setup

1. Ensure `.env.local` is configured with:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_API_KEY`
   - `IP_HASH_SALT`
   - `PUBLIC_SITE_URL` (e.g. `http://localhost:3000` for local testing)
2. Ensure both SQL migrations in `supabase/migrations/` have been applied in order:
   - `202611260001_create_short_links.sql`
   - `202611260002_harden_short_links.sql`
3. Run automated backend checks:

```powershell
pnpm typecheck
pnpm test:links
pnpm build
```

Expected:
- `pnpm typecheck` exits with `0`
- `pnpm test:links` passes **11 test files, 112 tests**
- `pnpm build` completes cleanly with `/go/[code]` and `/api/admin/links/*` as dynamic routes

4. Start the local Next.js development server:

```powershell
pnpm dev
```

By default, the Next.js server starts at `http://localhost:3000`.

---

## 2. Redirect Route Scenarios & `curl` Commands (`/go/[code]`)

### Scenario 1: Clean Active Link (HTTP 302 Found)

Verify that visiting an active, unexpired, unprotected short link returns an immediate server-side HTTP 302 redirect with no client-side navigation.

```powershell
curl.exe -i "http://localhost:3000/go/<ACTIVE_CODE>"
```

**Expected Response:**

```http
HTTP/1.1 302 Found
Location: https://example.com/target-destination
Cache-Control: no-store
Referrer-Policy: no-referrer
X-Robots-Tag: noindex
```

_Note: No JavaScript or HTML page is rendered for an active, unprotected link._

---

### Scenario 2: Click Count Increment (Atomic `register_click`)

Verify that every 302 redirect durably increments the click counter by exactly 1.

```sql
-- Before request (in Supabase SQL editor):
SELECT code, clicks, last_clicked_at FROM short_links WHERE code = '<ACTIVE_CODE>';
```

```powershell
curl.exe -i "http://localhost:3000/go/<ACTIVE_CODE>"
```

```sql
-- After request:
SELECT code, clicks, last_clicked_at FROM short_links WHERE code = '<ACTIVE_CODE>';
-- Result: clicks increased by 1 and last_clicked_at updated.
```

---

### Scenario 3: Non-Existent Link (HTTP 404 Not Found)

Verify that querying an unknown slug returns HTTP 404 with `noindex` header.

```powershell
curl.exe -i "http://localhost:3000/go/non-existent-code"
```

**Expected Response:**

```http
HTTP/1.1 404 Not Found
X-Robots-Tag: noindex
Content-Type: text/html; charset=utf-8
```

_Renders the "Link not found" shell with a link back to `/link-shortener`._

---

### Scenario 4: Expired, Disabled, or Blocked Links (HTTP 410 Gone)

Verify that inactive or policy-violating links return HTTP 410 Gone with `noindex` header.

```powershell
# Expired link
curl.exe -i "http://localhost:3000/go/<EXPIRED_CODE>"

# Disabled link
curl.exe -i "http://localhost:3000/go/<DISABLED_CODE>"

# Blocked link / blocked domain
curl.exe -i "http://localhost:3000/go/<BLOCKED_CODE>"
```

**Expected Response:**

```http
HTTP/1.1 410 Gone
X-Robots-Tag: noindex
Content-Type: text/html; charset=utf-8
```

_Renders the corresponding 410 shell ("This short link has expired" / "This link has been disabled" / "This link has been removed")._

---

### Scenario 5: Password-Protected Link (HTTP 200 Form -> Native POST 302)

Verify that password-protected links do not disclose the destination URL until unlocked.

```powershell
# Step 1: Initial GET renders password prompt (200 OK)
curl.exe -i "http://localhost:3000/go/<PASSWORD_CODE>"
```

**Expected Initial Response:**

- Status: `200 OK`
- Header: `X-Robots-Tag: noindex`
- Body: Form containing `<input type="hidden" name="action" value="unlock" />` and password input. Target URL is completely absent from the HTML.

```powershell
# Step 2: Native form POST with incorrect password
curl.exe -i -X POST "http://localhost:3000/go/<PASSWORD_CODE>" `
  -H "Host: localhost:3000" `
  -H "Origin: http://localhost:3000" `
  -F "action=unlock" `
  -F "password=wrong-password"
```

**Expected Response:** `401 Unauthorized` with `X-Robots-Tag: noindex`.

```powershell
# Step 3: Native form POST with correct password
curl.exe -i -X POST "http://localhost:3000/go/<PASSWORD_CODE>" `
  -H "Host: localhost:3000" `
  -H "Origin: http://localhost:3000" `
  -F "action=unlock" `
  -F "password=<CORRECT_PASSWORD>"
```

**Expected Response:**

```http
HTTP/1.1 302 Found
Location: https://example.com/secret-target
Cache-Control: no-store
Referrer-Policy: no-referrer
X-Robots-Tag: noindex
```

---

### Scenario 6: Flagged Link Interstitial (`pending_review`)

Verify that a link flagged for community review renders the interstitial warning with destination preview and requires explicit continuation.

```powershell
# Step 1: Initial GET renders interstitial notice
curl.exe -i "http://localhost:3000/go/<FLAGGED_CODE>"
```

**Expected Initial Response:**

- Status: `200 OK`
- Warning notice: "Community Review Warning"
- Shows destination URL preview.
- Includes `<form method="post"><input type="hidden" name="action" value="continue" /></form>`.

```powershell
# Step 2: Native form POST to continue to destination
curl.exe -i -X POST "http://localhost:3000/go/<FLAGGED_CODE>" `
  -H "Host: localhost:3000" `
  -H "Origin: http://localhost:3000" `
  -F "action=continue"
```

**Expected Response:**

```http
HTTP/1.1 302 Found
Location: https://example.com/target-destination
Cache-Control: no-store
Referrer-Policy: no-referrer
X-Robots-Tag: noindex
```

---

### Scenario 7: Cross-Origin POST CSRF Protection (HTTP 403 Forbidden)

Verify that cross-site POST submissions are blocked by origin validation.

```powershell
curl.exe -i -X POST "http://localhost:3000/go/<ANY_CODE>" `
  -H "Host: localhost:3000" `
  -H "Origin: https://malicious-attacker.com" `
  -F "action=continue"
```

**Expected Response:**

```http
HTTP/1.1 403 Forbidden
X-Robots-Tag: noindex

Forbidden: Cross-site request rejected
```

---

### Scenario 8: Resolution Rate Limiting (HTTP 429 Too Many Requests)

Verify that exceeding rate limits (120 requests per 60s window) returns HTTP 429 with `Retry-After`.
Use a fast single-process burst (avoid `Start-Job`, which spawns 130 processes slowly and can straddle a 60s window boundary):

```powershell
node -e "Promise.all(Array.from({length:125}, () => fetch('http://localhost:3000/go/<ACTIVE_CODE>', {redirect:'manual'}).then(r => r.status))).then(s => console.log({ ok: s.filter(x => x === 302 || x === 200).length, rateLimited: s.filter(x => x === 429).length }))"
```

**Expected Output:** `ok: 120`, `rateLimited: 5`, with HTTP `429` responses containing:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-Robots-Tag: noindex
```

---

### Scenario 9: Anonymous Reporting Session Cookie

Verify that requests without a trusted client IP receive a signed reporting cookie (`_mrv_rep_sess`).

> **Note for `pnpm dev`:** In development (`NODE_ENV=development`), Next.js automatically populates `x-forwarded-for: ::1`, so `getClientIp()` resolves a local IP and intentionally skips issuing the fallback cookie. To simulate an unverified/no-IP client in dev, send an invalid `x-forwarded-for` header (or test under `NODE_ENV=production` with `pnpm start` and no `x-nf-client-connection-ip`):

```powershell
curl.exe -i -H "x-forwarded-for: invalid" "http://localhost:3000/go/<ANY_CODE>"
```

**Expected Header:**

```http
Set-Cookie: _mrv_rep_sess=...; Path=/; Max-Age=7200; HttpOnly; Secure; SameSite=Lax
```

---

## 3. Administrative Moderation API (`/api/admin/links/*`)

All admin endpoints run on dedicated Next.js Route Handlers under `app/api/admin/links/*`. They are strictly machine-to-machine, protected by the `x-admin-api-key` header, and return `Cache-Control: no-store` on all responses.

Set the admin API key environment variable in your PowerShell session for testing (matching `ADMIN_API_KEY` in `.env.local`):

```powershell
$env:ADMIN_API_KEY = "your-local-test-admin-key"
```

---

### Scenario 10: Unauthorized Request (Missing / Incorrect Key)

Verify that missing or incorrect API keys return HTTP 401 with a generic error message.

```powershell
# Missing key
curl.exe -i "http://localhost:3000/api/admin/links/reports"

# Wrong key
curl.exe -i "http://localhost:3000/api/admin/links/reports" `
  -H "x-admin-api-key: invalid-key"
```

**Expected Response:**

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{"error":{"code":"unauthorized","message":"Missing or invalid admin API key."}}
```

---

### Scenario 11: List Abuse Reports (`GET /api/admin/links/reports`)

List abuse reports with optional status filtering and pagination (limit clamped to 100).

```powershell
# List all reports (default 50)
curl.exe -i "http://localhost:3000/api/admin/links/reports" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY"

# Filter by open status with pagination
curl.exe -i "http://localhost:3000/api/admin/links/reports?status=open&limit=20&offset=0" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY"
```

**Expected Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{
  "data": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "code": "suspicious-slug",
      "reason": "phishing",
      "details": "Lookalike login portal",
      "status": "open",
      "is_unverified": false,
      "created_at": "2026-11-24T12:00:00.000Z"
    }
  ],
  "count": 1,
  "limit": 20,
  "offset": 0
}
```

---

### Scenario 12: Review/Resolve an Abuse Report (`PATCH /api/admin/links/reports`)

Transition an abuse report's moderation status to `reviewed`, `actioned`, or `dismissed`.

```powershell
curl.exe -i -X PATCH "http://localhost:3000/api/admin/links/reports" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"reportId\":\"11111111-2222-3333-4444-555555555555\",\"status\":\"reviewed\"}'
```

**Expected Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{"ok":true,"reportId":"11111111-2222-3333-4444-555555555555","status":"reviewed"}
```

---

### Scenario 13: Update Link Status & Restore (`POST /api/admin/links/status`)

Change a link's moderation status. When restoring to `active`, the database runs `admin_restore_link()` to transactionally reset status and resolve open reports.

```powershell
# Block a link and add its domain to the global blocklist
curl.exe -i -X POST "http://localhost:3000/api/admin/links/status" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"code\":\"suspicious-slug\",\"status\":\"blocked\",\"addDomain\":true}'

# Restore a flagged or blocked link back to active
curl.exe -i -X POST "http://localhost:3000/api/admin/links/status" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"code\":\"suspicious-slug\",\"status\":\"active\"}'
```

**Expected Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{"ok":true,"code":"suspicious-slug","status":"active"}
```

---

### Scenario 14: Manage Blocked Domains (`/api/admin/links/blocked-domains`)

Add, remove, and inspect domains in the global target blocklist.

```powershell
# Add a blocked domain
curl.exe -i -X POST "http://localhost:3000/api/admin/links/blocked-domains" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"domain\":\"phishing-gang.net\",\"source\":\"admin_investigation\"}'

# List blocked domains
curl.exe -i "http://localhost:3000/api/admin/links/blocked-domains" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY"

# Remove a blocked domain
curl.exe -i -X DELETE "http://localhost:3000/api/admin/links/blocked-domains?domain=phishing-gang.net" `
  -H "x-admin-api-key: $env:ADMIN_API_KEY"
```

**Expected Response (Add):**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{"ok":true,"domain":"phishing-gang.net","source":"admin_investigation"}
```

---

## 4. Database Security & Cleanup Checks

Verify Row-Level Security and stored data in Supabase SQL Editor:

```sql
-- Confirm RLS is enabled on all link-shortener tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('short_links', 'link_reports', 'blocked_domains', 'rate_limit_counters');

-- Confirm no raw IPs are stored (only salted hashes)
SELECT reporter_ip_hash FROM link_reports LIMIT 5;
SELECT key FROM rate_limit_counters LIMIT 5;
```

---

## 5. Stage 6 Frontend Verification Walkthrough (Browser UI)

The following procedures verify the interactive client-side creator management dashboard (`CreatorLinkManager`), local storage persistence (`useCreatorLinks`), creator token notices (`CreatorTokenNotice`), and status lifecycle.

### Scenario 15: Create Short Link and Receive Creator Management Key

1. Start the development server (`pnpm dev`) and navigate to `http://localhost:3000/link-shortener`.
2. In the URL field, paste `https://example.com/test-landing`.
3. Click **"Shorten Now"**.
4. **Expected UI State:**
   - **Short link ready** banner appears containing `/go/:code`, a **Copy** button, and (if enabled) the QR code PNG download card.
   - **Creator Token Notice** appears with amber accent styling, displaying:
     - Clear warning: _"Important: This key is the only way to edit, view statistics, change passwords, or disable your link. Lost keys cannot be recovered."_
     - The 43-character base64url creator token inside a selectable input box.
     - **Copy Key** button that copies the raw token to clipboard.
     - Confirmation note: _"Saved automatically to your device’s browser storage for quick management below."_
5. Open browser DevTools (`F12` -> Application -> Local Storage):
   - Key `mrv_creator_links` exists containing a JSON array with `{ code, creatorToken, url, createdAt }`.

---

### Scenario 16: Local Link Management Dashboard (`CreatorLinkManager`)

1. Scroll down on `http://localhost:3000/link-shortener` to **"Manage Your Short Links"**.
2. **Expected Card Display:**
   - Header shows `/go/:code` with an external link icon and quick **Copy** button.
   - Target destination URL displayed (`https://example.com/test-landing`).
   - Status badge displays **Active** in green (`border-emerald-500`).
   - Metrics grid displays:
     - **Clicks:** `0`
     - **Last Clicked:** `Never`
     - **Created:** Current date and time
     - **Expires:** `Never`
   - Action toolbar contains: **Disable Link**, **Edit Expiry**, **Password**, **Copy Key**, **Forget**, and a **Refresh** button.

---

### Scenario 17: Creator Disabling and Re-enabling Link

1. On the link card in **Manage Your Short Links**, click **"Disable Link"**.
2. **Expected UI State:**
   - Button briefly shows loading spinner.
   - Success alert appears: _"Link successfully disabled."_
   - Status badge switches to **Disabled** in neutral gray.
   - Button text switches to **"Enable Link"**.
3. In a new browser tab, navigate to `http://localhost:3000/go/:code`.
   - **Expected:** Server returns `HTTP 410 Gone` rendering the _"This link has been disabled by its creator"_ page.
4. Back in the manager tab, click **"Enable Link"**.
   - Status badge switches back to **Active**.
5. Re-visit `http://localhost:3000/go/:code` in the second tab.
   - **Expected:** Server returns `HTTP 302 Found` redirecting immediately to `https://example.com/test-landing`.
6. Return to `http://localhost:3000/link-shortener` and click the **Refresh** icon on the card:
   - **Clicks** counter updates from `0` to `1`.
   - **Last Clicked** updates from `Never` to the recent timestamp.

---

### Scenario 18: Update Password and Expiration

1. On the link card, click **"Password"**:
   - Sub-panel opens with password input.
   - Enter `my-secret-123` and click **"Set Password"**.
   - Alert displays: _"Password updated."_
2. Navigate to `http://localhost:3000/go/:code`:
   - Password prompt form is displayed (`HTTP 200`). Destination URL is not disclosed.
   - Enter `my-secret-123` and submit. Browser redirects (`HTTP 302`) to target destination.
3. In the link card, click **"Password"** -> **"Remove Password"**:
   - Alert displays: _"Password protection removed."_
4. Click **"Edit Expiry"**:
   - Select preset **"24 hours"** from dropdown and click **"Save Expiry"**.
   - Expiration metric updates from `Never` to the calculated 24-hour timestamp.

---

### Scenario 19: Forget Link & Import Key from Another Device

1. On the link card, click **"Forget"**.
2. Click **"Yes"** to confirm deletion from local storage.
3. **Expected UI State:**
   - Card is removed from the manager list.
   - If no other links exist, the empty state displays: _"No saved links on this device"_.
4. Click **"Import Link Key"** in the section header.
5. Enter the short code (e.g. `summer-sale`) and the previously copied creator token.
6. Click **"Import & Verify"**:
   - Link is verified against the server and re-added to local storage.
   - Card re-appears with full historical click stats and management controls restored.

---

### Scenario 20: Moderated & Blocked Link State Safeguards

1. If a link has received abuse reports and escalated to `pending_review`:
   - Status badge displays amber **Under Review** pill.
   - Warning banner displays: _"Under Community Review: This link received reports and displays an interstitial warning to visitors. It cannot be re-activated until an administrator reviews it."_
   - Creator **Enable Link** button is disabled to prevent bypassing moderation.
2. If an administrator blocked the link via `/api/admin/links/status`:
   - Status badge displays red **Blocked** pill.
   - Warning banner displays: _"Blocked: This link was disabled by administrators for security or policy violations. It cannot be edited or reactivated."_
   - All editing actions (**Enable**, **Edit Expiry**, **Password**) are disabled.

---

## 6. T-00036 Release Blockers (Not Yet Implemented)

The following items must be resolved before general public release:

1. **Rate-limit cleanup scheduler:** Configure `pg_cron` (recommended: `SELECT cron.schedule('prune-rate-limits', '0 * * * *', $$DELETE FROM public.rate_limit_counters WHERE window_end < now() - interval '1 hour';$$);`) or a scheduled serverless function to prune expired `rate_limit_counters` rows.
2. **Legal / Abuse pages:** Implement `/terms` and `/abuse-policy` routes linked from redirect interstitials.
3. **CSP headers:** Add strict `Content-Security-Policy` headers on inline HTML pages rendered by `app/go/[code]/route.ts`.
4. **Automated blocklist feed:** Currently domains are added/removed manually via `/api/admin/links/blocked-domains`.
