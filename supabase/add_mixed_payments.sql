-- Store each payment method and amount used in a split payment.
alter table public.transactions
  add column if not exists payment_details jsonb not null default '[]'::jsonb;

alter table public.transactions
  drop constraint if exists transactions_payment_method_check;

alter table public.transactions
  add constraint transactions_payment_method_check
  check (payment_method in ('cash', 'transfer', 'qris', 'mixed'));
