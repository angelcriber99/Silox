-- Portfolio changes originate in these base tables. The posiciones relation is
-- a view, so subscribing to it never produces Postgres Changes events.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['activos', 'transacciones', 'eventos_recurrentes']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
