begin;

-- Historical setup scripts created overlapping policies for the same user-owned
-- tables. Rebuild them as one policy per operation, scoped to authenticated
-- clients, and evaluate auth.uid() once per statement instead of once per row.
do $do$
declare
  target_table text;
  policy record;
begin
  foreach target_table in array array[
    'activos',
    'alertas',
    'budget_settings',
    'eventos_recurrentes',
    'expenses',
    'portfolio_history',
    'portfolio_snapshots',
    'transacciones',
    'user_notes'
  ] loop
    for policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', policy.policyname, target_table);
    end loop;
  end loop;
end
$do$;

create policy activos_select_own on public.activos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy activos_insert_own on public.activos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy activos_update_own on public.activos for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy activos_delete_own on public.activos for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy alertas_select_own on public.alertas for select to authenticated
  using ((select auth.uid()) = user_id);
create policy alertas_insert_own on public.alertas for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy alertas_update_own on public.alertas for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy alertas_delete_own on public.alertas for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_settings_select_own on public.budget_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy budget_settings_insert_own on public.budget_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy budget_settings_update_own on public.budget_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy eventos_recurrentes_select_own on public.eventos_recurrentes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy eventos_recurrentes_insert_own on public.eventos_recurrentes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy eventos_recurrentes_update_own on public.eventos_recurrentes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy eventos_recurrentes_delete_own on public.eventos_recurrentes for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy expenses_select_own on public.expenses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy expenses_insert_own on public.expenses for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy expenses_update_own on public.expenses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expenses_delete_own on public.expenses for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy portfolio_history_select_own on public.portfolio_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy portfolio_history_insert_own on public.portfolio_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy portfolio_snapshots_select_own on public.portfolio_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);
create policy portfolio_snapshots_insert_own on public.portfolio_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy portfolio_snapshots_update_own on public.portfolio_snapshots for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy portfolio_snapshots_delete_own on public.portfolio_snapshots for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy transacciones_select_own on public.transacciones for select to authenticated
  using ((select auth.uid()) = user_id);
create policy transacciones_insert_own on public.transacciones for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy transacciones_update_own on public.transacciones for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transacciones_delete_own on public.transacciones for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy user_notes_select_own on public.user_notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_notes_insert_own on public.user_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_notes_update_own on public.user_notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_notes_delete_own on public.user_notes for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
