# Deployment status — November 14, 2026

AutoWhatsApp is independent of BottleTrack. No BottleTrack resources were modified.

## Completed

- Supabase organization: saniritenman's Org (`wxdwpfpimankipaupdbk`), explicitly confirmed by owner.
- New project: AutoWhatsApp (`cdvnclwqpcgulrxwvbwa`), Frankfurt (`eu-central-1`).
- Dashboard: https://supabase.com/dashboard/project/cdvnclwqpcgulrxwvbwa
- Separate tables, private Storage bucket, RLS policies and queue functions deployed.
- `dispatch` and `webhook` deployed as active Edge Functions.
- Server cron `autowhatsapp-dispatch` active every minute, authenticated with a secret generated and retained in Vault. Worker validates that secret through a service-role-only RPC. No secret is stored in source.
- Observed cron HTTP 200 response `{"disabled":true}`. Live sending is off; no Meta credentials configured and no real messages sent.
- Transactional database test verified cross-user contact reads and forged ownership writes are blocked, and the owner can read their own contact. Test data rolled back.
- Security advisors: internal event/window tables intentionally have RLS with no user policies. The authenticated `aw_retry` definer warning is expected: this narrow RPC explicitly checks caller ownership, active schedule and definite failed status before changing jobs. Other worker RPCs are service-role-only.
- Public frontend settings stored in ignored `.env.local`; build passes. Eleven mocked/unit tests pass.

## Awaiting GitHub browser sign-in

GitHub connector authenticated as saniritenman, with access to bottletrack. It has no repository creation operation. The GitHub creation page is open in the browser at https://github.com/new and is showing sign-in. No AutoWhatsApp repository exists yet.

After sign-in: create separate autowhatsapp repo, publish only this workspace, configure GitHub Pages, set public Supabase build variables, then set Supabase Auth site/redirect URLs to the new Pages URL. The previous unused Sites registration is unpublished and is not the GitHub deployment.

## Remaining provider setup

Meta business onboarding, phone-number eligibility/coexistence, access token, app secret, verify token, template approval, payment configuration and webhook subscription. Keep ENABLE_LIVE_SEND false until an explicitly approved sandbox recipient/message test. No secrets should be pasted into chat or committed.

The source migration history now matches the deployed Supabase versions. The cron migration targets this separate project's URL; adapt it before creating any other environment.
