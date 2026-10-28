'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export const LANGUAGE_OPTIONS = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' },
] as const

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code']

const LANGUAGE_STORAGE_KEY = 'shinx-language'

const translations: Array<[string, string]> = [
  ['Masuk ke akun kamu', 'Sign in to your account'],
  ['Belum punya akun?', "Don't have an account?"],
  ['Daftar sekarang', 'Sign up now'],
  ['Buat Akun Baru', 'Create a New Account'],
  ['Daftarkan bisnis kamu', 'Register your business'],
  ['Nama Bisnis', 'Business Name'],
  ['Sudah punya akun?', 'Already have an account?'],
  ['Masuk di sini', 'Sign in here'],
  ['Dashboard', 'Dashboard'],
  ['Selamat datang kembali,', 'Welcome back,'],
  ['Gagal memuat dashboard:', 'Failed to load dashboard:'],
  ['Arus Kas Masuk/Keluar', 'Cash Inflow/Outflow'],
  ['Ringkasan pendapatan, biaya, dan laba bersih', 'Summary of revenue, expenses, and net profit'],
  ['Hari ini', 'Today'],
  ['7 Hari', '7 Days'],
  ['Bulan ini', 'This Month'],
  ['Transaksi Terbaru', 'Recent Transactions'],
  ['Lihat semua', 'View all'],
  ['Belum ada transaksi hari ini', 'No transactions today'],
  ['Pengeluaran', 'Expenses'],
  ['Total:', 'Total:'],
  ['Tambah', 'Add'],
  ['Semua Kategori', 'All Categories'],
  ['Belum ada pengeluaran', 'No expenses yet'],
  ['pengeluaran', 'expenses'],
  ['· Dibuat', '· Created'],
  ['Tambah Pengeluaran', 'Add Expense'],
  ['Keterangan *', 'Description *'],
  ['Jumlah (', 'Amount ('],
  [') *', ') *'],
  ['Tanggal *', 'Date *'],
  ['Edit', 'Edit'],
  ['Catatan', 'Notes'],
  ['(opsional)', '(optional)'],
  ['Batal', 'Cancel'],
  ['Pilih', 'Select'],
  ['Kalkulator HPP', 'COGS Calculator'],
  ['Hitung Harga Pokok Penjualan & rekomendasi harga jual berdasarkan target margin.', 'Calculate cost of goods sold and recommended selling prices based on a target margin.'],
  ['Identitas', 'Details'],
  ['Reset Form', 'Reset Form'],
  ['Hasil Perhitungan', 'Calculation Results'],
  ['Total Biaya', 'Total Cost'],
  ['HPP per Unit', 'COGS per Unit'],
  ['Break Even Point', 'Break-even Point'],
  ['Target Margin', 'Target Margin'],
  ['%', '%'],
  ['Harga Minimum', 'Minimum Price'],
  ['Harga Rekomendasi', 'Recommended Price'],
  ['Produk Tersimpan', 'Saved Products'],
  ['Export ke Excel', 'Export to Excel'],
  ['Belum ada produk yang disimpan', 'No saved products yet'],
  ['Nama', 'Name'],
  ['Jenis', 'Type'],
  ['HPP/Unit', 'COGS/Unit'],
  ['Rekomendasi', 'Recommended'],
  ['Margin', 'Margin'],
  ['Jadikan Produk', 'Create Product'],
  ['Semua', 'All'],
  ['Stok Tersedia Saja', 'Available Only'],
  ['Keranjang', 'Cart'],
  ['Hapus Semua', 'Clear All'],
  ['Meja', 'Table'],
  ['Hapus', 'Delete'],
  ['Keranjang kosong', 'Cart is empty'],
  ['Klik produk untuk menambahkan', 'Tap a product to add it'],
  ['item', 'items'],
  ['Kirim Pesanan Meja', 'Send Table Order'],
  ['Bayar', 'Pay'],
  ['Memuat data...', 'Loading data...'],
  ['Status Produk', 'Product Status'],
  ['Badge Aktif dan Nonaktif terlihat di daftar produk.', 'Active and Inactive badges are shown in the product list.'],
  ['Riwayat Transaksi', 'Transaction History'],
  ['Filter transaksi menurut bulan dan tahun.', 'Filter transactions by month and year.'],
  ['Catatan produk baru, stok menipis, dan perubahan nama toko.', 'Updates on new products, low stock, and store name changes.'],
  ['Notifikasi', 'Notifications'],
  ['Changelog', 'Changelog'],
  ['Keluar', 'Sign out'],
  ['Menu', 'Menu'],
  ['Log Notifikasi', 'Notification Log'],
  ['Memuat notifikasi...', 'Loading notifications...'],
  ['Belum ada notifikasi.', 'No notifications yet.'],
  ['Mode Gelap', 'Dark Mode'],
  ['Menambahkan tampilan gelap untuk mengurangi kelelahan mata.', 'Added dark mode to reduce eye strain.'],
  ['Mode Compact', 'Compact Mode'],
  ['Sembunyikan gambar produk agar lebih banyak item terlihat di layar kasir.', 'Hide product images to fit more items on the cashier screen.'],
  ['Restock Produk', 'Restock Products'],
  ['Tambah stok langsung dari daftar produk.', 'Restock directly from the product list.'],
  ['Produk', 'Products'],
  ['produk terdaftar', 'products listed'],
  ['Export CSV', 'Export CSV'],
  ['Import CSV', 'Import CSV'],
  ['Tambah Produk', 'Add Product'],
  ['⚠️ Stok Menipis', '⚠️ Low Stock'],
  ['— sisa', '— left'],
  ['🚫 Stok Habis', '🚫 Out of Stock'],
  ['Memuat produk...', 'Loading products...'],
  ['Gagal memuat produk:', 'Failed to load products:'],
  ['Harga', 'Price'],
  ['Stok', 'Stock'],
  ['Aksi', 'Actions'],
  ['🛍️', '🛍️'],
  ['Restock Barang', 'Restock Item'],
  ['Detail Produk:', 'Product Details:'],
  ['Jumlah saat ini', 'Current Quantity'],
  ['Jumlah setelah restock', 'Quantity After Restock'],
  ['Jumlah tambahan', 'Quantity to Add'],
  ['Memuat laporan...', 'Loading reports...'],
  ['Laporan Penjualan', 'Sales Report'],
  ['Gagal memuat laporan:', 'Failed to load report:'],
  ['Gagal mengekspor laporan:', 'Failed to export report:'],
  ['Pilih Bulan:', 'Select Month:'],
  ['Gagal memuat laporan bulanan:', 'Failed to load monthly report:'],
  ['Pendapatan', 'Revenue'],
  ['HPP', 'COGS'],
  ['Laba Kotor', 'Gross Profit'],
  ['Laba Bersih', 'Net Profit'],
  ['Pendapatan / Pengeluaran', 'Revenue / Expenses'],
  ['Laba Kotor (Pendapatan / HPP)', 'Gross Profit (Revenue / COGS)'],
  ['Grafik Laba Bersih', 'Net Profit Chart'],
  ['Jumlah Transaksi', 'Number of Transactions'],
  ['Produk Terlaris', 'Top Products'],
  ['Gagal memuat produk terlaris:', 'Failed to load top products:'],
  ['Belum ada data', 'No data yet'],
  ['#', '#'],
  ['x ·', 'x ·'],
  ['Profil Toko', 'Store Profile'],
  ['✅ Perubahan berhasil disimpan!', '✅ Changes saved successfully!'],
  ['Nama Pemilik', 'Owner Name'],
  ['Nomor Telepon', 'Phone Number'],
  ['Alamat', 'Address'],
  ['Mata Uang Toko', 'Store Currency'],
  ['Atur mata uang tampilan tanpa mengonversi otomatis nilai yang sudah tersimpan.', 'Set the display currency without automatically converting values already stored.'],
  ['Pilihan ini hanya mengubah format tampilan, bukan angka yang sudah tersimpan. Jika benar-benar berpindah mata uang, sesuaikan angka lama secara manual terlebih dahulu.', 'This only changes how amounts are displayed, not the values already stored. If you are switching currencies, update existing amounts manually first.'],
  ['Gagal memuat mata uang toko:', 'Failed to load store currency:'],
  ['. Jika kolom atau fungsi mata uang belum ada, jalankan', '. If the currency column or function is missing, run'],
  ['di Supabase SQL Editor.', 'in the Supabase SQL Editor.'],
  ['Hanya pemilik toko yang dapat mengganti mata uang.', 'Only the store owner can change the currency.'],
  ['Mata uang tampilan berhasil diubah. Nilai yang tersimpan tidak diubah.', 'Display currency updated. Stored values were not changed.'],
  ['Mata uang saat ini', 'Current Currency'],
  ['Mata uang baru', 'New Currency'],
  ['Tampilan Kasir', 'Cashier Display'],
  ['Menyimpan pengaturan...', 'Saving settings...'],
  ['Rekening Transfer', 'Bank Accounts'],
  ['Rekening ini akan muncul di kasir saat metode pembayaran Transfer dipilih.', 'These accounts appear at checkout when bank transfer is selected.'],
  ['·', '·'],
  ['a.n.', 'Account name:'],
  ['QRIS Pembayaran', 'QRIS Payment'],
  ['Unggah gambar QRIS toko. Akan tampil di kasir saat metode bayar QRIS dipilih.', 'Upload your store QRIS image. It will appear at checkout when QRIS is selected.'],
  ['PNG / JPG', 'PNG / JPG'],
  ['Suara Notifikasi', 'Notification Sounds'],
  ['Suara Kasir', 'Cashier Sound'],
  ['Diputar saat ada pesanan baru atau meja selesai', 'Plays when a new order arrives or a table order is completed'],
  ['Tes suara', 'Test Sound'],
  ['Variasi nada default', 'Default Tone'],
  ['Suara Pelanggan', 'Customer Sound'],
  ['Diputar saat pesanan sudah siap di meja pelanggan', 'Plays when an order is ready for the customer'],
  ['QR Meja Pelanggan', 'Customer Table QR Codes'],
  ['Menyiapkan QR meja...', 'Preparing table QR codes...'],
  ['Kategori Produk', 'Product Categories'],
  ['Belum ada kategori', 'No categories yet'],
  ['Kelola Karyawan', 'Manage Staff'],
  ['karyawan terdaftar', 'staff members listed'],
  ['Tambah Karyawan', 'Add Staff Member'],
  ['🔒 Hak Akses Karyawan', '🔒 Staff Permissions'],
  ['✅ Bisa menggunakan kasir', '✅ Can use the cashier'],
  ['✅ Bisa melihat produk & transaksi', '✅ Can view products & transactions'],
  ['❌ Tidak bisa ubah/hapus produk', '❌ Cannot edit/delete products'],
  ['❌ Tidak bisa lihat laporan', '❌ Cannot view reports'],
  ['❌ Tidak bisa menambah/hapus pengeluaran', '❌ Cannot add/delete expenses'],
  ['❌ Tidak bisa lihat laba bersih', '❌ Cannot view net profit'],
  ['❌ Tidak bisa akses pengaturan', '❌ Cannot access settings'],
  ['❌ Tidak bisa kelola karyawan', '❌ Cannot manage staff'],
  ['Gagal memuat data karyawan:', 'Failed to load staff data:'],
  ['Belum ada karyawan', 'No staff members yet'],
  ['STAFF', 'STAFF'],
  ['Transaksi', 'Transactions'],
  ['Omzet', 'Revenue'],
  ['Performa Keseluruhan', 'Overall Performance'],
  ['Rata-rata per transaksi', 'Average per Transaction'],
  ['Nama Karyawan *', 'Staff Name *'],
  ['Email *', 'Email *'],
  ['Password *', 'Password *'],
  ['Order Meja', 'Table Orders'],
  ['pesanan aktif', 'active orders'],
  ['Memuat daftar order meja...', 'Loading table orders...'],
  ['Belum ada pesanan meja.', 'No table orders yet.'],
  ['x', 'x'],
  ['Total', 'Total'],
  ['ditampilkan dari', 'shown from'],
  ['transaksi', 'transactions'],
  ['Pendapatan Hari Ini', "Today's Revenue"],
  ['Laba bersih:', 'Net profit:'],
  ['Memuat transaksi...', 'Loading transactions...'],
  ['Gagal memuat transaksi:', 'Failed to load transactions:'],
  ['+', '+'],
  ['Qty', 'Qty'],
  ['Modal', 'Cost'],
  ['Subtotal', 'Subtotal'],
  ['Diskon', 'Discount'],
  ['-', '-'],
  ['Pajak', 'Tax'],
  ['Kembalian', 'Change'],
  ['Metode', 'Method'],
  ['Rekening', 'Account'],
  ['Analisis Laba', 'Profit Analysis'],
  ['(setelah diskon/pajak)', '(after discount/tax)'],
  ['Halaman', 'Page'],
  ['dari', 'of'],
  ['Sebelumnya', 'Previous'],
  ['Berikutnya', 'Next'],
  ['Memuat menu meja', 'Loading table menu'],
  ['QR meja tidak valid', 'Invalid table QR code'],
  ['Silakan scan QR dari meja yang benar.', 'Please scan the QR code at the correct table.'],
  ['Belum ada pesanan', 'No order yet'],
  ['RINCIAN ORDER', 'ORDER DETAILS'],
  ['WAKTU ORDER:', 'ORDER TIME:'],
  ['Catatan:', 'Notes:'],
  ['Batal Order', 'Cancel Order'],
  ['Menu untuk meja ini belum tersedia.', 'The menu for this table is not available yet.'],
  ['Belum ada produk di kategori ini.', 'No products in this category yet.'],
  ['IMG', 'IMG'],
  ['Stok habis', 'Out of stock'],
  ['Ringkasan Order', 'Order Summary'],
  ['Item', 'Items'],
  ['Belum ada produk yang dipilih.', 'No products selected yet.'],
  ['Catatan untuk kasir', 'Notes for the cashier'],
  ['Metode bayar', 'Payment method'],
  ['Setelah bayar, tunggu konfirmasi kasir untuk melanjutkan proses pesanan.', 'After paying, wait for the cashier to confirm before proceeding with your order.'],
  ['QRIS belum diatur oleh pemilik toko.', 'The store owner has not set up QRIS yet.'],
  ['Status pesanan:', 'Order status:'],
  ['Order sedang diproses oleh kasir, pembatalan tidak tersedia.', 'The cashier is processing this order; cancellation is unavailable.'],
  ['Ringkasan Pembayaran', 'Payment Summary'],
  ['Rincian Order', 'Order Details'],
  ['Metode Bayar', 'Payment Method'],
  ['Scan QRIS', 'Scan QRIS'],
  ['Scan & bayar sejumlah', 'Scan and pay'],
  ['QRIS belum diatur', 'QRIS is not set up'],
  ['Unggah gambar QRIS di menu Pengaturan terlebih dahulu.', 'Upload a QRIS image in Settings first.'],
  ['Scan Barcode', 'Scan Barcode'],
  ['Tutup', 'Close'],
  ['Arahkan kamera ke barcode produk', 'Point the camera at the product barcode'],
  ['Proses Pembayaran', 'Process Payment'],
  ['Rp', 'IDR'],
  ['Pajak (%)', 'Tax (%)'],
  ['Pilih Rekening Tujuan', 'Select Destination Account'],
  ['Belum ada rekening transfer', 'No bank accounts added yet'],
  ['Tambahkan rekening di menu Pengaturan.', 'Add a bank account in Settings.'],
  ['Jumlah Dibayar', 'Amount Paid'],
  ['Kurang', 'Short'],
  ['Pastikan nominal pada aplikasi pelanggan sesuai sebelum konfirmasi', 'Make sure the amount in the customer app matches before confirming'],
  ['Struk Pembayaran', 'Payment Receipt'],
  ['No:', 'No:'],
  ['Tgl:', 'Date:'],
  ['Meja:', 'Table:'],
  ['TOTAL', 'TOTAL'],
  ['Bayar (', 'Payment ('],
  ['Kembali', 'Back'],
  ['— Terima kasih! —', '— Thank you! —'],
  ['Kompres...', 'Compressing...'],
  ['✅', '✅'],
  ['→', '→'],
  ['JPG, PNG — otomatis dikompres', 'JPG, PNG — compressed automatically'],
  ['Nama Produk *', 'Product Name *'],
  ['SKU / Barcode', 'SKU / Barcode'],
  ['Scan', 'Scan'],
  ['Harga Jual *', 'Selling Price *'],
  ['Harga Modal', 'Cost Price'],
  ['Stok *', 'Stock *'],
  ['Satuan', 'Unit'],
  ['Kategori 1', 'Category 1'],
  ['— Tanpa Kategori —', '— No Category —'],
  ['Kategori 2', 'Category 2'],
  ['Produk aktif (tampil di kasir)', 'Active product (shown at checkout)'],
  ['nama@email.com', 'name@example.com'],
  ['Nama Toko Kamu', 'Your Store Name'],
  ['Minimal 6 karakter', 'At least 6 characters'],
  ['Cari produk...', 'Search products...'],
  ['Scan barcode', 'Scan barcode'],
  ['Hapus meja', 'Remove table'],
  ['Tambah meja', 'Add table'],
  ['Periode cash flow', 'Cash flow period'],
  ['Cari pengeluaran...', 'Search expenses...'],
  ['Contoh: Beli tepung terigu 5kg', 'Example: Buy 5kg of flour'],
  ['0', '0'],
  ['Catatan tambahan...', 'Additional notes...'],
  ['Jadikan produk jual', 'Set as a sellable product'],
  ['Cari nama atau SKU...', 'Search name or SKU...'],
  ['Restock', 'Restock'],
  ['Edit produk', 'Edit product'],
  ['Hapus produk', 'Delete product'],
  ['Tutup restock barang', 'Close item restock'],
  ['Pilih bulan laporan', 'Select report month'],
  ['Toko Shinx', 'Shinx Store'],
  ['Nama pemilik toko', 'Store owner name'],
  ['08xxxxxxxxxx', '08xxxxxxxxxx'],
  ['Alamat lengkap toko', 'Full store address'],
  ['Mode tanpa gambar', 'Image-free mode'],
  ['Nama bank', 'Bank name'],
  ['Nomor rekening', 'Account number'],
  ['Nama pemilik rekening', 'Account holder name'],
  ['QRIS Toko', 'Store QRIS'],
  ['Nama kategori baru...', 'New category name...'],
  ['Contoh: Budi', 'Example: Alex'],
  ['email@karyawan.com', 'staff@example.com'],
  ['Cari meja / menu / pelanggan', 'Search table / menu / customer'],
  ['Cari nomor invoice...', 'Search invoice number...'],
  ['Filter bulan transaksi', 'Filter transactions by month'],
  ['Filter tahun transaksi', 'Filter transactions by year'],
  ['Geser kategori ke kiri', 'Scroll categories left'],
  ['Geser kategori ke kanan', 'Scroll categories right'],
  ['Contoh: tidak pedas, tolong dipisah pakai wadah', 'Example: not spicy, please pack separately'],
  ['QRIS pembayaran', 'QRIS payment'],
  ['Jenis diskon', 'Discount type'],
  ['Contoh: 11 untuk PPN 11%', 'Example: 11 for 11% VAT'],
  ['Masukkan nominal...', 'Enter an amount...'],
  ['Contoh: Kopi Hitam', 'Example: Black Coffee'],
  ['Ketik manual atau scan', 'Type manually or scan'],
  ['SCAN', 'SCAN'],
  ['ID', 'ID'],
  ['EN', 'EN'],
  ['👤 Akun Staf', '👤 Staff Account'],
  ['Aktif', 'Active'],
  ['Aktif — gambar produk nonaktif', 'Active — product images hidden'],
  ['Aktifkan mode gelap', 'Enable dark mode'],
  ['Aktifkan mode terang', 'Enable light mode'],
  ['Bagikan', 'Share'],
  ['Bahasa ini berlaku untuk seluruh aplikasi dan halaman QR meja, serta tersinkron di semua perangkat.', 'This language applies to the entire app and table QR pages, and syncs across devices.'],
  ['Bahasa mengikuti pengaturan pemilik toko.', 'The language follows the store owner’s setting.'],
  ['Bahasa Toko', 'Store Language'],
  ['Pilih Bahasa Indonesia atau English untuk aplikasi dan halaman QR meja.', 'Choose Indonesian or English for the app and table QR pages.'],
  ['Belum ada produk. Tambah produk dulu!', 'No products yet. Add a product first!'],
  ['Belum ada produk. Tambah produk pertama kamu!', 'No products yet. Add your first product!'],
  ['Buat Akun', 'Create Account'],
  ['Cetak', 'Print'],
  ['Contoh: 10', 'Example: 10'],
  ['Detail pesanan Anda', 'Your order details'],
  ['Edit Produk', 'Edit Product'],
  ['Ganti Gambar', 'Change Image'],
  ['Habis', 'Out of Stock'],
  ['Klik untuk unggah gambar QRIS', 'Click to upload a QRIS image'],
  ['Kosong', 'Empty'],
  ['Lihat Detail', 'View Details'],
  ['Pastikan supabase/multi_language.sql sudah dijalankan di Supabase SQL Editor.', 'Make sure supabase/multi_language.sql has been run in the Supabase SQL Editor.'],
  ['Membuat akun...', 'Creating account...'],
  ['Membuat...', 'Creating...'],
  ['Mengirim...', 'Sending...'],
  ['Mengompres...', 'Compressing...'],
  ['Mengunggah...', 'Uploading...'],
  ['Menyiapkan...', 'Preparing...'],
  ['Menyimpan...', 'Saving...'],
  ['Mode Terang', 'Light Mode'],
  ['Nominal diskon', 'Discount amount'],
  ['Nonaktif', 'Inactive'],
  ['Nonaktif — gambar produk aktif', 'Inactive — product images enabled'],
  ['Order sedang diproses', 'Order is being processed'],
  ['Order sudah dikirim', 'Order has been sent'],
  ['Pemilik', 'Owner'],
  ['Pajak (', 'Tax ('],
  ['Produk tidak ditemukan', 'No products found'],
  ['Proses', 'Process'],
  ['Rekening:', 'Account:'],
  ['Rincian order', 'Order details'],
  ['Bayar sebesar', 'Pay'],
  ['Selesai', 'Completed'],
  ['Sembunyikan', 'Hide'],
  ['Sembunyikan Cash Flow', 'Hide Cash Flow'],
  ['Sembunyikan Detail', 'Hide Details'],
  ['Siap', 'Ready'],
  ['Simpan', 'Save'],
  ['Simpan Perubahan', 'Save Changes'],
  ['Simpan Produk', 'Save Product'],
  ['Karyawan', 'Staff'],
  ['Tambah Rekening', 'Add Bank Account'],
  ['Tampilkan', 'Show'],
  ['Tampilkan Cash Flow', 'Show Cash Flow'],
  ['Tidak ada transaksi pada bulan yang dipilih', 'No transactions in the selected month'],
  ['Total pesanan', 'Order total'],
  ['Transaksi tidak ditemukan', 'No transactions found'],
  ['Tunai', 'Cash'],
  ['Tutup changelog', 'Close changelog'],
  ['Tutup log notifikasi', 'Close notification log'],
  ['Upload Foto', 'Upload Photo'],
  ['Upload suara', 'Upload sound'],
  ['Menunggu', 'Pending'],
  ['Diproses', 'Processing'],
  ['Menunggu konfirmasi', 'Awaiting confirmation'],
  ['Sedang diproses', 'Being processed'],
  ['Sudah siap', 'Ready'],
  ['Kasir', 'Cashier'],
  ['Laporan', 'Reports'],
  ['Pengaturan', 'Settings'],
  ['📦 Beli Stok/Bahan Baku', '📦 Buy Stock/Raw Materials'],
  ['👤 Gaji Karyawan', '👤 Employee Salaries'],
  ['⚡ Biaya Operasional', '⚡ Operating Expenses'],
  ['📝 Lainnya', '📝 Other'],
  ['Makanan & Minuman', 'Food & Beverage'],
  ['Kerajinan', 'Handicrafts'],
  ['Lainnya', 'Other'],
  ['Manufaktur', 'Manufacturing'],
  ['Perdagangan / Retail', 'Trading / Retail'],
  ['Servis / Jasa', 'Services'],
  ['Nama Produk', 'Product Name'],
  ['Contoh: Keripik Singkong', 'Example: Cassava Chips'],
  ['SKU / Kode Produk', 'SKU / Product Code'],
  ['Opsional', 'Optional'],
  ['Kategori', 'Category'],
  ['Jumlah Unit Produksi', 'Production Units'],
  ['Bahan Baku Langsung', 'Direct Materials'],
  ['Bahan Baku Utama', 'Main Raw Materials'],
  ['Bahan Pendukung', 'Supporting Materials'],
  ['Kemasan', 'Packaging'],
  ['Tenaga Kerja Langsung', 'Direct Labor'],
  ['Upah Produksi', 'Production Wages'],
  ['Bonus / Insentif', 'Bonus / Incentives'],
  ['Biaya Overhead', 'Overhead Costs'],
  ['Listrik & Utilitas', 'Electricity & Utilities'],
  ['Biaya Lainnya', 'Other Costs'],
  ['Jumlah Unit', 'Number of Units'],
  ['Biaya Pembelian', 'Purchase Costs'],
  ['Harga Beli Satuan', 'Unit Purchase Price'],
  ['Diskon Pembelian (total)', 'Purchase Discount (total)'],
  ['Biaya Tambahan', 'Additional Costs'],
  ['Ongkos Kirim', 'Shipping Cost'],
  ['Biaya Import / Bea', 'Import / Customs Fees'],
  ['Biaya Penyimpanan', 'Storage Costs'],
  ['Nama Layanan', 'Service Name'],
  ['Kode Layanan', 'Service Code'],
  ['Durasi (menit)', 'Duration (minutes)'],
  ['Jumlah Layanan', 'Number of Services'],
  ['Tenaga Kerja', 'Labor'],
  ['Upah Teknisi / Staff', 'Technician / Staff Wages'],
  ['Komisi', 'Commission'],
  ['Bahan / Material', 'Materials / Supplies'],
  ['Peralatan Sekali Pakai', 'Disposable Equipment'],
  ['Bahan & Perlengkapan', 'Materials & Supplies'],
  ['Klasik', 'Classic'],
  ['Bip', 'Beep'],
  ['Lembut', 'Soft'],
  ['Berhasil', 'Success'],
  ['Umum', 'General'],
  ['Memproses...', 'Processing...'],
  ['Browser memblokir suara otomatis. Klik sekali di halaman ini lalu coba lagi.', 'The browser blocked automatic audio. Click anywhere on this page once, then try again.'],
  ['Belum ada data produk untuk di-export.', 'There is no product data to export.'],
  ['Belum ada pesanan yang bisa dibatalkan.', 'There is no order available to cancel.'],
  ['File harus berupa audio. Format yang didukung: MP3, WAV, M4A.', 'The file must be audio. Supported formats: MP3, WAV, M4A.'],
  ['File harus berupa gambar.', 'The file must be an image.'],
  ['File CSV kosong atau format salah.', 'The CSV file is empty or has an invalid format.'],
  ['Gagal membatalkan pesanan. Coba ulang sebentar lagi.', 'Failed to cancel the order. Please try again shortly.'],
  ['Gagal membuat akun', 'Failed to create account'],
  ['Gagal membuat produk:', 'Failed to create product:'],
  ['Gagal memuat ringkasan transaksi.', 'Failed to load the transaction summary.'],
  ['Gagal mengakses kamera. Pastikan halaman dibuka via HTTPS atau localhost.', 'Could not access the camera. Make sure this page is opened over HTTPS or localhost.'],
  ['Gagal mengimpor produk:', 'Failed to import products:'],
  ['Gagal mengirim order. Coba ulang sebentar lagi.', 'Failed to send the order. Please try again shortly.'],
  ['Gagal mengubah nama kategori:', 'Failed to rename the category:'],
  ['Gagal mengunggah gambar', 'Failed to upload the image'],
  ['Gagal mengunggah QRIS.', 'Failed to upload the QRIS image.'],
  ['Gagal mengunggah suara notifikasi.', 'Failed to upload the notification sound.'],
  ['Gagal menyimpan rekening:', 'Failed to save the bank account:'],
  ['Gagal menyimpan:', 'Failed to save:'],
  ['Hapus akun karyawan ini?', 'Delete this staff account?'],
  ['Hapus gambar QRIS?', 'Delete the QRIS image?'],
  ['Hapus kategori ini?', 'Delete this category?'],
  ['Hapus order meja ini?', 'Delete this table order?'],
  ['Hapus pengeluaran ini?', 'Delete this expense?'],
  ['Hapus produk ini?', 'Delete this product?'],
  ['Hapus produk tersimpan ini?', 'Delete this saved product?'],
  ['Hapus rekening ini?', 'Delete this bank account?'],
  ['Hapus suara notifikasi', 'Delete the notification sound for'],
  ['Hapus invoice', 'Delete invoice'],
  ['? Aksi ini tidak bisa dibatalkan.', '? This action cannot be undone.'],
  ['Izin kamera ditolak. Aktifkan akses kamera di browser lalu coba lagi.', 'Camera permission was denied. Enable camera access in your browser and try again.'],
  ['Jadikan', 'Make'],
  ['" sebagai produk jual? Harga modal = HPP (', '" as a sellable product? Cost price = COGS ('],
  ['), harga jual = rekomendasi (', '), selling price = recommended ('],
  ['). Stok awal 0 — atur di menu Produk.', '). Initial stock is 0 — set it in Products.'],
  ['Kamera tidak ditemukan di perangkat ini.', 'No camera was found on this device.'],
  ['kasir', 'cashier'],
  ['pelanggan', 'customer'],
  ['Nama kategori tidak boleh kosong.', 'The category name cannot be empty.'],
  ['Nama produk/layanan wajib diisi sebelum menyimpan.', 'Enter a product or service name before saving.'],
  ['Order sudah diproses oleh kasir, pembatalan tidak tersedia.', 'The cashier has already processed this order, so it can no longer be canceled.'],
  ['Order yang sedang aktif tidak bisa diubah. Tunggu proses selesai dulu.', 'An active order cannot be changed. Wait for it to finish first.'],
  ['Pesanan Meja', 'Table Orders'],
  ['Sesi berakhir. Silakan masuk kembali.', 'Your session has expired. Please sign in again.'],
  ['Status pesanan belum bisa dimuat. Periksa koneksi atau policy table_orders di Supabase.', 'Order status could not be loaded. Check your connection or the table_orders policy in Supabase.'],
  ['Tidak bisa mengakses kamera. Pastikan halaman dibuka via HTTPS atau localhost.', 'Could not access the camera. Make sure this page is opened over HTTPS or localhost.'],
  ['✅ Akun karyawan berhasil dibuat!', '✅ Staff account created successfully!'],
  ['✅ Pesanan meja', '✅ Table order'],
  ['berhasil dibatalkan.', 'was canceled successfully.'],
  ['berhasil dikirim ke kasir.', 'was sent to the cashier.'],
  ['diterima. Bayar via QRIS dulu, lalu tunggu konfirmasi kasir.', 'received. Pay via QRIS first, then wait for the cashier to confirm.'],
  ['Berhasil mengimpor', 'Successfully imported'],
  ['produk beserta gambarnya!', 'products and their images!'],
  ['✅ "', '✅ "'],
  ['" ditambahkan ke Produk. Stok masih 0 — atur stok & foto di menu Produk.', '" was added to Products. Stock is still 0 — set the stock and add a photo in Products.'],
  ['QR Meja', 'Table QR'],
  ['Jumlah', 'Quantity'],
  ['Edit jumlah', 'Edit quantity'],
  ['Kurangi', 'Decrease'],
  ['Hapus rekening', 'Delete bank account'],
  ['Tambah stok', 'Restock'],
  ['Jumlah dalam', 'Quantity in'],
  ['Nama kategori', 'Category name'],
  ['Simpan nama kategori', 'Save category name'],
  ['Batal mengedit kategori', 'Cancel editing category'],
  ['Edit kategori', 'Edit category'],
  ['Hapus kategori', 'Delete category'],
  ['Kirim ke kasir •', 'Send to cashier •'],
  ['Sudah Dibayar ·', 'Paid ·'],
  ['masih ada pesanan. Hapus meja & buang pesanannya?', 'still has orders. Delete the table and discard its orders?'],
  ['Link pesanan tidak valid. Hubungi kasir untuk mendapatkan QR meja.', 'This order link is invalid. Contact the cashier to get the table QR code.'],
  ['Hapus suara notifikasi kasir?', 'Delete the cashier notification sound?'],
  ['Hapus suara notifikasi pelanggan?', 'Delete the customer notification sound?'],
  ['Ringkasan', 'Summary'],
  ['Struk', 'Receipt'],
  ['Jadikan "', 'Make "'],
  ['Mode gelap tidak dapat disimpan di browser ini.', 'Dark mode cannot be saved in this browser.'],
  ['Informasi', 'Information'],
  ['Nilai', 'Value'],
  ['Periode', 'Period'],
  ['Tanggal Ekspor', 'Export Date'],
  ['Mata Uang', 'Currency'],
  ['Peringkat', 'Rank'],
  ['Jumlah Terjual', 'Units Sold'],
  ['Rincian Periode', 'Period Details'],
  ['Terjadi kesalahan saat memuat laporan bulanan.', 'An error occurred while loading the monthly report.'],
  ['Terjadi kesalahan saat memuat laporan.', 'An error occurred while loading the report.'],
  ['Terjadi kesalahan saat mengekspor laporan.', 'An error occurred while exporting the report.'],
  ['Preferensi bahasa tidak dapat disimpan di browser ini.', 'Language preferences cannot be saved in this browser.'],
  ['Preferensi bahasa tidak dapat dibaca dari browser ini.', 'Language preferences cannot be read from this browser.'],
  ['Gagal memuat bahasa toko:', 'Failed to load the store language:'],
  ['Profil pemilik toko tidak ditemukan.', 'Store owner profile was not found.'],
  ['Kode bahasa toko tidak valid. Jalankan supabase/multi_language.sql di Supabase SQL Editor.', 'The store language code is invalid. Run supabase/multi_language.sql in the Supabase SQL Editor.'],
  ['Gagal memeriksa sesi pengguna:', 'Failed to check the user session:'],
  ['Gagal menyimpan bahasa toko:', 'Failed to save the store language:'],
  ['Sesi login tidak ditemukan. Silakan masuk kembali.', 'Your login session was not found. Please sign in again.'],
  ['Sesi login tidak ditemukan. Silakan login kembali.', 'Your login session was not found. Please sign in again.'],
  ['Masukkan jumlah restock berupa bilangan bulat lebih dari 0.', 'Enter a whole-number restock quantity greater than 0.'],
  ['Gagal mengambil stok terbaru. Coba lagi.', 'Failed to fetch the latest stock. Please try again.'],
  ['Gagal menyimpan stok. Coba lagi.', 'Failed to save the stock. Please try again.'],
  ['Sesi pengguna tidak ditemukan.', 'The user session was not found.'],
  ['Sesi pengguna tidak ditemukan. Muat ulang halaman lalu coba lagi.', 'The user session was not found. Refresh the page and try again.'],
  ['Gagal menyimpan mata uang:', 'Failed to save the currency:'],
  ['Gagal menyimpan pengaturan:', 'Failed to save the settings:'],
  ['Pengaturan ini memerlukan pembaruan database. Jalankan supabase/add_cashier_compact_mode.sql di Supabase SQL Editor.', 'This setting requires a database update. Run supabase/add_cashier_compact_mode.sql in the Supabase SQL Editor.'],
  ['Gagal memuat mode tanpa gambar:', 'Failed to load compact mode:'],
  ['Data toko belum siap. Tutup lalu coba buka lagi.', 'Store data is not ready. Close this and try again.'],
  ['Permintaan terlalu lama. Periksa koneksi lalu coba lagi.', 'The request took too long. Check your connection and try again.'],
  ['Gagal memuat log notifikasi. Periksa koneksi atau konfigurasi database.', 'Failed to load the notification log. Check your connection or database configuration.'],
  ['Terjadi kesalahan saat memuat dashboard.', 'An error occurred while loading the dashboard.'],
  ['Gagal memuat mata uang toko.', 'Failed to load the store currency.'],
  ['Kode mata uang toko tidak didukung.', 'The store currency code is not supported.'],
  ['Rupiah Indonesia (IDR)', 'Indonesian Rupiah (IDR)'],
  ['Dolar Amerika Serikat (USD)', 'US Dollar (USD)'],
  ['Dolar Singapura (SGD)', 'Singapore Dollar (SGD)'],
  ['Ringgit Malaysia (MYR)', 'Malaysian Ringgit (MYR)'],
  ['Baht Thailand (THB)', 'Thai Baht (THB)'],
  ['Peso Filipina (PHP)', 'Philippine Peso (PHP)'],
  ['Yen Jepang (JPY)', 'Japanese Yen (JPY)'],
  ['Yuan China (CNY)', 'Chinese Yuan (CNY)'],
  ['Won Korea Selatan (KRW)', 'South Korean Won (KRW)'],
  ['Dong Vietnam (VND)', 'Vietnamese Dong (VND)'],
  ['Pound Britania (GBP)', 'British Pound (GBP)'],
  ['Dolar Australia (AUD)', 'Australian Dollar (AUD)'],
  ['Dolar Kanada (CAD)', 'Canadian Dollar (CAD)'],
  ['Dinar Kuwait (KWD)', 'Kuwaiti Dinar (KWD)'],
  ['" tidak terdaftar', '" is not registered'],
  ['⚠️ Stok "', '⚠️ Stock "'],
  ['" habis', '" is out of stock'],
  ['ditambahkan ke keranjang', 'was added to the cart'],
  ['⚠️ Gagal mengirim pesanan meja', '⚠️ Failed to send the table order'],
  ['dikirim', 'was sent'],
  ['✅ Meja', '✅ Table'],
  ['masuk ke transaksi hari ini', 'was added to today’s transactions'],
  ['✅ Pesanan selesai berhasil dihapus', '✅ Completed order deleted successfully'],
  ['✅ Transaksi berhasil!', '✅ Transaction completed!'],
  ['Pesanan meja', 'Table order'],
  ['masuk ke kasir!', 'has arrived at the cashier!'],
  ['masuk!', 'has arrived!'],
  ['sudah selesai!', 'is complete!'],
]

