# Quilp — Pre-Deployment Checklist

Complete every item before going live. Items marked **[BLOCKING]** will cause the app
to malfunction if skipped.

---

## 1. Environment Variables (Vercel Dashboard)

Set all variables under **Project → Settings → Environment Variables**.
Use the `.env.example` file as the reference list.

- [ ] `NEXT_PUBLIC_SUPABASE_URL` **[BLOCKING]**
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` **[BLOCKING]**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **[BLOCKING]** — server-only; never expose client-side
- [ ] `OPENAI_API_KEY` **[BLOCKING]** — required for document generation and firm parsing
- [ ] `SIGNNOW_CLIENT_ID` — required for e-signature flow
- [ ] `SIGNNOW_CLIENT_SECRET` — required for SignNow OAuth
- [ ] `SIGNNOW_REDIRECT_URI` — must match the registered URI in SignNow exactly (`/api/auth/signnow/callback`)
- [ ] `SIGNNOW_ENV` — set to `production` for live deployments
- [ ] `SIGNNOW_WEBHOOK_SECRET` — HMAC secret for webhook signature verification
- [ ] `RESEND_API_KEY` **[BLOCKING]** — required for invoice and deadline emails
- [ ] `RESEND_FROM_EMAIL` **[BLOCKING]** — must be a verified domain in Resend
- [ ] `NEXT_PUBLIC_APP_URL` **[BLOCKING]** — e.g. `https://app.quilp.io`
- [ ] `ENCRYPTION_KEY` **[BLOCKING]** — 64-char hex; required for SignNow token storage
- [ ] `CRON_SECRET` **[BLOCKING]** — secures `/api/deadlines/alerts`
- [ ] `STRIPE_SECRET_KEY` — Phase 2; set before enabling billing
- [ ] `STRIPE_WEBHOOK_SECRET` — Phase 2
- [ ] `SENTRY_DSN` — recommended for production error tracking
- [ ] `SENTRY_AUTH_TOKEN` — required for source-map uploads
- [ ] `SENTRY_ORG` / `SENTRY_PROJECT`

---

## 2. Supabase

### Row-Level Security (RLS)

Verify RLS is **enabled** on every table:

- [ ] `firms`
- [ ] `users`
- [ ] `clients`
- [ ] `documents`
- [ ] `tax_documents`
- [ ] `deadlines`
- [ ] `invoices`
- [ ] `timeline_events`
- [ ] `notifications`
- [ ] `firm_templates`

Check via Supabase dashboard → Authentication → Policies, or run:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All `rowsecurity` values must be `true`.

### RLS Policies Applied

- [ ] `firms` — users can only read/write their own firm (`firm_id = auth.uid()` or owner check)
- [ ] `clients` — scoped to `firm_id` matching the authenticated user's firm
- [ ] `documents` — scoped to `firm_id`
- [ ] `tax_documents` — scoped via `client_id` → `firm_id`
- [ ] `deadlines` — scoped to `firm_id`
- [ ] `invoices` — scoped to `firm_id`
- [ ] `timeline_events` — scoped via `client_id` → `firm_id`
- [ ] Portal access — `clients` readable by service role only (via `createAdminClient`)

### Storage Buckets

- [ ] `invoices` bucket — set to **private** (not public)
- [ ] `firm-assets` bucket — set to **private** (not public)
- [ ] `portal-uploads` bucket — set to **private** (not public)
- [ ] Signed URL expiry configured (default 15 min for invoice PDFs)

### Database Indexes

Run in Supabase SQL editor to confirm indexes exist:

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Critical indexes to verify:
- [ ] `clients(firm_id)`
- [ ] `documents(firm_id)`
- [ ] `deadlines(firm_id, due_date)`
- [ ] `invoices(firm_id, status)`
- [ ] `clients(portal_token)` — unique

---

## 3. SignNow

- [ ] App registered in SignNow developer console; switch to production credentials before go-live
- [ ] OAuth redirect URI registered: `https://app.quilp.io/api/auth/signnow/callback`
- [ ] Webhook URL configured in SignNow dashboard:
  `https://app.quilp.io/api/webhooks/signnow`
- [ ] Webhook event selected: `document.complete`
- [ ] HMAC-SHA256 secret for webhook validation set in SignNow and matches `SIGNNOW_WEBHOOK_SECRET`

---

## 4. Stripe (Phase 2)

- [ ] Stripe account in live mode
- [ ] Products and prices created in Stripe dashboard matching plan IDs in code
- [ ] Webhook endpoint registered in Stripe dashboard:
  `https://app.quilp.io/api/stripe/webhook`
- [ ] Webhook events selected: `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] `STRIPE_WEBHOOK_SECRET` set from the webhook endpoint's signing secret

---

## 5. Resend / Email

- [ ] Domain `quilp.io` verified in Resend (DNS records added: SPF, DKIM, DMARC)
- [ ] Sender address `noreply@quilp.io` (or chosen address) active
- [ ] Email send test: invoice delivery working end-to-end
- [ ] Email send test: deadline alert working end-to-end

---

## 6. Cron Jobs

- [ ] Deadline alerts cron configured (e.g. Vercel Cron, GitHub Actions, or external service)
- [ ] Schedule: daily at 08:00 UTC recommended
- [ ] Cron calls `POST https://app.quilp.io/api/deadlines/alerts`
  with header `Authorization: Bearer <CRON_SECRET>`

---

## 7. Domain & DNS

- [ ] Custom domain configured in Vercel: `app.quilp.io`
- [ ] DNS A/CNAME records pointed to Vercel
- [ ] SSL certificate provisioned (automatic via Vercel)
- [ ] `NEXT_PUBLIC_APP_URL` set to `https://app.quilp.io` (no trailing slash)
- [ ] Redirect `quilp.io` → `app.quilp.io` or marketing site as appropriate

---

## 8. Final Smoke Tests

Run these manually after deploying to production:

- [ ] Sign up flow completes (onboarding steps 1–4 work end-to-end)
- [ ] Dashboard loads with correct firm data
- [ ] Document generation produces valid output
- [ ] Invoice creation generates PDF and sends email
- [ ] Portal link opens at `app.quilp.io/portal/<token>`
- [ ] Portal submission marks `portal_submitted_at` on the client row
- [ ] SignNow connect flow completes (OAuth round-trip)
- [ ] Deadline cron fires and creates notifications (test with a manual POST)
- [ ] Paywall overlay shown when trial expires (test with a past-due subscription row)
- [ ] Cross-firm data access blocked (attempt to fetch another firm's client — expect 403/404)
- [ ] File uploads are not publicly accessible (attempt direct URL without signed token — expect 400)
