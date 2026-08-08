# Multi-Rate Pricing Calculator

A small full-stack app for creating documents (quotes/invoices) with line items, per-line discounts and tax, server-computed totals, a draft/finalized lifecycle, and a date-range summary report.

Stack: **Next.js (App Router) + TypeScript + MongoDB (Mongoose)**, JWT auth via httpOnly cookies, Jest for calculation unit tests.

## Prerequisites

- Node.js 20+
- A MongoDB instance (local `mongod`, or a free MongoDB Atlas cluster)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the two variables below
npm run dev                  # http://localhost:3000
```

Environment variables (`.env.local`):

| Variable | Description |
|---|---|
| `MONGODB_URI` | Mongo connection string, e.g. `mongodb://127.0.0.1:27017/pricing_calculator` |
| `JWT_SECRET` | Any long random string used to sign session tokens |

Other commands:

```bash
npm run test    # unit tests for the calculation module
npm run lint     # ESLint
npm run build    # production build
```

## Calculation and rounding policy

All money is stored and computed as **integer cents**, never as floating-point dollars, to avoid binary floating-point drift. Dollars are converted to cents only at the API boundary (`dollarsToCents` / `centsToDollars` in [`src/lib/calc.ts`](src/lib/calc.ts)).

**Policy: round-half-up to the nearest cent, applied once at each computed step** — subtotal, discount amount, and tax amount are each rounded individually as they're produced. Line total and document totals are then exact integer sums of already-rounded values, so no further rounding is ever applied downstream. This means a document's grand total always reconciles two ways: as the sum of line totals, and as `subtotal − totalDiscount + totalTax`.

Per line, in order:
1. `subtotal = round(quantity × unitPrice)`
2. `discountAmount` = a **percent** discount is `round(subtotal × pct/100)`; a **fixed** discount is used as given, **clamped** to the subtotal (see below) — a line can have one or the other, never both
3. `afterDiscount = subtotal − discountAmount`
4. `taxAmount = round(afterDiscount × taxPct/100)` — tax is computed on the discounted amount, not the original subtotal
5. `lineTotal = afterDiscount + taxAmount`

