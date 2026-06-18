'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { useRole } from '@/lib/useRole' // Import useRole berhasil ditambahkan
import { Plus, Trash2, WalletCards, Search } from 'lucide-react'

interface Expense {
  id: string
  title: string
  amount: number
  category: string
  notes: string | null
  date: string
  created_at: string
}

const CATEGORIES = [
  { value: 'stok', label: '📦 Beli Stok/Bahan Baku', color: 'bg-blue-100 text-blue-700' },
  { value: 'gaji', label: '👤 Gaji Karyawan', color: 'bg-purple-100 text-purple-700' },
  { value: 'operasional', label: '⚡ Biaya Operasional', color: 'bg-orange-100 text-orange-700' },
  { value: 'lainnya', label: '📝 Lainnya', color: 'bg-gray-100 text-gray-700' },
]

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function ExpensesPage() {
  const supabase = createClient()
  const { isOwner } = useRole() // Menambahkan hook role setelah deklarasi awal
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'stok',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [formLoading, setFormLoading] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setExpenses(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('expenses').insert({
      user_id: user.id,
      title: form.title,
      amount: Number(form.amount),
      category: form.category,
      notes: form.notes || null,
      date: form.date,
    })

    setForm({
      title: '',
      amount: '',
      category: 'stok',
      notes: '',
      date: new Date().toISOString().split('T')[0],
    })
    setShowForm(false)
    setFormLoading(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pengeluaran ini?')) return
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const getCategoryInfo = (value: string) =>
    CATEGORIES.find(c => c.value === value) ?? CATEGORIES[3]

  const filtered = expenses.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat ? e.category === filterCat : true
    return matchSearch && matchCat
  })

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pengeluaran</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Total: <span className="font-semibold text-red-500">{formatRupiah(totalAll)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      {/* Ringkasan per kategori */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {CATEGORIES.map(cat => {
          const total = expenses
            .filter(e => e.category === cat.value)
            .reduce((s, e) => s + e.amount, 0)
          return (
            <div key={cat.value} className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">{cat.label}</p>
              <p className="text-sm font-bold text-gray-800">{formatRupiah(total)}</p>
            </div>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari pengeluaran..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <WalletCards size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Belum ada pengeluaran</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">{filtered.length} pengeluaran</span>
              <span className="text-xs font-semibold text-red-500">{formatRupiah(totalFiltered)}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map(expense => {
                const cat = getCategoryInfo(expense.category)
                return (
                  <div key={expense.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-800">{expense.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>
                          {cat.label.split(' ').slice(1).join(' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">{formatDate(expense.date)}</p>
                        {expense.notes && (
                          <p className="text-xs text-gray-400 truncate">· {expense.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{formatRupiah(expense.amount)}</p>
                    </div>
                    {/* Pembatasan Tombol Hapus Pengeluaran */}
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Tambah Pengeluaran</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Contoh: Beli tepung terigu 5kg"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className={inputClass}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan <span className="text-gray-400">(opsional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Catatan tambahan..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {formLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}