-- Rekening pembayaran transfer milik setiap toko.
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists payment_accounts_user_id_idx on public.payment_accounts (user_id);

alter table public.payment_accounts enable row level security;

drop policy if exists "payment_accounts_own" on public.payment_accounts;
create policy "payment_accounts_own" on public.payment_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Staff dapat melihat rekening milik owner-nya saat menerima pembayaran transfer.
drop policy if exists "payment_accounts_staff_read" on public.payment_accounts;
create policy "payment_accounts_staff_read" on public.payment_accounts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'staff'
        and p.owner_id = payment_accounts.user_id
    )
  );

-- Snapshot rekening pada transaksi agar histori tetap benar walau rekening master dihapus.
alter table public.transactions
  add column if not exists payment_account text;
