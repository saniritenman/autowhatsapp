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
