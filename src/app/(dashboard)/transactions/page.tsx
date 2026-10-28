'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import { Receipt, Search, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, TrendingUp, Trash2 } from 'lucide-react'

const PAGE_SIZE = 20

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
  payment_account: string | null
  amount_paid: number
  change_amount: number
  notes: string | null
  status: string
  table_number: number | null
  created_at: string
  transaction_items?: TransactionItem[]
}

interface TransactionScope {
  userId: string
  isStaff: boolean
}

export default function TransactionsPage() {
  const localizedLanguage = useLanguage().language

  const supabase = useMemo(() => createClient(), [])
  const { formatCurrency } = useCurrency()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const now = useMemo(() => new Date(), [])
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [scope, setScope] = useState<TransactionScope | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([now.getFullYear()])
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [todayTotal, setTodayTotal] = useState(0)
  const [todayLabaBersih, setTodayLabaBersih] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        if (active) {
          setError(userError?.message ?? 'Sesi login tidak ditemukan. Silakan login kembali.')
          setLoading(false)
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        if (active) {
          setError(profileError.message)
          setLoading(false)
        }
        return
      }

      const isStaff = profile.role === 'staff'
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)

      let oldestQuery = supabase
        .from('transactions')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)

      let todayQuery = supabase
        .from('transactions')
        .select('total, subtotal, transaction_items(cost_price, quantity)')
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString())

      if (isStaff) {
        oldestQuery = oldestQuery.eq('created_by', user.id)
        todayQuery = todayQuery.eq('created_by', user.id)
      } else {
        oldestQuery = oldestQuery.eq('user_id', user.id)
        todayQuery = todayQuery.eq('user_id', user.id)
      }

      const [{ data: oldestTransaction, error: oldestError }, { data: todayTransactions, error: todayError }] =
        await Promise.all([oldestQuery.maybeSingle(), todayQuery])

      if (oldestError || todayError) {
        if (active) {
          setError(oldestError?.message ?? todayError?.message ?? 'Gagal memuat ringkasan transaksi.')
          setLoading(false)
        }
        return
      }

      if (!active) return

      const oldestYear = oldestTransaction
        ? new Date(oldestTransaction.created_at).getFullYear()
        : now.getFullYear()
      setAvailableYears(Array.from(
        { length: Math.max(1, now.getFullYear() - oldestYear + 1) },
        (_, index) => now.getFullYear() - index,
      ))
      setIsOwner(!isStaff)
      setScope({ userId: user.id, isStaff })

      const dailyTotal = todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0)
      const dailyProfit = todayTransactions.reduce((sum, transaction) => {
        const totalModal = transaction.transaction_items.reduce(
          (itemSum, item) => itemSum + (item.cost_price ?? 0) * item.quantity,
          0,
        )
        return sum + transaction.total - totalModal
      }, 0)
      setTodayTotal(dailyTotal)
      setTodayLabaBersih(dailyProfit)
    }

    void initialize()
    return () => { active = false }
  }, [now, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!scope) return

    let active = true

    const load = async () => {
      setLoading(true)
      setError('')
      const monthStart = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1)
      const monthEnd = new Date(Number(selectedYear), Number(selectedMonth), 1)
      let query = supabase
        .from('transactions')
        .select('*, transaction_items(*)', { count: 'exact' })
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (scope.isStaff) {
        query = query.eq('created_by', scope.userId)
      } else {
        query = query.eq('user_id', scope.userId)
      }

      if (debouncedSearch) {
        query = query.ilike('invoice_number', `%${debouncedSearch}%`)
      }

      const { data, error: queryError, count } = await query
      if (!active) return

      if (queryError) {
        setError(queryError.message)
        setTransactions([])
        setTotalCount(0)
      } else {
        setTransactions(data ?? [])
        setTotalCount(count ?? 0)
      }
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [scope, selectedMonth, selectedYear, debouncedSearch, page, supabase])

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!confirm(`${translateText("Hapus invoice ", localizedLanguage)}${invoiceNumber}${translateText("? Aksi ini tidak bisa dibatalkan.", localizedLanguage)}`)) return

    const { error: itemsError } = await supabase.from('transaction_items').delete().eq('transaction_id', id)
    if (itemsError) {
      setError(itemsError.message)
      return
    }

    const { error: transactionError } = await supabase.from('transactions').delete().eq('id', id)
    if (transactionError) {
      setError(transactionError.message)
      return
    }

    setTransactions(prev => prev.filter(t => t.id !== id))
    setTotalCount(prev => Math.max(0, prev - 1))
    if (transactions.length === 1 && page > 0) setPage(prev => prev - 1)
  }

  const recentMonths = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(2000, index, 1)
    const value = String(index + 1).padStart(2, '0')
    const label = new Intl.DateTimeFormat(localizedLanguage === 'en' ? 'en-US' : 'id-ID', { month: 'long' }).format(date)
    return { value, label }
  })

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const paymentLabel: Record<string, string> = {
    cash: `💵 ${translateText('Tunai', localizedLanguage)}`,
    transfer: '🏦 Transfer',
    ewallet: '📱 E-Wallet',
    qris: '📲 QRIS',
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev === id ? null : id)

  const calcProfit = (tx: Transaction) => {
    const items = tx.transaction_items ?? []
    const totalModal = items.reduce((s, i) => s + (i.cost_price ?? 0) * i.quantity, 0)
    const labaKotor = tx.subtotal - totalModal
    const labaBersih = tx.total - totalModal
    return { totalModal, labaKotor, labaBersih }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Riwayat Transaksi"} />}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length} {<LocalizedText text={" ditampilkan dari "} />}{totalCount} {<LocalizedText text={" transaksi\r\n          "} />}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{<LocalizedText text={"Pendapatan Hari Ini"} />}</p>
          <p className="text-lg font-bold text-indigo-600">{formatCurrency(todayTotal)}</p>
          {isOwner && (
            <p className="text-xs text-green-500 mt-0.5">{<LocalizedText text={"Laba bersih: "} />}{formatCurrency(todayLabaBersih)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder={translateText("Cari nomor invoice...", localizedLanguage)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
          />
        </div>
        <div className="flex gap-2">
          <label className="flex items-center px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm text-gray-500">
            <select
              value={selectedMonth}
              onChange={e => {
                setSelectedMonth(e.target.value)
                setPage(0)
              }}
              aria-label={translateText("Filter bulan transaksi", localizedLanguage)}
              className="min-w-0 bg-transparent text-gray-900 focus:outline-none"
            >
              {recentMonths.map(month => (
                <option key={month.value} value={month.value}><LocalizedText text={month.label} /></option>
              ))}
            </select>
          </label>
          <label className="flex items-center px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm text-gray-500">
            <select
              value={selectedYear}
              onChange={e => {
                setSelectedYear(e.target.value)
                setPage(0)
              }}
              aria-label={translateText("Filter tahun transaksi", localizedLanguage)}
              className="min-w-0 bg-transparent text-gray-900 focus:outline-none"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">{<LocalizedText text={"Memuat transaksi..."} />}</div>
      ) : error ? (
        <div role="alert" className="text-center py-16 text-red-500 text-sm">
          {<LocalizedText text={"\r\n          Gagal memuat transaksi: "} />}<LocalizedText text={error} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <Receipt size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {debouncedSearch
              ? <LocalizedText text={"Transaksi tidak ditemukan"} />
              : <LocalizedText text={"Tidak ada transaksi pada bulan yang dipilih"} />}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(tx => {
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{tx.invoice_number}</p>
                        {tx.table_number != null && (
                          <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                            {<LocalizedText text={"\r\n                            Meja "} />}{tx.table_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.created_at)}</p>
                    </div>
                    <div className="hidden sm:block text-xs text-gray-500">
                      {paymentLabel[tx.payment_method] ?? tx.payment_method}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(tx.total)}</p>
                      {isOwner && (
                        <p className="text-xs text-green-500 mt-0.5">{<LocalizedText text={"+"} />}{formatCurrency(labaBersih)}</p>
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
                          <th className="text-left pb-2 font-medium">{<LocalizedText text={"Produk"} />}</th>
                          <th className="text-center pb-2 font-medium">{<LocalizedText text={"Qty"} />}</th>
                          {isOwner && <th className="text-right pb-2 font-medium">{<LocalizedText text={"Modal"} />}</th>}
                          <th className="text-right pb-2 font-medium">{<LocalizedText text={"Harga"} />}</th>
                          <th className="text-right pb-2 font-medium">{<LocalizedText text={"Subtotal"} />}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tx.transaction_items?.map(item => (
                          <tr key={item.id}>
                            <td className="py-2 text-gray-700">{item.product_name}</td>
                            <td className="py-2 text-center text-gray-500">{item.quantity}{<LocalizedText text={"x"} />}</td>
                            {isOwner && (
                              <td className="py-2 text-right text-gray-400 text-xs">
                                {formatCurrency(item.cost_price ?? 0)}
                              </td>
                            )}
                            <td className="py-2 text-right text-gray-500">{formatCurrency(item.unit_price)}</td>
                            <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t border-gray-200 pt-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{<LocalizedText text={"Subtotal"} />}</span>
                        <span className="text-gray-700">{formatCurrency(tx.subtotal)}</span>
                      </div>
                      {tx.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{<LocalizedText text={"Diskon"} />}</span>
                          <span className="text-red-500">{<LocalizedText text={"- "} />}{formatCurrency(tx.discount)}</span>
                        </div>
                      )}
                      {tx.tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{<LocalizedText text={"Pajak"} />}</span>
                          <span className="text-orange-500">{<LocalizedText text={"+ "} />}{formatCurrency(tx.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5">
                        <span className="text-gray-800">{<LocalizedText text={"Total"} />}</span>
                        <span className="text-gray-900">{formatCurrency(tx.total)}</span>
                      </div>
                      {tx.payment_method === 'cash' && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{<LocalizedText text={"Jumlah Dibayar"} />}</span>
                            <span className="text-gray-700">{formatCurrency(tx.amount_paid)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{<LocalizedText text={"Kembalian"} />}</span>
                            <span className="text-green-600 font-medium">{formatCurrency(tx.change_amount)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-gray-500">{<LocalizedText text={"Metode"} />}</span>
                        <span className="text-gray-700">{paymentLabel[tx.payment_method] ?? tx.payment_method}</span>
                      </div>
                      {tx.payment_method === 'transfer' && tx.payment_account && (
                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-gray-500">{<LocalizedText text={"Rekening"} />}</span>
                          <span className="text-gray-700 text-right">{tx.payment_account}</span>
                        </div>
                      )}

                      {/* Laba — hanya owner */}
                      {isOwner && (
                        <div className="border-t border-gray-200 pt-3 mt-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <TrendingUp size={14} className="text-green-500" />
                            <span className="text-xs font-semibold text-gray-500 uppercase">{<LocalizedText text={"Analisis Laba"} />}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{<LocalizedText text={"Laba Kotor"} />}</span>
                            <span className={`font-medium ${labaKotor >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {formatCurrency(labaKotor)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{<LocalizedText text={"Laba Bersih "} />}<span className="text-xs text-gray-400">{<LocalizedText text={"(setelah diskon/pajak)"} />}</span></span>
                            <span className={`font-bold ${labaBersih >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {formatCurrency(labaBersih)}
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

      {!loading && !error && totalCount > PAGE_SIZE && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {<LocalizedText text={"\r\n            Halaman "} />}{page + 1} {<LocalizedText text={" dari "} />}{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(0, current - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              {<LocalizedText text={"\r\n              Sebelumnya\r\n            "} />}</button>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {<LocalizedText text={"\r\n              Berikutnya\r\n              "} />}<ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}