**Worked example** (matches the assignment's sample document exactly):

| Line | Qty | Unit price | Subtotal | Discount | After discount | Tax | Line total |
|---|---|---|---|---|---|---|---|
| Widget A | 2 | $100.00 | $200.00 | 10% → $20.00 | $180.00 | 5% of 180 → $9.00 | $189.00 |
| Widget B | 1 | $50.00 | $50.00 | — | $50.00 | 5% of 50 → $2.50 | $52.50 |
| Service fee | 1 | $200.00 | $200.00 | $20 fixed | $180.00 | — | $180.00 |

Document totals: subtotal **$450.00**, total discount **$40.00**, total tax **$11.50**, grand total **$421.50** (= 189.00 + 52.50 + 180.00 = 450 − 40 + 11.50). Verified in [`src/lib/__tests__/calc.test.ts`](src/lib/__tests__/calc.test.ts).

A dedicated test also exercises a fractional-quantity case (2.5 units) specifically because that's where naive `Math.round` on raw floats is most likely to drift — the module nudges by `1e-9` before rounding to correct for binary representation error at exact `.5`-cent boundaries.

## Finalize / immutability rules

- A document is created as `draft`. Drafts are fully editable: metadata, and line items (add/edit/remove).
- `POST /api/documents/:id/finalize` transitions `draft → finalized`. Finalize also re-validates that every line still has `quantity > 0` and a non-negative price — this is redundant with write-time validation but is kept as an explicit finalize-time check per the assignment.
- Once `finalized`, a document is **read-only**: any attempt to edit its metadata, add a line, edit a line, or delete a line is rejected with **409 Conflict** and a clear error message. Deleting a finalized document is also rejected (treated as a mutation, not just "editing").
- `POST /api/documents/:id/duplicate` copies a **finalized** document into a brand-new `draft` (stretch goal). The copy's issue date resets to today rather than carrying over the original's — see Assumptions below.

## API

All endpoints except `/api/auth/*` require an authenticated session (httpOnly cookie set on signup/login).

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account, starts session |
| POST | `/api/auth/login` | Start session |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/documents` | List own documents (`?status=draft\|finalized`, `?page=`, `?limit=`) |
| POST | `/api/documents` | Create a draft (optionally with initial `lineItems`) |
| GET | `/api/documents/:id` | Fetch one (owner-scoped) |
| PATCH | `/api/documents/:id` | Update metadata (draft only) |
| DELETE | `/api/documents/:id` | Delete (draft only) |
| POST | `/api/documents/:id/lines` | Add a line item (draft only) |
| PATCH | `/api/documents/:id/lines/:lineId` | Edit a line item (draft only, partial update) |
| DELETE | `/api/documents/:id/lines/:lineId` | Remove a line item (draft only) |
| POST | `/api/documents/:id/finalize` | Finalize a draft |
| POST | `/api/documents/:id/duplicate` | Duplicate a finalized document into a new draft |
| GET | `/api/reports/summary` | `?from=&to=&status=` — count and totals for documents with `issueDate` in range |

Validation errors return `400` with a `details` array of `{ path, message }`. Ownership/not-found is always `404` (never `403`), so a document's existence isn't leaked to non-owners.

## Assumptions and tradeoffs

- **Fixed discount exceeding the line subtotal is clamped, not rejected** — the line floors at $0 rather than returning a 400. Documented per the assignment's explicit either/or.
- **Report date range is inclusive on both ends** and filters on `issueDate`, not `createdAt`. `to` is treated as inclusive of that entire calendar day.
- **Report includes documents of any status by default** (draft and finalized), with an optional `status` filter — the assignment doesn't restrict this to finalized-only, and a user plausibly wants to see draft pipeline too.
- **Duplicate resets the issue date to today** — a new draft is a new document being drafted now; carrying over the original's date would misrepresent when it was actually issued.
- **Line items are embedded documents**, not a separate collection — a document and its lines share one lifecycle (draft/finalized) and are always read/written together, so embedding avoids join-like queries and keeps finalize-immutability a single-document operation.
- **Document totals are denormalized** (cached on the document) rather than recomputed on every read — they're recalculated and persisted on every write (line add/edit/remove), so reads and the summary report aggregation stay cheap even as a document accumulates history.
- **Quantity accepts decimals** (e.g., 2.5 hours), not just integers — the assignment doesn't restrict this, and it's a realistic billing case.
- Deleting a finalized document is blocked, matching the spirit of "read-only," even though the assignment's immutability wording focuses on edits.

## What I'd improve before production

- Rate limiting on `/api/auth/*` (brute-force protection) and structured audit logging on finalize/delete.
- Idempotency keys on document/line mutation endpoints to make client retries safe.
- Move the discount/tax percent's implicit precision assumption (currently unrounded percent inputs, e.g. `7.333%`) into an explicit, documented precision limit.
- Cursor-based pagination for `/api/documents` instead of page/limit, once collections get large.
- A queue-backed export/printable-view (stretch goal) instead of synchronous HTML generation.
- Integration tests against a real Mongo instance (current tests cover the calculation module only, which is the highest-value surface, but route-level tests would catch regressions in the 409/404 authorization logic).

## Repository

https://github.com/mahi0601/pricing-calculator

## Deployment

**Live URL:** _TODO — fill in after deploying, per the steps below._

Deploy target: Vercel (frontend + API routes) with MongoDB Atlas as the database.

1. **Database** — create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas). Add a database user, allow network access from anywhere (0.0.0.0/0, since Vercel's serverless functions have no fixed IP), and copy the connection string.
2. **Deploy** — go to [vercel.com/new](https://vercel.com/new), import the `mahi0601/pricing-calculator` GitHub repo, and before the first deploy set these Project Environment Variables:
   - `MONGODB_URI` — the Atlas connection string from step 1 (include a database name in the path, e.g. `.../pricing_calculator?retryWrites=true...`)
   - `JWT_SECRET` — a long random string (e.g. `openssl rand -base64 32`)
3. Click Deploy. Vercel builds with `npm run build` and serves the API routes as serverless functions automatically — no extra config needed.
4. Paste the resulting `*.vercel.app` URL into this README and into the submission email.
