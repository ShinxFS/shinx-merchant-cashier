'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Users } from 'lucide-react'

interface Staff {
  id: string
  owner_name: string | null
  business_name: string | null
  role: string
  email: string | null
}

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function StaffPage() {
  const supabase = createClient()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  })

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Ambil data profile owner untuk mendapatkan nama business_name asli milik toko Anda
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setCurrentUserProfile(ownerProfile)

    // Ambil data staf yang terikat dengan owner_id milik akun ini
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('owner_id', user.id)
      .eq('role', 'staff')
      .order('owner_name')

    setStaffList(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')

    // 1. Daftarkan akun kredensial login karyawan ke auth Supabase
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Gagal membuat akun login karyawan')
      setFormLoading(false)
      return
    }

    // 2. Masukkan data profil lengkap ke dalam tabel 'profiles' publik
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      owner_name: form.name, // Menyimpan nama karyawan ke owner_name agar terbaca di UI
      business_name: currentUserProfile?.business_name || 'Shinx Merchant', // Menyelaraskan nama bisnis merchant Anda
      role: 'staff',
      email: form.email, // Menyimpan data email agar bisa ditarik langsung ke komponen UI
      owner_id: currentUserProfile?.id || null, // Mengikat staf ke ID merchant Anda selaku owner
    })

    if (profileError) {
      setError(profileError.message)
      setFormLoading(false)
      return
    }

    setForm({ email: '', password: '', name: '' })
    setShowForm(false)
    setFormLoading(false)
    setSuccess('✅ Akun karyawan berhasil dibuat!')
    setTimeout(() => setSuccess(''), 4000)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus akun karyawan ini? Aksi ini tidak bisa dibatalkan.')) return
    await supabase.from('profiles').delete().eq('id', id)
    setStaffList(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kelola Karyawan</h1>
          <p className="text-sm text-gray-500 mt-0.5">{staffList.length} karyawan terdaftar</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Tambah Karyawan
        </button>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl border border-green-200">
          {success}
        </div>
      )}

      {/* Info akses */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-blue-700 mb-2">🔒 Hak Akses Karyawan</p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>✅ Bisa menggunakan kasir</li>
          <li>✅ Bisa melihat produk & transaksi</li>
          <li>✅ Bisa menambah pengeluaran</li>
          <li>❌ Tidak bisa mengubah/menghapus stok produk</li>
          <li>❌ Tidak bisa menghapus pengeluaran</li>
          <li>❌ Tidak bisa melihat laba bersih</li>
          <li>❌ Tidak bisa mengakses pengaturan</li>
          <li>❌ Tidak bisa mengelola karyawan</li>
        </ul>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuat data...</div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Belum ada karyawan</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {staffList.map(staff => (
              <div key={staff.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">
                      {staff.owner_name?.charAt(0).toUpperCase() ?? 'K'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{staff.owner_name ?? 'Karyawan Tanpa Nama'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase">
                        {staff.role}
                      </span>
                      {staff.email && (
                        <p className="text-xs text-gray-400">{staff.email}</p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(staff.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Tambah Karyawan</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-100">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Karyawan *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Contoh: Budi"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Karyawan *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@karyawan.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Login *</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Minimal 6 karakter"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {formLoading ? 'Membuat akun...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}