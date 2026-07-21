begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'market_snapshots_price_positive_check'
      and conrelid = 'public.market_snapshots'::regclass
  ) then
    alter table public.market_snapshots
      add constraint market_snapshots_price_positive_check
      check (price > 0) not valid;
  end if;
end
$$;

alter table public.market_snapshots
  validate constraint market_snapshots_price_positive_check;

commit;
