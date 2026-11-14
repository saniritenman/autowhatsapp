create table public.aw_contacts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null, phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'), consent boolean not null default false,
 unique(owner_id,phone)
);
create table public.aw_schedules (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'), contact_name text not null default '', consent boolean not null check(consent),
 body text not null default '' check(length(body)<=4096), mode text not null check(mode in ('text','template')),
 template_name text, language text not null default 'en_US', parameters jsonb not null default '[]',
 attachment_path text, attachment_name text, attachment_type text,
 local_time text not null, timezone text not null, repeat text not null check(repeat in ('once','daily','weekly','weekdays','interval')),
 weekdays int[] not null default '{}', interval_minutes int check(interval_minutes>=15), end_date date,
 next_at timestamptz not null, state text not null default 'active' check(state in ('active','paused','cancelled','completed')),
 created_at timestamptz not null default now(),
 check(mode <> 'template' or template_name ~ '^[a-z0-9_]+$'),
 check(repeat <> 'weekdays' or cardinality(weekdays)>0),
 check(repeat <> 'interval' or interval_minutes is not null),
 check(attachment_path is null or split_part(attachment_path,'/',1)=owner_id::text)
);
create table public.aw_jobs (
 id uuid primary key default gen_random_uuid(), schedule_id uuid not null references public.aw_schedules(id),
 owner_id uuid not null references auth.users(id), scheduled_at timestamptz not null, payload jsonb not null,
 status text not null default 'queued' check(status in ('queued','processing','sent','failed','uncertain','cancelled')),
 attempts int not null default 0, available_at timestamptz not null default now(), locked_at timestamptz, error text,
 created_at timestamptz not null default now(), unique(schedule_id,scheduled_at)
);
create table public.aw_parts (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.aw_jobs(id), ordinal int not null,
 status text not null default 'queued', provider_id text unique, delivery text, error text, unique(job_id,ordinal)
);
create index aw_due on public.aw_schedules(next_at) where state='active';
create index aw_queue on public.aw_jobs(available_at) where status='queued';
alter table public.aw_contacts enable row level security;
alter table public.aw_schedules enable row level security;
alter table public.aw_jobs enable row level security;
alter table public.aw_parts enable row level security;
create policy owner_contacts on public.aw_contacts for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy owner_schedules on public.aw_schedules for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy owner_jobs on public.aw_jobs for select to authenticated using(owner_id=auth.uid());
create policy owner_parts on public.aw_parts for select to authenticated using(exists(select 1 from public.aw_jobs j where j.id=job_id and j.owner_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('autowhatsapp','autowhatsapp',false,16777216,array['image/jpeg','image/png','application/pdf','video/mp4','audio/mpeg']) on conflict do nothing;
create policy aw_files on storage.objects for all to authenticated using(bucket_id='autowhatsapp' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='autowhatsapp' and (storage.foldername(name))[1]=auth.uid()::text);
-- Inbound events alone maintain the 24-hour window. Clients cannot manufacture it.
create table public.aw_windows(phone text primary key, last_inbound timestamptz not null);
alter table public.aw_windows enable row level security;
create table public.aw_events(id text primary key, received_at timestamptz not null default now());
alter table public.aw_events enable row level security;
create or replace function public.aw_claim() returns setof public.aw_jobs language plpgsql security definer set search_path=public as $$
begin
 update aw_jobs set status='uncertain',error='Worker interrupted; check WhatsApp before resending.' where status='processing' and locked_at<now()-interval '10 minutes';
 insert into aw_jobs(schedule_id,owner_id,scheduled_at,payload)
 select id,owner_id,next_at,to_jsonb(s) from aw_schedules s where state='active' and next_at<=now()
 on conflict(schedule_id,scheduled_at) do update set status='queued',payload=excluded.payload,available_at=now() where aw_jobs.status='cancelled' and aw_jobs.attempts=0;
 update aw_jobs j set status='cancelled' from aw_schedules s where j.schedule_id=s.id and j.status='queued' and (s.state<>'active' or s.next_at<>j.scheduled_at);
 return query update aw_jobs set status='processing',locked_at=now(),attempts=attempts+1 where id in
 (select id from aw_jobs where status='queued' and available_at<=now() order by scheduled_at for update skip locked limit 10) returning *;
end $$;
revoke all on function public.aw_claim() from public,anon,authenticated;
grant execute on function public.aw_claim() to service_role;
create or replace function public.aw_finish(jid uuid, following timestamptz) returns void language plpgsql security definer set search_path=public as $$
declare j aw_jobs;
begin
 select * into j from aw_jobs where id=jid for update;
 update aw_jobs set status='sent',error=null where id=jid;
 update aw_schedules set next_at=coalesce(following,next_at),state=case when following is null then 'completed' else 'active' end
 where id=j.schedule_id and state='active' and next_at=j.scheduled_at;
end $$;
revoke all on function public.aw_finish(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.aw_finish(uuid,timestamptz) to service_role;
create or replace function public.aw_retry(jid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from aw_jobs j join aw_schedules s on s.id=j.schedule_id where j.id=jid and j.owner_id=auth.uid() and j.status='failed' and s.state='active' and s.next_at=j.scheduled_at) then raise exception 'Only definitively failed, active occurrences can be retried'; end if;
 update aw_parts set status='queued',error=null where job_id=jid and status='failed';
 update aw_jobs set status='queued',available_at=now(),attempts=0,error=null where id=jid;
end $$;
revoke all on function public.aw_retry(uuid) from public,anon;
grant execute on function public.aw_retry(uuid) to authenticated;
-- Do not allow edits to overwrite a partly sent occurrence. Duplication remains available.
create or replace function public.aw_guard_edit() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.owner_id<>old.owner_id then raise exception 'Schedule ownership cannot change'; end if;
 if (to_jsonb(new)-'state'-'next_at') is distinct from (to_jsonb(old)-'state'-'next_at') then
  if exists(select 1 from aw_jobs where schedule_id=old.id and scheduled_at=old.next_at and attempts>0) then
   raise exception 'This occurrence has already been attempted. Cancel it and duplicate the schedule to change its content.';
  end if;
  update aw_jobs set status='cancelled' where schedule_id=old.id and status='queued';
 end if;
 return new;
end $$;
create trigger aw_schedule_edit before update on public.aw_schedules for each row execute function public.aw_guard_edit();
grant usage on schema public to authenticated, service_role;
grant select,insert,update,delete on public.aw_contacts,public.aw_schedules to authenticated;
grant select on public.aw_jobs,public.aw_parts to authenticated;
grant all on public.aw_contacts,public.aw_schedules,public.aw_jobs,public.aw_parts,public.aw_windows,public.aw_events to service_role;
create index aw_contacts_owner on public.aw_contacts(owner_id);
create index aw_schedules_owner on public.aw_schedules(owner_id);
create index aw_jobs_owner on public.aw_jobs(owner_id);
create index aw_parts_job on public.aw_parts(job_id);
revoke all on function public.aw_guard_edit() from public, anon, authenticated;
