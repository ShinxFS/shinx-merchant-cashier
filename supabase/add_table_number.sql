-- Tambah nomor meja ke transaksi (untuk fitur kasir multi-meja).
-- Jalankan di Supabase: Dashboard > SQL Editor > New query > tempel > Run.
-- Nilai NULL berarti transaksi "Bawa Pulang" (takeaway) / tanpa meja.

alter table transactions
  add column if not exists table_number integer;
