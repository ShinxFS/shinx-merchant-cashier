'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Receipt, Search, ChevronDown, ChevronUp, TrendingUp, Trash2 } from 'lucide-react'

interface TransactionItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
  subtotal: number
}

interface Transaction {
  id: string
  invoice_number: string
  total: number
  subtotal: number
  discount: number
  tax: number
  payment_method: string
  amount_paid: number
  change_amount: number
  notes: string | null
  status: string
  created_at: string
  transaction_items?: TransactionItem[]
}

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isStaff = profile?.role === 'staff'
    setIsOwner(!isStaff)

    let query = supabase
      .from('transactions')
      .select('*, transaction_items(*)')
      .order('created_at', { ascending: false })

    if (isStaff) {
      query = query.eq('created_by', user.id)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data } = await query
    setTransactions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Hapus invoice ${invoiceNumber}? Aksi ini tidak bisa dibatalkan.`)) return
    await supabase.from('transaction_items').delete().eq('transaction_id', id)
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const filtered = transactions.filter(t =>
    t.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const paymentLabel: Record<string, string> = {
    cash: '💵 Tunai',
    transfer: '🏦 Transfer',
    ewallet: '📱 E-Wallet',
    qris: '📲 QRIS',
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev === id ? null : id)

  const today = new Date().toDateString()
  const todayTotal = transactions
    .filter(t => new Date(t.created_at).toDateString() === today)
    .reduce((s, t) => s + t.total, 0)

  const calcProfit = (tx: Transaction) => {
    const items = tx.transaction_items ?? []
    const totalModal = items.reduce((s, i) => s + (i.cost_price ?? 0) * i.quantity, 0)
    const labaKotor = tx.subtotal - totalModal
    const labaBersih = tx.total - totalModal
    return { totalModal, labaKotor, labaBersih }
  }

  const todayTx = transactions.filter(t => new Date(t.created_at).toDateString() === today)
  const todayLabaBersih = todayTx.reduce((s, t) => s + calcProfit(t).labaBersih, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{transactions.length} transaksi total</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Pendapatan Hari Ini</p>
          <p className="text-lg font-bold text-indigo-600">{formatRupiah(todayTotal)}</p>
          {isOwner && (
            <p className="text-xs text-green-500 mt-0.5">Laba bersih: {formatRupiah(todayLabaBersih)}</p>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nomor invoice..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuat transaksi...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {transactions.length === 0 ? 'Belum ada transaksi' : 'Transaksi tidak ditemukan'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tx => {
            const { labaKotor, labaBersih } = calcProfit(tx)
            return (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

                {/* Row utama */}
                <div className="px-5 py-4 flex items-center gap-4">
                  <button
                    onClick={() => toggleExpand(tx.id)}
                    className="flex-1 flex items-center gap-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{tx.invoice_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.created_at)}</p>
                    </div>
                    <div className="hidden sm:block text-xs text-gray-500">
                      {paymentLabel[tx.payment_method] ?? tx.payment_method}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatRupiah(tx.total)}</p>
                      {isOwner && (
                        <p className="text-xs text-green-500 mt-0.5">+{formatRupiah(labaBersih)}</p>
                      )}
                    </div>
                    <div className="text-gray-400">
                      {expanded === tx.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* Tombol hapus — hanya owner */}
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(tx.id, tx.invoice_number)}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Detail */}
                {expanded === tx.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase">
                          <th className="text-left pb-2 font-medium">Produk</th>
                          <th className="text-center pb-2 font-medium">Qty</th>
                          {isOwner && <th className="text-right pb-2 font-medium">Modal</th>}
                          <th className="text-right pb-2 font-medium">Harga</th>
                          <th className="text-right pb-2 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tx.transaction_items?.map(item => (
                          <tr key={item.id}>
                            <td className="py-2 text-gray-700">{item.product_name}</td>
                            <td className="py-2 text-center text-gray-500">{item.quantity}x</td>
                            {isOwner && (
                              <td className="py-2 text-right text-gray-400 text-xs">
                                {formatRupiah(item.cost_price ?? 0)}
                              </td>
                            )}
                            <td className="py-2 text-right text-gray-500">{formatRupiah(item.unit_price)}</td>
                            <td className="py-2 text-right font-medium text-gray-800">{formatRupiah(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t border-gray-200 pt-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-700">{formatRupiah(tx.subtotal)}</span>
                      </div>
                      {tx.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Diskon</span>
                          <span className="text-red-500">- {formatRupiah(tx.discount)}</span>
                        </div>
                      )}
                      {tx.tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Pajak</span>
                          <span className="text-orange-500">+ {formatRupiah(tx.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5">
                        <span className="text-gray-800">Total</span>
                        <span className="text-gray-900">{formatRupiah(tx.total)}</span>
                      </div>
                      {tx.payment_method === 'cash' && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Bayar</span>
                            <span className="text-gray-700">{formatRupiah(tx.amount_paid)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Kembalian</span>
                            <span className="text-green-600 font-medium">{formatRupiah(tx.change_amount)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-gray-500">Metode</span>
                        <span className="text-gray-700">{paymentLabel[tx.payment_method] ?? tx.payment_method}</span>
                      </div>

                      {/* Laba — hanya owner */}
                      {isOwner && (
                        <div className="border-t border-gray-200 pt-3 mt-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <TrendingUp size={14} className="text-green-500" />
                            <span className="text-xs font-semibold text-gray-500 uppercase">Analisis Laba</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Laba Kotor</span>
                            <span className={`font-medium ${labaKotor >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {formatRupiah(labaKotor)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Laba Bersih <span className="text-xs text-gray-400">(setelah diskon/pajak)</span></span>
                            <span className={`font-bold ${labaBersih >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {formatRupiah(labaBersih)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}