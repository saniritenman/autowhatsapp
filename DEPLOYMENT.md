# AutoWhatsApp deployment

Website: https://saniritenman.github.io/autowhatsapp/
Repository: https://github.com/saniritenman/autowhatsapp
Backend: https://supabase.com/dashboard/project/cdvnclwqpcgulrxwvbwa

This is a separate GitHub repository, GitHub Pages website and Supabase project. BottleTrack remains unchanged.

## Verified November 14, 2026

- GitHub Actions build, eleven tests and Pages deployment all succeeded (run 43592916255).
- Live website renders, composer opens and the review step displays the selected recipient, message and scheduled time. Review test was discarded without saving or sending.
- Supabase Auth Site URL and the exact redirect allowlist point to the new website.
- Private tables, storage bucket, queue and both Edge Functions are deployed.
- Cron runs every minute with an authenticated Vault token; verified HTTP 200 response shows disabled=true.
- Transactional RLS tests passed for own-contact access, cross-user read denial and forged-owner write denial. Test data rolled back.
- Frontend configuration uses a public publishable key. Service-role, Meta and cron secrets are absent from client/source.

## Still required before sending

Connect a Meta WhatsApp Business number and configure the Meta token, app secret, verification token and API version in Supabase Edge Function secrets. Complete the webhook subscription and template approval. Keep live sending disabled until the owner approves a specific sandbox test recipient/message. No real WhatsApp messages have been sent.

Email sign-in is configured but has not been completed end-to-end by the owner. Cross-device user workflow and attachment upload should be checked after their first sign-in.

Supabase's dashboard reports that this organization exceeded its quota in the previous billing cycle and projects may be restricted from November 23, 2026 if the overage remains. Review usage: https://supabase.com/dashboard/org/wxdwpfpimankipaupdbk/usage . No paid upgrade was made.

Security advisors identify intentionally inaccessible internal event/window tables, and the narrow aw_retry definer RPC. That RPC checks caller ownership and definite failure status; other worker RPCs are service-role only.

The migration filenames match the deployed migration history. The cron migration targets this project's URL. A previously registered Sites shell remains unpublished; the active deployment is GitHub Pages.

## Hebrew, iPhone and desktop update

The interface now offers English/עברית with persisted language preference, RTL layout, localized form/status text, Hebrew dates and direction-aware message editing. Stored message bodies, phone numbers and template language codes are never translated. Safari users can add the website to their iPhone Home Screen. A web manifest and responsive touch controls are included; there is no offline-send or offline-cache promise. Desktop and mobile access use the same Supabase account.

The new personal WhatsApp QR service is documented in bridge/README.md. It is prepared but NOT connected or deployed. The required Supabase connection-table migration remains unapplied because the tool's approval expired. Render authorization, hosting-cost approval, server secrets, dependency review and real QR pairing remain outstanding. Official Cloud API sending remains disabled too.

Live UI verification: Hebrew switching and RTL were checked on desktop and at a 390px iPhone-sized viewport. The weekly Hebrew composer review preserved message text, international phone number, Hebrew-formatted date and weekly recurrence. The draft was discarded without saving or sending. The dialog fit within the viewport. This was browser simulation, not a physical iPhone/Safari test. The published setup screen accurately reports that the personal bridge is not deployed.


Render preparation update: The workspace was confirmed as My Workspace. The service now uses Baileys 6.7.24 over WebSockets and no Chromium, with zero npm audit findings at installation. All sixteen app tests and five socket adapter tests pass. The pending Supabase migration succeeded; the connection records and separate transport queues are installed. Render resources have not been created or billed. The proposed smallest always-on service is 0.5c-512mb ($7/month) plus a 1 GB persistent disk ($0.25/month), excluding tax and usage charges. Live sending remains disabled.

## Render planning result

Blueprint draft ID: exs-dbs6osm7bikc73eonisg. Workspace: My Workspace (tea-dbs4vae7bikc73ek3f5g). Source is pushed to main; autoSync is disabled. Planning failed with need_payment_info on the new service, so there is no approved plan, deployed service or hosting charge from this action. Add payment details through the Render dashboard, then re-plan this existing Blueprint instead of creating a duplicate. Review the result and obtain approval to apply the plan and recurring estimated $7.25/month cost before provisioning. Do not approve a failed plan.

The Supabase migration is recorded locally and remotely as 20261114140419_personal_whatsapp_bridge. Transactional live-database tests passed for QR isolation, owner connect requests, exclusive account leases and Cloud/Web queue routing; all synthetic users and test records were rolled back. No app Auth user exists yet, so the owner must first sign in to AutoWhatsApp before AW_OWNER_ID can be configured. Configure SUPABASE_SECRET_KEY securely on Render, not in source or chat. Live sending stays false.

Free-mode update: paid Render hosting has been replaced by an optional local Windows worker. See FREE-PC.md. The free_pc_pairing migration and local-gateway function are deployed. Pairing-code rotation/revocation database checks pass, along with custom-token and ownership boundary tests. Start-Free.cmd stores its private computer token encrypted under the current Windows user, needs no Supabase administrator key, and defaults to sending disabled. No user has signed in or paired WhatsApp yet. No paid Render service was created.
