create table public.aw_computer_tokens (
 owner_id uuid primary key references auth.users(id), token_hash text not null unique,
 expires_at timestamptz not null default now()+interval '1 year'
);
alter table public.aw_computer_tokens enable row level security;
revoke all on public.aw_computer_tokens from anon,authenticated;
grant all on public.aw_computer_tokens to service_role;
create or replace function public.aw_pair_computer() returns text language plpgsql security definer set search_path='' as $$
declare raw text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 raw:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.aw_computer_tokens(owner_id,token_hash) values(auth.uid(),encode(extensions.digest(raw,'sha256'),'hex'))
 on conflict(owner_id) do update set token_hash=excluded.token_hash,expires_at=now()+interval '1 year';
 return raw;
end $$;
revoke all on function public.aw_pair_computer() from public,anon;
grant execute on function public.aw_pair_computer() to authenticated;
create or replace function public.aw_computer_owner(candidate text) returns uuid language sql security definer set search_path='' as $$
 select owner_id from public.aw_computer_tokens where token_hash=encode(extensions.digest(candidate,'sha256'),'hex') and expires_at>now();
$$;
revoke all on function public.aw_computer_owner(text) from public,anon,authenticated;
grant execute on function public.aw_computer_owner(text) to service_role;
create or replace function public.aw_revoke_computer() returns void language sql security definer set search_path='' as $$
 delete from public.aw_computer_tokens where owner_id=auth.uid();
$$;
revoke all on function public.aw_revoke_computer() from public,anon;
grant execute on function public.aw_revoke_computer() to authenticated;
