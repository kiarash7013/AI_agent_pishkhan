
create table public.demo_transactions (
 id uuid primary key default gen_random_uuid(),
 account_id text not null check (account_id = 'demo-4582'),
 posted_at date not null check (posted_at >= '2026-09-23'),
 description text not null,
 amount bigint not null
);
alter table public.demo_transactions enable row level security;
grant select on public.demo_transactions to anon, authenticated;
revoke insert, update, delete on public.demo_transactions from anon, authenticated;
create policy "Read synthetic demonstration transactions" on public.demo_transactions for select to anon, authenticated using (account_id = 'demo-4582');
create index demo_transactions_account_date_idx on public.demo_transactions(account_id,posted_at);
insert into public.demo_transactions(account_id,posted_at,description,amount) values
 ('demo-4582','2026-09-30','واریز وجه',80000000),
 ('demo-4582','2026-10-07','انتقال وجه',-20000000),
 ('demo-4582','2026-10-17','برداشت',-15000000);
create table public.conversations (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null check (char_length(title) between 1 and 100),
 payload jsonb not null check (octet_length(payload::text) <= 100000),
 updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
grant select, insert, update, delete on public.conversations to authenticated;
revoke all on public.conversations from anon;
create policy "Read own conversations" on public.conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own conversations" on public.conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own conversations" on public.conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own conversations" on public.conversations for delete to authenticated using ((select auth.uid()) = user_id);
create index conversations_user_updated_idx on public.conversations(user_id,updated_at desc);
create schema if not exists private;
create table private.ai_usage (user_id uuid primary key references auth.users(id) on delete cascade, bucket timestamptz not null, requests integer not null);
alter table private.ai_usage enable row level security;
revoke all on schema private from public, anon, authenticated;
create function public.claim_ai_request() returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); count_now integer;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 insert into private.ai_usage(user_id,bucket,requests) values (actor,date_trunc('minute',now()),1)
 on conflict (user_id) do update set bucket=date_trunc('minute',now()),requests=case when private.ai_usage.bucket=date_trunc('minute',now()) then private.ai_usage.requests+1 else 1 end
 returning requests into count_now;
 return count_now <= 10;
end;
$$;
revoke all on function public.claim_ai_request() from public, anon;
grant execute on function public.claim_ai_request() to authenticated;
