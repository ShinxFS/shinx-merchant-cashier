-- Enable realtime notifications for new table orders on an existing Supabase project.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'table_orders'
    ) then
    alter publication supabase_realtime add table public.table_orders;
  end if;
end
$$;