interface LanguageContextValue {
  language: LanguageCode
  t: (text: string) => string
  isOwner: boolean
  ready: boolean
  saving: boolean
  error: string
  setLanguage: (language: LanguageCode) => Promise<boolean>
  setPreviewLanguage: (language: LanguageCode) => void
  applyProfileLanguage: (language: LanguageCode) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const idToEnglish = new Map<string, string>()
const englishToIndonesian = new Map<string, string>()
for (const [indonesian, english] of translations) {
  if (!idToEnglish.has(indonesian)) idToEnglish.set(indonesian, english)
  const currentIndonesian = englishToIndonesian.get(english)
  if (
    !currentIndonesian ||
    (currentIndonesian === currentIndonesian.toLowerCase() && indonesian !== indonesian.toLowerCase())
  ) {
    englishToIndonesian.set(english, indonesian)
  }
}

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'id' || value === 'en'
}

export function translateText(text: string, language: LanguageCode) {
  const leading = text.match(/^\s*/)?.[0] ?? ''
  const trailing = text.match(/\s*$/)?.[0] ?? ''
  const phrase = text.trim().replace(/\s+/g, ' ')
  if (!phrase) return text

  const translated = language === 'en'
    ? idToEnglish.get(phrase)
    : englishToIndonesian.get(phrase)

  return `${leading}${translated ?? phrase}${trailing}`
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [language, setLanguageState] = useState<LanguageCode>('id')
  const [storeOwnerId, setStoreOwnerId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const languageRef = useRef<LanguageCode>('id')

  const applyLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage)
    languageRef.current = nextLanguage
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    } catch {
      setError(translateText("Preferensi bahasa tidak dapat disimpan di browser ini.", nextLanguage))
    }
    document.documentElement.lang = nextLanguage
  }, [])

  const loadProfileLanguage = useCallback(async (userId: string | null) => {
    if (!userId) {
      setStoreOwnerId(null)
      setIsOwner(false)
      setReady(true)
      setError('')
      try {
        const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
        if (isLanguageCode(storedLanguage)) applyLanguage(storedLanguage)
      } catch {
        setError(translateText("Preferensi bahasa tidak dapat dibaca dari browser ini.", languageRef.current))
      }
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, owner_id')
      .eq('id', userId)
      .single()

    if (profileError) {
      setError(`${translateText("Gagal memuat bahasa toko: ", languageRef.current)}${profileError.message}`)
      setReady(true)
      return
    }

    const owner = profile.role === 'staff' ? profile.owner_id : userId
    if (!owner) {
      setError(translateText("Profil pemilik toko tidak ditemukan.", languageRef.current))
      setReady(true)
      return
    }

    setStoreOwnerId(owner)
    setIsOwner(profile.role === 'owner')

    const { data: ownerProfile, error: ownerError } = await supabase
      .from('profiles')
      .select('language_code')
      .eq('id', owner)
      .single()
    if (ownerError) {
      setError(`${translateText("Gagal memuat bahasa toko: ", languageRef.current)}${ownerError.message}`)
      setReady(true)
      return
    }

    const profileLanguage = ownerProfile.language_code
    if (!isLanguageCode(profileLanguage)) {
      setError(translateText("Kode bahasa toko tidak valid. Jalankan supabase/multi_language.sql di Supabase SQL Editor.", languageRef.current))
      setReady(true)
      return
    }

    setError('')
    setReady(true)
    applyLanguage(profileLanguage)
  }, [applyLanguage, supabase])

  useEffect(() => {
    let cancelled = false

    const loadCurrentUser = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (cancelled) return
      if (userError) {
        setError(`${translateText("Gagal memeriksa sesi pengguna: ", languageRef.current)}${userError.message}`)
        setReady(true)
        return
      }
      await loadProfileLanguage(user?.id ?? null)
    }

    void loadCurrentUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfileLanguage(session?.user.id ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfileLanguage, supabase])

  const setLanguage = useCallback(async (nextLanguage: LanguageCode) => {
    if (storeOwnerId && isOwner) {
      setSaving(true)
      setError('')
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ language_code: nextLanguage })
        .eq('id', storeOwnerId)

      if (updateError) {
        setError(`${translateText("Gagal menyimpan bahasa toko: ", languageRef.current)}${updateError.message}`)
        setSaving(false)
        return false
      }
      setSaving(false)
    } else if (storeOwnerId) {
      setError(translateText("Hanya pemilik toko yang dapat mengganti bahasa toko.", languageRef.current))
      return false
    }

    applyLanguage(nextLanguage)
    return true
  }, [applyLanguage, isOwner, storeOwnerId, supabase])

  const setPreviewLanguage = useCallback((nextLanguage: LanguageCode) => {
    applyLanguage(nextLanguage)
  }, [applyLanguage])

  const applyProfileLanguage = useCallback((nextLanguage: LanguageCode) => {
    setError('')
    applyLanguage(nextLanguage)
  }, [applyLanguage])

  const value = useMemo(() => ({
    language,
    t: (text: string) => translateText(text, language),
    isOwner,
    ready,
    saving,
    error,
    setLanguage,
    setPreviewLanguage,
    applyProfileLanguage,
  }), [language, isOwner, ready, saving, error, setLanguage, setPreviewLanguage, applyProfileLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage harus digunakan di dalam LanguageProvider.')
  return context
}

export function LocalizedText({ text }: { text: string }) {
  const { language } = useLanguage()
  return <>{translateText(text, language)}</>
}

export function LanguageToggle({ localOnly = false }: { localOnly?: boolean }) {
  const { language, saving, setLanguage, setPreviewLanguage, error } = useLanguage()
  const selectLanguage = async (nextLanguage: LanguageCode) => {
    if (nextLanguage === language || saving) return
    if (localOnly) {
      setPreviewLanguage(nextLanguage)
      return
    }
    await setLanguage(nextLanguage)
  }

  return (
    <div>
      <div
        className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
        role="group"
        aria-label={language === 'id' ? 'Pilih bahasa toko' : 'Select store language'}
      >
        {LANGUAGE_OPTIONS.map(option => (
          <button
            key={option.code}
            type="button"
            aria-pressed={language === option.code}
            onClick={() => void selectLanguage(option.code)}
            disabled={saving}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              language === option.code ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
            }`}
          >
            {option.code.toUpperCase()}
          </button>
        ))}
      </div>
      {!localOnly && error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
