# AutoWhatsApp — free PC mode

This mode uses your existing Windows PC instead of paid cloud compute. The website remains on GitHub Pages and schedules/files remain in the separate Supabase project. No paid Render resource is required or created. Existing electricity/internet and free-service quotas still apply; Supabase's existing organization quota warning remains relevant. No provider upgrade is authorized.

## First setup

1. Open https://saniritenman.github.io/autowhatsapp/ → Setup (הגדרות), sign in through the email link, and select **Create PC pairing code** (יצירת קוד צימוד למחשב).
2. Download the project ZIP from the Setup screen, extract it to your PC, and install Node.js 24 LTS or newer from https://nodejs.org if not already installed. The supplied workspace already has Node and dependencies.
3. Double-click **Start-Free.cmd**. Paste the private pairing code into its masked prompt. The code is encrypted with Windows DPAPI for this Windows user; no Supabase administrator key is needed.
4. Return to Setup. On your iPhone, open WhatsApp → Settings → Linked Devices → Link a Device and scan the QR on the PC screen. Pairing requires a second screen when using the same iPhone.
5. The worker continues in the background after its setup window closes. **Keep the PC powered on, awake and online.** Closing the website is fine. PC shutdown, sleep or loss of internet stops delivery until it reconnects; overdue messages use the existing missed-time policy.
6. Double-click **Stop-Free.cmd** to stop the worker. Run Start-Free.cmd again to resume using its saved linked session. No startup task, registry setting or sleep/power setting is changed automatically.

Live sending remains OFF. After the owner explicitly approves a specific test recipient and message, start with `powershell -NoProfile -File bridge/start-free.ps1 -EnableSending` to enable the local worker, then validate the approved test before relying on schedules. Never enable both local and hosted workers for the same account. The server lease rejects duplicates.

## Security and recovery

- The pairing token is a random 256-bit secret. The database stores only its SHA-256 hash, with one-year expiry. Creating another code replaces the old one; Revoke PC access invalidates it.
- Pairing requires an authenticated AutoWhatsApp user. Each request maps the token to a user on the server, then scopes the permitted personal-WhatsApp queue operations and files to that user. The gateway cannot call arbitrary SQL or send messages itself.
- The PC uses only the public publishable key plus its narrowly scoped pairing token, not a Supabase administrator/service-role key.
- Local encrypted token, WhatsApp session and logs live in `bridge/.local/` and must remain private and untracked. Do not copy the linked-device session to GitHub or share it.
- To pair again, use `powershell -NoProfile -File bridge/start-free.ps1 -ResetPairing` after stopping the worker. Disconnect WhatsApp logs the device out; revoking PC access separately revokes the app's computer token.
- Worker health is loopback-only at http://127.0.0.1:10000/health and contains no QR or credentials. Port 10000 must be available.
- Logs are `bridge/.local/worker.log` and `bridge/.local/worker-error.log`.
- If Windows blocks a local PowerShell script under your organization's policy, do not bypass that policy; ask its administrator for an approved launch method.

This uses an unofficial WhatsApp Web socket client and can disconnect or face account restrictions. No account has been paired or real messages sent during implementation. The physical iPhone QR scan and end-to-end send remain user steps.
