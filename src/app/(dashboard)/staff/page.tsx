'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import { Plus, Trash2, Users, TrendingUp, ShoppingCart, Wallet } from 'lucide-react'

interface Staff {
  id: string
  owner_name: string | null
  business_name: string
  role: string
}

interface StaffStats {
  totalTransactions: number
  totalRevenue: number
  totalProfit: number
}

interface StaffTransactionStatsRow {
  staff_id: string
  total_transactions: number
  total_revenue: number
  total_profit: number
}

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function StaffPage() {
  const localizedLanguage = useLanguage().language

  const supabase = createClient()
  const { formatCurrency } = useCurrency()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [staffStats, setStaffStats] = useState<Record<string, StaffStats>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', password: '', name: '' })

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('*')
      .eq('owner_id', user.id)
      .eq('role', 'staff')

    if (staffError) {
      setLoadError(staffError.message)
      setLoading(false)
      return
    }

    setStaffList(staff ?? [])

    const { data: statsData, error: statsError } = await supabase.rpc('get_staff_transaction_stats')
    if (statsError) {
      setLoadError(statsError.message)
      setLoading(false)
      return
    }

    const statsRows: StaffTransactionStatsRow[] = statsData ?? []
    const stats: Record<string, StaffStats> = {}
    for (const employee of staff ?? []) {
      const employeeStats = statsRows.find(row => row.staff_id === employee.id)
      stats[employee.id] = {
        totalTransactions: Number(employeeStats?.total_transactions ?? 0),
        totalRevenue: Number(employeeStats?.total_revenue ?? 0),
        totalProfit: Number(employeeStats?.total_profit ?? 0),
      }
    }

    setStaffStats(stats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? translateText('Gagal membuat akun', localizedLanguage))
      setFormLoading(false)
      return
    }

    await supabase.from('profiles').upsert({
      id: data.user.id,
      owner_name: form.name,
      business_name: 'Karyawan',
      role: 'staff',
      owner_id: currentUser.id,
    })

    setForm({ email: '', password: '', name: '' })
    setShowForm(false)
    setFormLoading(false)
    setSuccess(translateText("✅ Akun karyawan berhasil dibuat!", localizedLanguage))
    setTimeout(() => setSuccess(''), 4000)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(translateText("Hapus akun karyawan ini?", localizedLanguage))) return
    await supabase.from('profiles').delete().eq('id', id)
    setStaffList(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Kelola Karyawan"} />}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{staffList.length} {<LocalizedText text={" karyawan terdaftar"} />}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> {<LocalizedText text={" Tambah Karyawan\r\n        "} />}</button>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl border border-green-200">
          {success}
        </div>
      )}

      {/* Info akses */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-blue-700 mb-2">{<LocalizedText text={"🔒 Hak Akses Karyawan"} />}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <p className="text-xs text-blue-600">{<LocalizedText text={"✅ Bisa menggunakan kasir"} />}</p>
          <p className="text-xs text-blue-600">{<LocalizedText text={"✅ Bisa melihat produk & transaksi"} />}</p>
          <p className="text-xs text-red-500">{<LocalizedText text={"❌ Tidak bisa ubah/hapus produk"} />}</p>
          <p className="text-xs text-red-500">{<LocalizedText text={"❌ Tidak bisa lihat laporan"} />}</p>
          <p className="text-xs text-red-500">{<LocalizedText text={"❌ Tidak bisa menambah/hapus pengeluaran"} />}</p>
          <p className="text-xs text-red-500">{<LocalizedText text={"❌ Tidak bisa lihat laba bersih"} />}</p>
          <p className="text-xs text-red-500">{<LocalizedText text={"❌ Tidak bisa akses pengaturan"} />}</p>
          <p className="text-xs text-red-500">{<LocalizedText text={"❌ Tidak bisa kelola karyawan"} />}</p>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
          {<LocalizedText text={"\r\n          Gagal memuat data karyawan: "} />}{loadError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">{<LocalizedText text={"Memuat data..."} />}</div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{<LocalizedText text={"Belum ada karyawan"} />}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffList.map(staff => {
            const stats = staffStats[staff.id]
            const isExpanded = expandedStaff === staff.id

            return (
              <div key={staff.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="px-4 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">
                      {staff.owner_name?.charAt(0).toUpperCase() ?? <LocalizedText text={"K"} />}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{staff.owner_name ?? <LocalizedText text={"Karyawan"} />}</p>
                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{<LocalizedText text={"STAFF"} />}</span>
                  </div>

                  {stats && (
                    <div className="hidden sm:flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs text-gray-400">{<LocalizedText text={"Transaksi"} />}</p>
                        <p className="text-sm font-bold text-gray-800">{stats.totalTransactions}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{<LocalizedText text={"Omzet"} />}</p>
                        <p className="text-sm font-bold text-indigo-600">{formatCurrency(stats.totalRevenue)}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(staff.id) }}
                    className="text-gray-300 hover:text-red-400 transition-colors ml-2"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {isExpanded && stats && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{<LocalizedText text={"Performa Keseluruhan"} />}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <ShoppingCart size={13} className="text-blue-500" />
                          <p className="text-xs text-gray-500">{<LocalizedText text={"Transaksi"} />}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-800">{stats.totalTransactions}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp size={13} className="text-indigo-500" />
                          <p className="text-xs text-gray-500">{<LocalizedText text={"Omzet"} />}</p>
                        </div>
                        <p className="text-sm font-bold text-indigo-600">{formatCurrency(stats.totalRevenue)}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Wallet size={13} className="text-green-500" />
                          <p className="text-xs text-gray-500">{<LocalizedText text={"Laba Bersih"} />}</p>
                        </div>
                        <p className={`text-sm font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatCurrency(stats.totalProfit)}
                        </p>
                      </div>
                    </div>

                    {stats.totalTransactions > 0 && (
                      <div className="mt-3 bg-white rounded-xl border border-gray-200 px-4 py-3 flex justify-between items-center">
                        <p className="text-xs text-gray-500">{<LocalizedText text={"Rata-rata per transaksi"} />}</p>
                        <p className="text-sm font-semibold text-gray-700">
                          {formatCurrency(Math.round(stats.totalRevenue / stats.totalTransactions))}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{<LocalizedText text={"Tambah Karyawan"} />}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">{<LocalizedText text={"✕"} />}</button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Nama Karyawan *"} />}</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={translateText("Contoh: Budi", localizedLanguage)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Email *"} />}</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder={translateText("email@karyawan.com", localizedLanguage)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Password *"} />}</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={translateText("Minimal 6 karakter", localizedLanguage)}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {<LocalizedText text={"\r\n                  Batal\r\n                "} />}</button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {formLoading ? <LocalizedText text={"Membuat akun..."} /> : <LocalizedText text={"Buat Akun"} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}