-- Tambah kategori kedua ke produk (produk bisa punya sampai 2 kategori).
-- Jalankan di Supabase: Dashboard > SQL Editor > New query > tempel > Run.
-- Kolom nullable & pakai FK ke categories supaya bisa di-embed & ikut terhapus rapi.

alter table products
  add column if not exists category_id_2 uuid
  references categories(id) on delete set null;
