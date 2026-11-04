
alter function public.claim_ai_request() set schema private;
grant usage on schema private to authenticated;
revoke all on private.ai_usage from public,anon,authenticated;
create policy "Quota rows only through guarded function" on private.ai_usage for all to authenticated using (false) with check (false);
create function public.claim_ai_request() returns boolean language sql security invoker set search_path = '' as $$ select private.claim_ai_request(); $$;
revoke all on function public.claim_ai_request() from public,anon;
grant execute on function public.claim_ai_request() to authenticated;
