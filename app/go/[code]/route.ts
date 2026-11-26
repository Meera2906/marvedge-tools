/**
 * HTTP redirect route for /go/[code]
 * DESIGN.md §8 — Real HTTP redirects, password unlock, pending-review interstitial.
 * No client-side navigation. All redirects are server-side HTTP 302.
 */

import { resolveShortLinkService, handleGoPostService } from "@/lib/links/service.server";

const REDIRECT_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

/** Password unlock form HTML */
function passwordForm(
  code: string,
  error?: string,
  isPendingReview = false,
): string {
  const errorHtml = error
    ? `<p role="alert" style="color:#9F2D18;font-size:0.85rem;margin-bottom:1rem">${escHtml(error)}</p>`
    : "";
  const reviewBanner = isPendingReview
    ? `<div role="alert" style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.85rem;color:#78350f">
        <strong>⚠ Under Community Review:</strong> This link has been flagged for moderation review.
        Enter the correct password to continue.
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Password Required — Marvedge Short Link</title>
  <meta name="robots" content="noindex,nofollow">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#FAF7F0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border:1px solid #D6CCB5;border-radius:16px;padding:2rem;max-width:400px;width:100%;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    h1{font-size:1.1rem;font-weight:600;margin-bottom:.5rem;color:#000}
    p.sub{font-size:.85rem;color:#4A4740;margin-bottom:1.25rem}
    input{width:100%;border:1px solid #D6CCB5;border-radius:8px;padding:.6rem .9rem;font-size:.9rem;background:#FAF7F0;margin-bottom:1rem;outline:none}
    input:focus{border-color:#000;background:#fff;box-shadow:0 0 0 2px rgba(120,149,178,.4)}
    button{width:100%;background:#000;color:#fff;border:none;border-radius:10px;padding:.75rem 1rem;font-size:.9rem;font-weight:600;cursor:pointer}
    button:hover{background:#1A1A1A}
    .shield{font-size:2rem;margin-bottom:1rem;text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <div class="shield">🔒</div>
    <h1>Password Required</h1>
    <p class="sub">This short link is password protected. Enter the password to continue.</p>
    ${reviewBanner}
    ${errorHtml}
    <form method="POST" action="/go/${escHtml(code)}">
      <input type="hidden" name="action" value="unlock">
      <input type="password" name="password" placeholder="Enter password" required autofocus autocomplete="current-password">
      <button type="submit">Unlock &amp; Continue</button>
    </form>
  </div>
</body>
</html>`;
}

