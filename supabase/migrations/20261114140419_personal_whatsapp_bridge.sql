alter table public.aw_schedules add column transport text not null default 'cloud' check(transport in ('cloud','web'));
update public.aw_jobs set payload=payload || '{"transport":"cloud"}'::jsonb;
create table public.aw_connections (
 owner_id uuid primary key references auth.users(id), status text not null default 'starting',
 qr_data text, qr_expires_at timestamptz, phone text, heartbeat_at timestamptz,
 sending_enabled boolean not null default false, command text, command_id uuid,
 instance_id uuid, lease_until timestamptz
);
alter table public.aw_connections enable row level security;
create policy own_connection on public.aw_connections for select to authenticated using(owner_id=(select auth.uid()));
grant select on public.aw_connections to authenticated;
grant all on public.aw_connections to service_role;
create or replace function public.aw_request_web(action text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or action not in ('connect','disconnect') then raise exception 'Unauthorized connection request'; end if;
 insert into aw_connections(owner_id,command,command_id) values(auth.uid(),action,gen_random_uuid())
 on conflict(owner_id) do update set command=excluded.command,command_id=excluded.command_id;
end $$;
revoke all on function public.aw_request_web(text) from public,anon;
grant execute on function public.aw_request_web(text) to authenticated;
create or replace function public.aw_web_lease(account uuid, instance uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 insert into aw_connections(owner_id,instance_id,lease_until) values(account,instance,now()+interval '60 seconds')
 on conflict(owner_id) do update set instance_id=excluded.instance_id,lease_until=excluded.lease_until
 where aw_connections.lease_until is null or aw_connections.lease_until<now() or aw_connections.instance_id=instance;
 return found;
end $$;
revoke all on function public.aw_web_lease(uuid,uuid) from public,anon,authenticated;
grant execute on function public.aw_web_lease(uuid,uuid) to service_role;
create or replace function public.aw_claim_for(channel text, account uuid default null) returns setof public.aw_jobs language plpgsql security definer set search_path=public as $$
begin
 update aw_jobs set status='uncertain',error='Worker interrupted; check WhatsApp before resending.' where (payload->>'transport')=channel and (account is null or owner_id=account) and status='processing' and locked_at<now()-interval '10 minutes';
 insert into aw_jobs(schedule_id,owner_id,scheduled_at,payload)
 select id,owner_id,next_at,to_jsonb(s) from aw_schedules s where state='active' and next_at<=now() and transport=channel and (account is null or owner_id=account)
 on conflict(schedule_id,scheduled_at) do update set status='queued',payload=excluded.payload,available_at=now() where aw_jobs.status='cancelled' and aw_jobs.attempts=0;
 update aw_jobs j set status='cancelled' from aw_schedules s where j.schedule_id=s.id and j.status='queued' and (s.state<>'active' or s.next_at<>j.scheduled_at);
 return query update aw_jobs set status='processing',locked_at=now(),attempts=attempts+1 where id in
 (select id from aw_jobs where (payload->>'transport')=channel and (account is null or owner_id=account) and status='queued' and available_at<=now() order by scheduled_at for update skip locked limit 10) returning *;
end $$;
revoke all on function public.aw_claim_for(text,uuid) from public,anon,authenticated;
grant execute on function public.aw_claim_for(text,uuid) to service_role;

create or replace function public.aw_claim() returns setof public.aw_jobs language sql security definer set search_path=public as $$ select * from aw_claim_for('cloud',null); $$;
revoke all on function public.aw_claim() from public,anon,authenticated;
grant execute on function public.aw_claim() to service_role;
create or replace function public.aw_claim_web(account uuid) returns setof public.aw_jobs language sql security definer set search_path=public as $$ select * from aw_claim_for('web',account); $$;
revoke all on function public.aw_claim_web(uuid) from public,anon,authenticated;
grant execute on function public.aw_claim_web(uuid) to service_role;
