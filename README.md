# The Agentic Players Ball

A private circle for the founders, builders, and researchers shaping the agentic era.

Live at [agenticplayersball.com](https://agenticplayersball.com).

---

## What this is

A single-page invite-application site for The Agentic Players Ball. Visitors fill out a form requesting an invite; submissions land in Airtable as **Applicant** records for review.

This README is the technical reference for the project — how it fits together, how to make changes, and the known gotchas.

---

## Architecture (one diagram, kept honest)

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                                                                        │
 │   Visitor → agenticplayersball.com (Cloudflare Pages, static HTML)     │
 │                                                                        │
 │            ↓ form submit (POST JSON)                                   │
 │                                                                        │
 │            /api/signup  (Cloudflare Pages Function, also CF edge)      │
 │                                                                        │
 │            ↓ validate + normalise + POST                               │
 │                                                                        │
 │            Airtable REST API → People table                            │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘

 GitHub repo (GuiseBule/agenticplayers) → Cloudflare Pages auto-deploy on push to main.
```

No backend server. No database. No build step. Everything is either static or a single edge function.

---

## File structure

```
/
├── index.html               # The whole site. HTML + CSS + JS in one file.
├── functions/
│   └── api/
│       └── signup.js        # Pages Function: receives form, calls Airtable
├── agenticplayers.png       # Mascot image (full disco ball + face + hands)
├── agenticp.png             # Variant mascot
├── agenticplayersballdisco.jpg  # Original source asset
├── favicon.svg              # Vector disco ball favicon (clean, no face)
├── favicon.ico              # Multi-size 16/32/48/64 ICO (rasterised from svg)
├── favicon-16.png           # Small PNG favicon
├── favicon-32.png           # Standard PNG favicon
├── apple-touch-icon.png     # 180×180 iOS home-screen icon
├── favicon-source-clean.png # Pre-rasterisation source for the clean disco ball
├── social-card.png          # 1200×630 OG/Twitter share image (disco ball on black)
├── sitemap.xml              # SEO sitemap
├── robots.txt               # Allow crawlers, block /api/ and /functions/
├── .gitignore               # Excludes .DS_Store, node_modules, .env, .secrets/
├── .secrets/                # Local-only Airtable PAT (gitignored, do NOT commit)
│   └── airtable-pat
└── README.md                # You are here.
```

**Note:** the project lives inside `/Users/bigmac/MEGA/MEGA/agenticplayers/`. MEGA syncs the directory across devices and to MEGA's cloud — the `.secrets/` subdirectory is gitignored but **still syncs through MEGA**. Treat it as semi-private. Production secrets go into Cloudflare Pages env vars, not the local file.

---

## How the form works

The form (`<form id="signup-form">` in `index.html`) is plain HTML enhanced with vanilla JS:

1. **Field validation runs on the client first** — touch-on-blur, visual error states (`.field.is-invalid`), per-field red error messages (`<small class="field-error">`), submission is blocked client-side if any field is invalid. The first invalid field scrolls into view.

2. **On submit**, the JS POSTs JSON to `/api/signup` (the Pages Function). Submit button shows "Submitting…" while in flight.

3. **The Pages Function re-validates everything server-side** (never trust the client) and POSTs to Airtable. If Airtable accepts the record, the function returns `{ ok: true }`. Otherwise it returns a human-readable error.

4. **On success**, the entire signup card is replaced with a thank-you message. On failure, a red error banner appears below the submit button.

### Validation rules (client and server are kept in sync)

| Field | Required | Rule |
|---|---|---|
| First name | yes | non-empty (auto title-cased server-side) |
| Last name | yes | non-empty (auto title-cased server-side) |
| Email | yes | valid format AND not a disposable domain (mailinator, tempmail, etc.) |
| LinkedIn | yes | matches `linkedin.com/in/`, `/company/`, or `/pub/` (with or without `https://`) |
| GitHub | no | if filled, must match `github.com/...` |
| Telegram Handle | yes | public username only — `@handle`, `handle`, `t.me/handle`, or `https://t.me/handle` all accepted, normalised to `@handle` |
| Identity | yes | at least one of Founder / Builder / Researcher |
| Why are you agentic? | yes | non-empty |
| Have you been referred? | no | if checked, referrer LinkedIn URL is required and must validate as LinkedIn |

Server-side normalisation:
- Names → Title Case (with apostrophe + hyphen handling: `o'brien-jones` → `O'Brien-Jones`)
- Email → lowercased
- URLs without `https://` → prepended automatically
- Trailing slashes stripped
- Telegram → always saved as `@handle`

---

## Airtable schema

**Account:** Guise's personal Airtable (NOT Roch Dog).
**Base:** `Agentic Players` (`appYDL9J8IaCz24Vf`)
**Table:** `People` (`tblOkbG4yK4sk6zjs`)

| Field | Type | Notes |
|---|---|---|
| First Name | singleLineText | primary field |
| Last Name | singleLineText | |
| Email | email | |
| LinkedIn | url | |
| GitHub | url | optional |
| Telegram | singleLineText | always `@handle` |
| Identity | multipleSelects | Founder / Builder / Researcher |
| Why | multilineText | the applicant's pitch |
| Referrer LinkedIn | url | optional |
| Status | singleSelect | **Applicant** (default on create) / **Member** / **Declined** |
| Decline Reason | multilineText | private, your eyes only |
| Notes | multilineText | private, your eyes only |
| Submitted At | dateTime | written by the Pages Function on insert |

**Workflow:** All form submissions arrive with Status = `Applicant`. Open Airtable, review the row, click the Status cell, pick **Member** to approve or **Declined** with a reason. One click per applicant.

There is also a leftover empty `Signups` table and the default `Table 1` from base creation — both can be deleted in the Airtable UI when convenient.

---

## Cloudflare Pages

**Account:** Guise's personal Cloudflare (NOT Roch Dog).
**Project:** `agenticplayers`
**Production branch:** `main`
**Custom domain:** `agenticplayersball.com`
**Pages URL:** `agenticplayers.pages.dev`

### Required environment variables

Set in **Cloudflare dashboard → Pages → agenticplayers → Settings → Variables and Secrets** for **Production**:

| Variable | Type | Value |
|---|---|---|
| `AIRTABLE_PAT` | **Encrypted** | Personal Access Token scoped to the Agentic Players base, with `data.records:write` |
| `AIRTABLE_BASE_ID` | Plain | `appYDL9J8IaCz24Vf` |
| `AIRTABLE_TABLE` | Plain | `People` |

**Important:** When you change env vars, you MUST redeploy the latest deployment for the function to pick them up. (Deployments tab → ⋯ on latest → Retry deployment.)

---

## Deploy process

1. Edit files locally
2. Test locally (see below)
3. `git push origin main`
4. Cloudflare Pages auto-deploys in ~30 seconds
5. Verify at `agenticplayersball.com`

That's it. No build, no CI, no staging environment. The push IS the deploy.

---

## Local development

The site is plain static HTML so you can open `index.html` directly in a browser (`file://`) for quick edits. **But** the Pages Function won't work locally that way, and `fetch("/")` calls in JS won't resolve correctly.

For proper local testing, serve the directory:

```bash
cd "/Users/bigmac/MEGA/MEGA/agenticplayers"
python3 -m http.server 8765
# Visit http://localhost:8765/
```

This gives you the static site at localhost; the form's `/api/signup` will 404 because Pages Functions only run on Cloudflare's edge. To test the function end-to-end, push to a branch and use Cloudflare's preview deployments.

### Responsive screenshots with Playwright

Used during development to verify mobile/desktop look good without pushing:

```bash
node /tmp/local-mobile.mjs
# Screenshots written to /tmp/agp-shots/
```

The script lives in `/tmp/` because it's a dev tool, not part of the project. Recreate as needed.

---

## Local secrets

The Airtable PAT lives at `.secrets/airtable-pat` (gitignored). Used during development for direct API calls (e.g. checking what Airtable schema looks like). Production reads the PAT from Cloudflare's encrypted env, never from the local file.

If you need to test Airtable directly:

```bash
PAT=$(cat .secrets/airtable-pat)
curl -s -H "Authorization: Bearer $PAT" \
  "https://api.airtable.com/v0/appYDL9J8IaCz24Vf/People?pageSize=5" | python3 -m json.tool
```

---

## Known gotchas

- **Safari caches favicons aggressively** — even with `?v=N` cache-busts. To force-refresh: Settings → Privacy → Manage Website Data → search the domain → Remove. Then quit and reopen Safari.

- **MEGA sync ≠ git ignore.** `.secrets/` is gitignored but MEGA still syncs it across devices and to their cloud. Production secrets must live in Cloudflare env vars only.

- **Cloudflare env vars need a redeploy** to take effect. Adding/changing them silently doesn't update running functions.

- **Pages Functions don't run locally** with a plain HTTP server. Use Cloudflare preview branches for end-to-end testing.

- **The disposable email blocklist is hardcoded** in `functions/api/signup.js`. ~30 of the most common throwaway domains. If a determined applicant uses a niche disposable provider, they get through. The blocklist is best-effort, not bulletproof.

- **The mascot has a face that disappears at favicon sizes.** That's why the favicon is a separate clean disco ball (no face) — the SVG and the rasterised PNGs/ICO all use the simplified version.

- **Form chip selection state uses CSS `:has()`.** Works in all modern browsers (Safari 15.4+, Chrome 105+, Firefox 121+). If you need to support older browsers, this needs a JS fallback.

---

## SEO and social

- **`<head>`** has full Open Graph + Twitter Card meta + JSON-LD schema (Organization + WebSite types)
- **`social-card.png`** is the 1200×630 share image — disco ball on black background
- **`sitemap.xml`** lists the homepage; submit to Google Search Console and Bing Webmaster Tools manually for fastest indexing
- **`robots.txt`** allows crawlers, blocks `/api/` and `/functions/`

If you change the meta description or title, update both the meta tags AND both JSON-LD blocks (Organization description + WebSite description) so they stay in sync.

---

## Adding a new field to the form

1. Add the input to `index.html` inside `<form id="signup-form">`
2. Add a `<small class="field-error"></small>` slot beneath it
3. Add a validation rule to the JS `rules` object near the bottom of `index.html` (or to `validateReferrer` / `validateIdentity` for special cases)
4. Add the field to the JSON payload in the submit handler
5. In `functions/api/signup.js`: parse the field, validate it, add it to the `fields` object passed to Airtable
6. In Airtable: create the field on the People table (manually in UI or via Meta API)
7. Push, redeploy, test

---

## When something breaks

- **Form returns 500** — check Cloudflare Pages → Functions → Real-time logs. Most likely an env var is missing or the Airtable schema doesn't match.
- **Form returns 502** — Airtable rejected the record. Likely a field name typo or a value type mismatch (e.g. sending a string to a multipleSelects field).
- **No record in Airtable but form shows success** — would be a bug in the Pages Function, but currently it returns `ok: true` only after Airtable confirms the insert, so this shouldn't happen. Check the Airtable view filter — your record might be hidden by a filter rather than missing.
- **Favicon won't update** — Safari cache. See gotcha above.
- **Form looks great on desktop but broken on mobile** — check `@media (max-width: 700px)` block in `index.html`. That's where mobile overrides live.

---

## Repo

[github.com/GuiseBule/agenticplayers](https://github.com/GuiseBule/agenticplayers) (private)
