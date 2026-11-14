create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'aw_cron_secret');
create or replace function public.aw_authorize_worker(candidate text) returns boolean language sql security definer set search_path='' as $$
select exists(select 1 from vault.decrypted_secrets where name='aw_cron_secret' and decrypted_secret=candidate);
$$;
revoke all on function public.aw_authorize_worker(text) from public,anon,authenticated;
grant execute on function public.aw_authorize_worker(text) to service_role;
select cron.schedule('autowhatsapp-dispatch','* * * * *',$cron$
select net.http_post(url:='https://cdvnclwqpcgulrxwvbwa.supabase.co/functions/v1/dispatch',
headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='aw_cron_secret')),
body:='{}'::jsonb,timeout_milliseconds:=120000);
$cron$);
