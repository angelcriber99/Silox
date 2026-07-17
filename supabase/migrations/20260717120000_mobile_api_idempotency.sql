begin;

create table if not exists public.mobile_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_method text not null,
  request_path text not null,
  request_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key, request_method, request_path)
);

alter table public.mobile_api_idempotency enable row level security;

drop policy if exists "mobile_idempotency_select_own" on public.mobile_api_idempotency;
create policy "mobile_idempotency_select_own"
on public.mobile_api_idempotency for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "mobile_idempotency_insert_own" on public.mobile_api_idempotency;
create policy "mobile_idempotency_insert_own"
on public.mobile_api_idempotency for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "mobile_idempotency_update_own" on public.mobile_api_idempotency;
create policy "mobile_idempotency_update_own"
on public.mobile_api_idempotency for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "mobile_idempotency_delete_own" on public.mobile_api_idempotency;
create policy "mobile_idempotency_delete_own"
on public.mobile_api_idempotency for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists idx_mobile_api_idempotency_created
  on public.mobile_api_idempotency(created_at);

commit;
