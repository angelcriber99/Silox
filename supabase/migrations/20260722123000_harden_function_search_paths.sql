begin;

-- Prevent object shadowing when this trigger runs with a caller-controlled
-- search_path. The function currently only touches NEW, but pinning the path
-- keeps future edits safe and clears Supabase's security advisor warning.
do $$
begin
  if to_regprocedure('public.update_budget_updated_at()') is not null then
    alter function public.update_budget_updated_at()
      set search_path = public, pg_temp;
  end if;
end
$$;

commit;
