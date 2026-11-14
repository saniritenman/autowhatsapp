# AutoWhatsApp

Current deployment progress and remaining steps: [DEPLOYMENT.md](DEPLOYMENT.md).

A React/Vite interface with Supabase Auth, private Postgres records and Storage, and a durable server-side WhatsApp Cloud API queue.

## What was found

The empty AutoWhatsApp workspace had no existing code. The nearby `C:/Users/User/Desktop/Bana-App/bottletrack-github-ready` project is **BottleTrack**, using React 18, Vite, GitHub Pages and Supabase. Its README explicitly describes a public inventory with **no sign-in**. Only an empty `.env.example` was present. Its source and database were not changed. The owner confirmed that this is the reference app, and clarified that AutoWhatsApp must be an entirely independent project.

This app reuses only that technology stack and the owner’s GitHub/Supabase accounts. It requires its own GitHub repository, website URL and separate Supabase project. It adds isolated `aw_*` tables, a private `autowhatsapp` bucket, and Supabase Auth instead of inheriting BottleTrack's public inventory permissions. Supabase and GitHub were subsequently connected through authorized integrations. The separate backend and website are now deployed; see DEPLOYMENT.md for verified state and remaining Meta configuration.

## Local development

Node 22.18+ recommended (tests directly load TypeScript). Run `npm ci`, `npm test`, `npm run dev`. Copy `.env.example` to `.env.local` and fill the **public** Supabase URL and publishable key. Run `npm run build` for `dist/`. Never put a service-role key or Meta token in `VITE_*` values.

Without Supabase configuration the app displays an empty preview workspace. Forms and review work, but saving is blocked with an explicit setup message. It does not fabricate contacts, delivery history or a successful connection.

## Deployment: independent GitHub repository and Supabase project

1. Create a new Supabase project named AutoWhatsApp in the owner’s existing Supabase account. Do not link this checkout to BottleTrack’s project or reuse its database, storage, API keys or auth users. Review and apply `supabase/migrations/20261114115631_autowhatsapp_initial.sql` using its SQL Editor, or link this checkout with the Supabase CLI and run `supabase db push`. This adds tables and policies; it does not edit BottleTrack's inventory. Verify the policies in staging before production.
2. Enable Supabase email OTP/magic-link authentication. Set the Auth Site URL and redirect allowlist to the final frontend URL (and localhost for development). Users sign in to this new project independently; BottleTrack itself has no users to migrate. Public signups should be disabled if only existing invited users should access the app. A private Sites audience is an additional outer access gate.
The checked-in src/config.json contains only this app’s public URL and publishable key, so CI builds work without secrets. Environment variables override these public defaults.

3. Create a separate `autowhatsapp` repository under the owner’s existing GitHub account and push only this workspace. Set Pages to deploy through GitHub Actions. Build with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Deploy `dist/` through GitHub Pages (workflow included) or Sites. GitHub Pages cannot run the queue; the Supabase functions below must be deployed independently.
4. Deploy `dispatch` and `webhook` with `supabase functions deploy dispatch` and `supabase functions deploy webhook`. The checked-in config disables Supabase JWT verification for these two routes because dispatch verifies its own cron bearer secret and webhook verifies Meta HMAC. Keep the platform-provided service-role key server-only.
5. Set Edge Function secrets in the Supabase dashboard: `AW_CRON_SECRET` (high-entropy random value), `META_ACCESS_TOKEN` (business system-user token with required messaging permissions), `META_PHONE_NUMBER_ID`, `META_API_VERSION` (a currently supported Graph version from the Meta dashboard), `META_APP_SECRET`, `META_VERIFY_TOKEN` (random webhook verification string), and `ENABLE_LIVE_SEND=false`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to functions. Never commit these values.
6. Configure Meta's webhook callback as `https://<project-ref>.supabase.co/functions/v1/webhook`, its verify token, and the messages subscription. Only events for `META_PHONE_NUMBER_ID` are accepted. Signature verification uses the Meta app secret. Inbound messages establish the recipient's 24-hour reply window; delivery webhooks update history.
7. Enable Supabase Cron (`pg_cron`), `pg_net` and Vault. Save secrets named `aw_dispatch_url` (full dispatch function URL) and `aw_cron_secret` in Vault through the dashboard. Run the following once. Inspect `cron.job` before running it again to avoid duplicate schedules:

```sql
select cron.schedule('autowhatsapp-dispatch', '* * * * *', $cron$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='aw_dispatch_url'),
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
    (select decrypted_secret from vault.decrypted_secrets where name='aw_cron_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
 );
$cron$);
```

