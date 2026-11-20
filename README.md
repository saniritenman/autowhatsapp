# AutoWhatsApp — Remember. Open. Send.

A private, mobile-friendly message preparation app in English and Hebrew. Hosted at https://saniritenman.github.io/autowhatsapp/ using GitHub Pages and the independent AutoWhatsApp Supabase project. BottleTrack is separate.

## Current behavior

1. Sign in with a secure email link. Email is used for authentication, not message reminders.
2. Prepare a contact number, text, and up to five JPEG/PNG/PDF/MP4/MP3 files (16 MB each).
3. Select the reminder time, timezone, optional recurrence (daily, weekly, selected weekdays), end date, and popup notification timing.
4. Review and save to Google Calendar. Google authorization is requested when needed. A draft remains safely saved if Calendar fails, with an explicit retry action. Draft-only saving never claims to create a Calendar reminder.
5. Google Calendar sends the notification even when the website and PC are closed. The event links back to the private draft.
6. Open WhatsApp with the prepared text and recipient; press Send yourself. Photos use the device's share sheet (choose WhatsApp and a recipient) or download/manual attachment. Standard WhatsApp links cannot attach files to a preselected chat. Some share targets omit text; Copy text is available.
7. Mark the reminder as sent manually. This is your acknowledgement, not a delivery receipt. Editing updates the Calendar event; cancelling deletes it. Recurring completion records your acknowledgement while retaining the recurrence.

No WhatsApp automation, personal session/QR bridge, business API, background worker, or paid Render service is required. The legacy automatic sender is retired in the database. Its source is preserved at branch `archive/automatic-sender-2026-11-20`.

## Setup status

- Implemented: application, private Supabase reminders/files, email login, manual WhatsApp link, native file sharing with fallback, recurrence payloads, Calendar API retry/update/cancel, Hebrew RTL, responsive layout.
- **External setup required:** Google OAuth web client ID and Calendar API activation. Without this, draft saving and manual WhatsApp preparation work, but automatic Calendar event creation is disabled. See [GOOGLE-CALENDAR-SETUP.md](GOOGLE-CALENDAR-SETUP.md).
- Calendar API tested with mocks only; no real event or WhatsApp message was sent. iPhone sharing and notification delivery require validation on an actual device/account.

## Development and deployment

Node 24 recommended. Run `npm ci`, `npm test`, `npm run build`. `npm run dev` starts a local site. Build is in `dist`, deployed by `.github/workflows/pages.yml` on a main-branch push. Pages source must be GitHub Actions.

`src/config.json` holds the Supabase URL, publishable public key, and Google **public client ID**. Never add service-role keys, Google client secrets, personal WhatsApp sessions, or OAuth tokens to source. For local OAuth configuration, use `.env.local` with `VITE_GOOGLE_CLIENT_ID`; it is ignored. The GitHub Pages production build reads `src/config.json` unless a build environment variable is provided.

`manual-reminders.sql` is the migration already applied to the existing project (20261120081002). Do not reapply it. Earlier migrations/source remain in the archive branch; a brand-new Supabase instance needs the original private storage bucket and authentication configuration before this incremental migration. Existing legacy records are retained; they are not silently imported as Calendar reminders.

Supabase auth Site URL and allowed redirect must include the deployed app URL. Storage bucket `autowhatsapp` is private, restricted to the current user's folder. `aw_reminders` uses authenticated owner RLS. Google access tokens are memory-only and expire; reconnecting can be necessary. No token is placed in a Calendar description, URL, database, or browser persistent storage.

## Reliability and limits

Calendar event IDs derive from reminder UUIDs. A retry after an ambiguous network response looks up that ID and verifies app ownership before updating, preventing duplicate events. Deleting an already deleted event is safe. The Calendar API and Supabase are separate systems: failed sync is clearly shown and must be retried. If an event was accepted but its metadata could not be saved, retry recovers its deterministic ID. Cancel also attempts cleanup for that error state. There is no background Calendar synchronization: changes made directly in Calendar are not automatically reflected in the app.

Google owns recurrence and notification timing after event creation. IANA timezones preserve wall-clock times through daylight savings; nonexistent local times are rejected. Missed reminders remain available; the app never sends catch-up messages. Device notification settings, internet availability, and Google Calendar determine notification delivery. A calendar shared by its owner can reveal event title/recipient name; message body and attachment links are not added to events.

The app stores contacts as recipient details on each reminder; it does not upload your address book. Supabase free-tier storage/auth quotas and inactivity rules still apply; free services are not a contractual uptime guarantee. No paid service has been created for this update. There are no WhatsApp API message charges because sending is manual.

## Validation

`npm test`: ten tests covering one-time/weekly/weekday events, Jerusalem daylight savings, invalid dates, Hebrew encoding, popup-only reminders, retry duplicate prevention, cancellation, recurrence removal, and authorization/transient failures.

`npm run build`: production bundle. Database isolation is checked in a rolled-back transaction with synthetic users. No real recipients, messages, or Calendar events are used.

## References

- [Google Identity Services setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
- [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Calendar events insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934)
- [Web Share support and requirements](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
