begin;

-- A mutual/index fund publishes a dated NAV and has no pre/regular/post
-- sessions. Intraday snapshots manufactured a false "previous close" for
-- these instruments, so remove them and keep this table for traded quotes.
delete from public.market_snapshots as snapshot
where exists (
  select 1
  from public.activos as asset
  where asset.ticker = snapshot.ticker
    and asset.tipo in ('Fondo Indexado', 'Fondo Monetario')
);

commit;