8. While live sending remains disabled, verify the endpoint returns `{"disabled":true}` through authenticated server-side tooling; verify another user's schedules and attachments are inaccessible. Sign in, upload a file and save/read back a schedule across two devices. These integration checks require your actual Supabase project and have not been run here.
9. **Do not enable live sending until the owner explicitly approves a test recipient and message.** Then use Meta's test number and allowed test recipient, verify acceptance and signed delivery status, and only afterwards consider enabling production. Production uses `ENABLE_LIVE_SEND=true` and a valid Meta business number/payment setup. This implementation has sent no real messages.

## Scheduling and delivery semantics

- The persistent Postgres queue uses `(schedule_id, scheduled_at)` uniqueness and atomic `FOR UPDATE SKIP LOCKED` claims, ten jobs per invocation. Increase throughput only after validating runtime/provider limits. Monitor cron responses and Edge Function logs; failures must not be silently ignored.
- The cron polls every minute: this is minute-level scheduling, not an exact-to-the-second guarantee.
- Recurrences use an IANA timezone. Daily, weekly and selected-day schedules preserve local wall-clock time across DST; intervals use elapsed minutes. Nonexistent initial local times are rejected. A recurrence landing in a spring-forward gap uses the timezone library's forward normalization, then returns to the configured clock the next day. Fall-back overlaps use the earlier instant. End dates are inclusive in the schedule timezone.
- Missed one-time jobs send when the server recovers. An overdue recurring schedule sends the oldest pending occurrence **once**, then advances past missed times to its next future occurrence. A failed occurrence blocks that schedule until corrected/retried, or cancelled and duplicated.
- Each message part is recorded independently; text plus a file is two WhatsApp sends. Accepted parts are skipped on retry. Only explicit rate-limit rejections auto-retry (exponential delay, five attempts). Definite rejections are manually retryable while active. Network timeouts, 5xx responses and stale in-flight jobs are held as **uncertain**. Check WhatsApp before creating a replacement; exactly-once external delivery cannot be guaranteed by the provider API.
- A worker interrupted after recording provider acceptance can be held conservatively for manual review even if the provider accepted everything. `sent` means provider-accepted, not device-delivered; individual parts show delivery/read/failed webhooks.
- Pausing/cancelling stops unclaimed work. A send already handed to WhatsApp cannot be recalled. Editing an attempted occurrence's content is blocked; cancel and duplicate instead. Editing/resuming an overdue paused schedule uses the missed-time rule.
- Only signed inbound webhooks open reply windows. User-entered consent does not open one. Consent is an explicit recipient permission attestation per schedule. Honor opt-out requests by cancelling that recipient's active schedules; this version does not automatically interpret conversational opt-outs.
- One attachment per schedule is supported: JPEG/PNG (max 5 MB), PDF, MP4, MP3 (max 16 MB). Uploads remain in a private bucket. Multiple-file batches, arbitrary file formats and template button parameters are not supported. Body variables and a matching media header are supported for approved templates. Failed/orphan uploads are not automatically deleted; define a retention policy and remove old files through Storage administration.

## WhatsApp requirements and costs (checked November 14, 2026)

WhatsApp Business Platform is a business messaging service; it is not an unrestricted personal-account automation API. Recipient opt-in is required. Business-initiated messages outside a 24-hour inbound-message window require approved templates. Template approval, language, variable count and media header must match Meta's definition. Provider rejections are surfaced in history.

An existing **WhatsApp Business app** number may be eligible for official coexistence onboarding. Eligibility and onboarding must be verified in Meta's flow. A regular personal WhatsApp number cannot simply be used by supplying its number to this app. No browser-session scraping or WhatsApp Web automation is used.

Meta charges delivered template messages according to destination market/category and volume; service messages are free under current pricing. Rates vary, so consult the current rate card rather than assuming a fixed monthly amount. Supabase functions, database, Storage, egress and email may incur plan/usage costs. GitHub Pages and Sites hosting depend on account limits. A BSP, if chosen instead of direct Cloud API, can add fees.

Sources:
- https://whatsappbusiness.com/policy/
- https://whatsappbusiness.com/products/platform-pricing/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/overview

## Validation and remaining checks

`npm test` exercises actual recurrence logic and the dispatch core with a mocked database/provider: one-time scheduling, weekly DST, weekdays/end dates, invalid zones, gaps, custom intervals, cancellation, the disabled switch, provider acceptance, accepted-part deduplication, rate-limit retry, rejection and uncertain transport failure. `npm run build` builds the production frontend.

Database migrations, real RLS enforcement, concurrent SQL claims, Supabase Auth/email, Storage, cron execution, Meta onboarding and signed production webhooks need staging verification after credentials are supplied. Unit mocks do not prove those services are configured. There is no live sending or working cloud persistence until these deployment steps are completed.

## Free PC connection

Use [FREE-PC.md](FREE-PC.md) and double-click Start-Free.cmd. No paid hosting is needed; your PC must remain awake and online for sending. The cloud site remains accessible from iPhone and PC.
