-- Tambah nomor meja ke transaksi (untuk fitur kasir multi-meja).
-- Jalankan di Supabase: Dashboard > SQL Editor > New query > tempel > Run.
-- Nilai NULL berarti transaksi "Bawa Pulang" (takeaway) / tanpa meja.

alter table transactions
  add column if not exists table_number integer;

alter table transactions
  add column if not exists notes text;

-- Restore table numbers for older table-order transactions when their notes
-- contain the table label.
update transactions
set table_number = (regexp_match(
  notes,
  '(Pesanan meja|Order via QR Meja)[[:space:]]+([0-9]+)',
  'i'
))[3]::integer
where table_number is null
  and notes ~* '(Pesanan meja|Order via QR Meja)[[:space:]]+[0-9]+';
