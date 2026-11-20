create table public.aw_reminders (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users(id),
 contact_name text not null default '',phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),body text not null default '',
 attachments jsonb not null default '[]',local_time text not null,timezone text not null,repeat text not null default 'once' check(repeat in ('once','daily','weekly','weekdays')),
 weekdays int[] not null default '{}',end_date date,reminder_minutes integer not null default 0 check(reminder_minutes between 0 and 40320),
 state text not null default 'pending' check(state in ('pending','done','cancelled')),
 calendar_event_id text,calendar_url text,calendar_status text not null default 'pending' check(calendar_status in ('pending','synced','error','cancelled')),calendar_error text,
 last_done_at timestamptz,created_at timestamptz not null default now()
);
alter table public.aw_reminders enable row level security;
create policy own_reminders on public.aw_reminders for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select,insert,update,delete on public.aw_reminders to authenticated;
grant all on public.aw_reminders to service_role;
create index aw_reminders_owner on public.aw_reminders(owner_id);
-- Retire the earlier automatic sender. Keep historical records intact.
update public.aw_schedules set state='paused' where state='active';
create or replace function public.aw_claim() returns setof public.aw_jobs language sql security definer set search_path=public as $$ select * from public.aw_jobs where false; $$;
create or replace function public.aw_claim_web(account uuid) returns setof public.aw_jobs language sql security definer set search_path=public as $$ select * from public.aw_jobs where false; $$;
create or replace function public.aw_computer_owner(candidate text) returns uuid language sql security definer set search_path='' as $$ select null::uuid; $$;
select cron.unschedule(jobid) from cron.job where jobname='autowhatsapp-dispatch';
