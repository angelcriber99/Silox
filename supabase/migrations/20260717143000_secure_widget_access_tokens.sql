begin;

create table if not exists public.widget_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists idx_widget_access_tokens_one_active_per_user
  on public.widget_access_tokens(user_id)
  where revoked_at is null;

create index if not exists idx_widget_access_tokens_user_created
  on public.widget_access_tokens(user_id, created_at desc);

alter table public.widget_access_tokens enable row level security;

-- Widget credentials are managed only by authenticated server endpoints. The
-- service role bypasses RLS; browser and mobile clients receive no table access.
revoke all on table public.widget_access_tokens from anon, authenticated;

commit;
