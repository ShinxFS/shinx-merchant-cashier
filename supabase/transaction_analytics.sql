create or replace function public.get_top_selling_products()
returns table(name text, qty bigint, revenue numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    item.product_name as name,
    sum(item.quantity)::bigint as qty,
    sum(item.subtotal) as revenue
  from public.transaction_items as item
  join public.transactions as transaction_record
    on transaction_record.id = item.transaction_id
  where transaction_record.user_id = auth.uid()
  group by item.product_name
  order by sum(item.quantity) desc, item.product_name asc
  limit 10;
$$;

revoke all on function public.get_top_selling_products() from public, anon;
grant execute on function public.get_top_selling_products() to authenticated;

create or replace function public.get_staff_transaction_stats()
returns table(
  staff_id uuid,
  total_transactions bigint,
  total_revenue numeric,
  total_profit numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    transaction_record.created_by as staff_id,
    count(*) as total_transactions,
    sum(transaction_record.total) as total_revenue,
    sum(transaction_record.total) - sum(coalesce(item_totals.total_cost, 0)) as total_profit
  from public.transactions as transaction_record
  left join lateral (
    select sum(coalesce(item.cost_price, 0) * item.quantity) as total_cost
    from public.transaction_items as item
    where item.transaction_id = transaction_record.id
  ) as item_totals on true
  where transaction_record.user_id = auth.uid()
    and transaction_record.created_by is not null
  group by transaction_record.created_by;
$$;

revoke all on function public.get_staff_transaction_stats() from public, anon;
grant execute on function public.get_staff_transaction_stats() to authenticated;

notify pgrst, 'reload schema';
