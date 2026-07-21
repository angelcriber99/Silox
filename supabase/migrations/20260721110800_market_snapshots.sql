begin;

create table if not exists public.market_snapshots (
  ticker text primary key,
  market_date text not null,
  price numeric not null check (price > 0),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Snapshots are internal server state. Market clients read the calculated
-- portfolio response and must not be able to forge the daily price baseline.
alter table public.market_snapshots enable row level security;
revoke all on table public.market_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.market_snapshots to service_role;

commit;
