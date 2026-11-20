# One-time Google Calendar setup

Automatic Calendar creation is implemented but needs the website's Google OAuth client configuration. A ChatGPT Calendar connector cannot authorize a separate public website. No Google client secret or refresh token is needed for this browser-only design.

1. Open https://console.cloud.google.com/ and create/select a separate AutoWhatsApp project. Do not enable billing or provision paid resources for this setup.
2. In APIs & Services → Library, enable **Google Calendar API**.
3. In Google Auth Platform, configure branding: AutoWhatsApp, your support email and developer email. Set the audience to External unless you use an eligible Workspace internal app.
4. While in Testing, add your Google account as a test user. Do not assume other users can authorize before adding them or completing Google's publishing/verification requirements. Calendar scopes can require verification for public distribution; check the console's current requirements.
5. Add the scope `https://www.googleapis.com/auth/calendar.events.owned`. This permits creating/editing/deleting events on calendars you own. The app uses your primary Calendar.
6. Create an OAuth client, application type **Web application**. Authorized JavaScript origin: `https://saniritenman.github.io` (origin only, no `/autowhatsapp/` path). For local development optionally add `http://localhost` and `http://localhost:5173`. This app uses the popup token model; it does not need a redirect URI or a client secret in its frontend.
7. Copy only the generated public client ID ending `.apps.googleusercontent.com` into `googleClientId` in `src/config.json`; commit and allow Pages to deploy. Never copy the client secret into the repository.
8. Sign in to the app, open Connections, and press Connect Google Calendar. The account owner must complete Google's consent screen themselves. Choose the Google account whose calendar should receive reminders.
9. After authorization, create a non-sensitive reminder for yourself several minutes ahead. Confirm it appears in your primary calendar and its description links back to the correct private draft. Enable Calendar notifications on iPhone/PC and test delivery there. No test event has been created on your behalf.

## What authorization means

The browser holds an expiring access token only in memory. Reloading or waiting for expiry requires reconnecting when saving/editing/cancelling a Calendar event. Previously created reminders keep working in Google Calendar independently of the website. The app does not read your whole calendar or email, and creates no attendee invitations or email reminders.

## Troubleshooting

- `origin_mismatch`: use the exact hostname origin in step 6; paths do not belong in JavaScript origins. Allow time for Google settings to propagate.
- `access_denied` / testing restriction: add the selected account as a test user; grant the requested Calendar scope.
- API disabled / 403: enable Calendar API in the same project as the OAuth client. Check quota or consent configuration.
- Popup closed/blocked: press Connect directly and permit the Google authorization popup in your browser.
- Expired session / 401: reconnect and press Add to Calendar again. It reuses the same event ID.
- Draft saved but no notification: the app shows Calendar status separately. Only **Calendar reminder added** means Google confirmed the API operation. Retry a failed sync; edit a one-time reminder whose time has already passed.
- Photo sharing unavailable: download the private attachment, open WhatsApp, attach it and paste the copied text. File sharing differs between Safari, Chrome, Edge, and installed WhatsApp versions.

Google documents standard Calendar API use as free within its usage thresholds (currently 1,000,000 requests/day/project, with per-minute limits). Its documentation also announces future overage billing, so do not enable billing or request paid quota increases for this personal app. Check current terms: https://developers.google.com/workspace/calendar/api/guides/quota . Check current Google terms before enabling any other Cloud product. Supabase and GitHub hosting remain subject to their free-tier limits.
