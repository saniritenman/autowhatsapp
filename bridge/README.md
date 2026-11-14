# Personal WhatsApp QR service

The owner's requested connection is a personal WhatsApp linked by QR, using Baileys. This is an unofficial client, not the official Meta Business API. It can disconnect or face WhatsApp account restrictions. https://github.com/WhiskeySockets/Baileys explains this limitation.

## Current state

The website and service code are prepared. The always-on bridge has NOT been deployed and no WhatsApp account has been linked. No real messages have been sent. Live sending defaults to false.

The Supabase connection-table and Web queue migration has now been approved and applied. The earlier approval prompts expired; that blocker is resolved. Render hosting still requires approval of the reviewed deployment plan and recurring cost.

The bridge now uses a pinned Baileys WebSocket adapter instead of Chromium. The replacement dependency tree installed with zero npm audit findings. Adapter tests verify Hebrew text, file bytes and names, recipient resolution, unknown results and session path confinement. No browser sandbox is disabled, and no browser needs to be installed. Real QR pairing, restart restoration and delivery acknowledgements remain pending hosting approval.

## Host requirements

Deploy a single always-on Linux service using `bridge/Dockerfile`, built from the repository root. A Docker-compatible VPS or Render with a persistent disk is needed. GitHub Pages hosts the website; Supabase Edge Functions cannot maintain this browser session. Do not deploy on a sleeping free service or ephemeral filesystem.

`render.yaml` is a proposed configuration, not a created/billed service. Confirm current plan and disk costs before provisioning. Attach a persistent writable disk at `/data`, accessible to the non-root node user. The socket service does not need Chromium. It stores only its linked-device authentication state on the persistent disk.

Environment values (configure in host secrets, never in the website or repository):

- `SUPABASE_URL`: this independent AutoWhatsApp project's API URL.
- `SUPABASE_SECRET_KEY`: a server-only Supabase secret key for this project.
- `AW_OWNER_ID`: the owner's Supabase **app Auth user ID**, shown in Authentication → Users after first signing in to AutoWhatsApp. It is not the Supabase dashboard user's ID.
- `SESSION_PATH=/data/whatsapp`.
- `ENABLE_LIVE_SEND=false` until the owner approves a specific test recipient and message.
- `PORT=10000`.

The session directory grants access as a WhatsApp linked device. Protect the disk, its backups and the server secret. Do not place session files in Supabase's public bucket, GitHub, logs or browser code.

## Pairing

1. Apply the pending database migration after approval; deploy the host and confirm its `/health` check succeeds.
2. Sign in to AutoWhatsApp → Setup. The QR is stored in an RLS-protected per-user connection row. It expires after 45 seconds; refreshing requests a new code. No QR is exposed by the public health endpoint.
3. On iPhone, open WhatsApp → Settings → Linked Devices → Link a Device and scan the QR displayed on a PC/second screen. On one iPhone, an additional screen is needed to show the QR. The website is usable on either device afterwards.
4. Confirm Connected and Sending disabled in the website. Restart the service to verify the persistent session reconnects.
5. Only after approval of a specific test number and message, enable sending and verify acceptance/delivery. A signed-in owner can request disconnect; it logs the linked device out and clears the QR/status.

## Reliability and isolation

One owner per deployed bridge, one instance. The database lease rejects a second instance and renews every 20 seconds; losing it shuts the browser down. The bridge only claims that owner's `web` schedules. The existing Cloud API worker only claims `cloud` schedules. Business templates cannot be sent over this personal QR connection.

Text, Hebrew Unicode and one supported file are sent through the linked account. Each accepted part is persisted before continuing. Timeouts and lost outcomes remain uncertain for manual review. A transport timeout can mean a message already arrived: do not resend blindly.

There is no inbound message/chat-history collection. Outgoing delivery acknowledgements update only matching schedule parts. If WhatsApp disconnects or a heartbeat becomes stale, the website shows the connection offline. Scheduled messages remain persisted in Supabase until the bridge can claim them.