/** Pending-review interstitial HTML */
function pendingReviewPage(code: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Link Under Review — Marvedge Short Link</title>
  <meta name="robots" content="noindex,nofollow">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#FAF7F0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border:1px solid #D6CCB5;border-radius:16px;padding:2rem;max-width:460px;width:100%;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    h1{font-size:1.1rem;font-weight:600;margin-bottom:.5rem;color:#000}
    .banner{background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:.75rem 1rem;margin:1rem 0;font-size:.85rem;color:#78350f}
    .dest{background:#FAF7F0;border:1px solid #D6CCB5;border-radius:8px;padding:.5rem .8rem;font-size:.8rem;font-family:monospace;word-break:break-all;color:#000;margin-bottom:1rem}
    p.sub{font-size:.85rem;color:#4A4740;margin-bottom:1.25rem}
    .actions{display:flex;gap:.5rem;justify-content:flex-end}
    .btn-back{background:#fff;color:#4A4740;border:1px solid #D6CCB5;border-radius:10px;padding:.6rem 1.2rem;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none}
    .btn-continue{background:#000;color:#fff;border:none;border-radius:10px;padding:.6rem 1.2rem;font-size:.85rem;font-weight:600;cursor:pointer}
    .btn-continue:hover{background:#1A1A1A}
    .icon{font-size:2rem;text-align:center;margin-bottom:1rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>This Link Is Under Review</h1>
    <div class="banner">
      <strong>Community-Flagged Content:</strong> This short link has been reported and is awaiting
      moderation review. Proceed only if you trust the destination.
    </div>
    <p class="sub">Destination:</p>
    <div class="dest">${escHtml(url)}</div>
    <div class="actions">
      <a href="/" class="btn-back">Go Back</a>
      <form method="POST" action="/go/${escHtml(code)}" style="display:inline">
        <input type="hidden" name="action" value="continue">
        <button type="submit" class="btn-continue">Continue to Destination</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

/** Error page (410 / 404) */
function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(title)} — Marvedge Short Link</title>
  <meta name="robots" content="noindex,nofollow">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#FAF7F0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border:1px solid #D6CCB5;border-radius:16px;padding:2rem;max-width:400px;width:100%;box-shadow:0 1px 4px rgba(0,0,0,.08);text-align:center}
    h1{font-size:1.1rem;font-weight:600;margin-bottom:.5rem;color:#000}
    p{font-size:.85rem;color:#4A4740;margin-bottom:1.25rem}
    a{color:#537190;font-weight:600;text-decoration:underline}
    .icon{font-size:2.5rem;margin-bottom:1rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔗</div>
    <h1>${escHtml(title)}</h1>
    <p>${escHtml(message)}</p>
    <a href="/">Back to Marvedge Tools</a>
  </div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;

  const responseHeaders = new Headers();
  let responseStatus = 200;

  const result = await resolveShortLinkService(
    { code },
    {
      req: request,
      responseHeaders,
      setResponseStatus: (s) => {
        responseStatus = s;
      },
    },
  );

  // Carry through any Set-Cookie from the service (reporting session cookie)
  const setCookie = responseHeaders.get("Set-Cookie");

  switch (result.status) {
    case "ok":
      return new Response(null, {
        status: 302,
        headers: {
          Location: result.url,
          ...REDIRECT_HEADERS,
          ...(setCookie ? { "Set-Cookie": setCookie } : {}),
        },
      });

    case "password":
      return new Response(passwordForm(code), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex",
          "Cache-Control": "no-store",
          ...(setCookie ? { "Set-Cookie": setCookie } : {}),
        },
      });

    case "password_pending_review":
      return new Response(passwordForm(code, undefined, true), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex",
          "Cache-Control": "no-store",
          ...(setCookie ? { "Set-Cookie": setCookie } : {}),
        },
      });

    case "pending_review":
      return new Response(pendingReviewPage(code, result.url), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex",
          "Cache-Control": "no-store",
          ...(setCookie ? { "Set-Cookie": setCookie } : {}),
        },
      });

    case "rate_limited":
      return new Response(
        errorPage("Too Many Requests", "You have made too many requests. Please try again later."),
        {
          status: 429,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Retry-After": String(result.retryAfter),
            "X-Robots-Tag": "noindex",
            "Cache-Control": "no-store",
            ...(setCookie ? { "Set-Cookie": setCookie } : {}),
          },
        },
      );

    case "expired":
      return new Response(
        errorPage("Link Expired", "This short link has expired and is no longer active."),
        {
          status: 410,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...REDIRECT_HEADERS,
            ...(setCookie ? { "Set-Cookie": setCookie } : {}),
          },
        },
      );

    case "disabled":
      return new Response(
        errorPage("Link Unavailable", "This link has been disabled by its creator."),
        {
          status: 410,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...REDIRECT_HEADERS,
            ...(setCookie ? { "Set-Cookie": setCookie } : {}),
          },
        },
      );

    case "blocked":
      return new Response(
        errorPage(
          "Link Removed",
          "This link has been removed due to a violation of our content policies.",
        ),
        {
          status: 410,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...REDIRECT_HEADERS,
            ...(setCookie ? { "Set-Cookie": setCookie } : {}),
          },
        },
      );

    case "missing":
    default:
      return new Response(
        errorPage("Link Not Found", "This short link does not exist or may have been removed."),
        {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...REDIRECT_HEADERS,
            ...(setCookie ? { "Set-Cookie": setCookie } : {}),
          },
        },
      );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;
  const response = await handleGoPostService(request, code);

  if (response.status === 401) {
    return new Response(
      passwordForm(code, "Incorrect password. Please check your password and try again."),
      {
        status: 401,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return response;
}
