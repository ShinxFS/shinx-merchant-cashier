'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Banknote,
  ArrowUpRight,
  TrendingDown,
  WalletCards,
  CircleDollarSign,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react'

type CashflowPeriod = 'today' | '7days' | 'month'

interface Stats {
  todayRevenue: number
  todayTransactions: number
  totalProducts: number
  monthRevenue: number
  yesterdayRevenue: number
  previousMonthRevenue: number
}

interface RecentTransaction {
  id: string
  invoice_number: string
  total: number
  payment_method: string
  created_at: string
}

interface DashboardTransaction extends RecentTransaction {
  transaction_items: { cost_price: number | null; quantity: number }[] | null
}

interface DashboardExpense {
  amount: number
  date: string
}

interface CashflowStats {
  revenue: number
  expenses: number
  cogs: number
  netProfit: number
}

export default function DashboardPage() {
  const localizedLanguage = useLanguage().language

  const supabase = createClient()
  const { formatCurrency } = useCurrency()
  const [stats, setStats] = useState<Stats>({
    todayRevenue: 0,
    todayTransactions: 0,
    totalProducts: 0,
    monthRevenue: 0,
    yesterdayRevenue: 0,
    previousMonthRevenue: 0,
  })
  const [recent, setRecent] = useState<RecentTransaction[]>([])
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>('month')
  const [cashflow, setCashflow] = useState<CashflowStats>({ revenue: 0, expenses: 0, cogs: 0, netProfit: 0 })
  const [cashflowVisible, setCashflowVisible] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Sesi login tidak ditemukan.')

        const now = new Date()
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        const tomorrowStart = new Date(todayStart)
        tomorrowStart.setDate(tomorrowStart.getDate() + 1)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const previousMonthDay = Math.min(
          now.getDate(),
          new Date(now.getFullYear(), now.getMonth(), 0).getDate(),
        )
        const previousMonthComparableEnd = new Date(previousMonthStart)
        previousMonthComparableEnd.setDate(previousMonthDay + 1)

        const cashflowStart = new Date(now)
        if (cashflowPeriod === 'today') {
          cashflowStart.setHours(0, 0, 0, 0)
        } else if (cashflowPeriod === '7days') {
          cashflowStart.setDate(cashflowStart.getDate() - 6)
          cashflowStart.setHours(0, 0, 0, 0)
        } else {
          cashflowStart.setDate(1)
          cashflowStart.setHours(0, 0, 0, 0)
        }

        const cashflowEnd = new Date(now)
        if (cashflowPeriod === 'month') {
          cashflowEnd.setMonth(cashflowEnd.getMonth() + 1, 1)
        } else {
          cashflowEnd.setDate(cashflowEnd.getDate() + 1)
        }
        cashflowEnd.setHours(0, 0, 0, 0)

        const queryStart = new Date(Math.min(previousMonthStart.getTime(), cashflowStart.getTime()))
        const queryEnd = new Date(Math.max(nextMonthStart.getTime(), cashflowEnd.getTime()))
        const formatLocalDate = (date: Date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const fetchTransactions = async () => {
          const pageSize = 1000
          const rows: DashboardTransaction[] = []
          let from = 0

          while (true) {
            const { data, error } = await supabase.from('transactions')
              .select('id, invoice_number, total, payment_method, created_at, transaction_items(cost_price, quantity)')
              .eq('user_id', user.id)
              .gte('created_at', queryStart.toISOString())
              .lt('created_at', queryEnd.toISOString())
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(from, from + pageSize - 1)

            if (error) throw error
            rows.push(...(data ?? []))
            if (!data || data.length < pageSize) return rows
            from += pageSize
          }
        }

        const [
          { data: profile, error: profileError },
          transactions,
          { data: expenses, error: expensesError },
          { count: productCount, error: productsError },
        ] = await Promise.all([
          supabase.from('profiles')
            .select('business_name')
            .eq('id', user.id)
            .single(),
          fetchTransactions(),
          supabase.from('expenses')
            .select('amount, date')
            .eq('user_id', user.id)
            .gte('date', formatLocalDate(queryStart))
            .lt('date', formatLocalDate(queryEnd)),
          supabase.from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true),
        ])
        if (profileError) throw profileError
        if (profileError) throw profileError
        if (expensesError) throw expensesError
        if (productsError) throw productsError

        const transactionRows = transactions
        const expenseRows: DashboardExpense[] = expenses ?? []
        const inRangeTransactions = transactionRows.filter(transaction => {
          const createdAt = new Date(transaction.created_at).getTime()
          return createdAt >= cashflowStart.getTime() && createdAt < cashflowEnd.getTime()
        })
        const inRangeExpenses = expenseRows.filter(expense => (
          expense.date >= formatLocalDate(cashflowStart)
          && expense.date < formatLocalDate(cashflowEnd)
        ))

        const revenue = inRangeTransactions.reduce((sum, transaction) => sum + transaction.total, 0)
        const expensesTotal = inRangeExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        const cogs = inRangeTransactions.reduce((sum, transaction) => (
          sum + (transaction.transaction_items?.reduce(
            (itemTotal, item) => itemTotal + (item.cost_price ?? 0) * item.quantity,
            0,
          ) ?? 0)
        ), 0)
        const todayTransactions = transactionRows.filter(transaction => {
          const createdAt = new Date(transaction.created_at).getTime()
          return createdAt >= todayStart.getTime() && createdAt < tomorrowStart.getTime()
        })
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)
        const yesterdayRevenue = transactionRows.reduce((sum, transaction) => {
          const createdAt = new Date(transaction.created_at).getTime()
          return createdAt >= yesterdayStart.getTime()
            && createdAt < todayStart.getTime()
            ? sum + transaction.total
            : sum
        }, 0)
        const monthRevenue = transactionRows.reduce((sum, transaction) => {
          const createdAt = new Date(transaction.created_at).getTime()
          return createdAt >= monthStart.getTime() && createdAt < nextMonthStart.getTime()
            ? sum + transaction.total
            : sum
        }, 0)
        const previousMonthRevenue = transactionRows.reduce((sum, transaction) => {
          const createdAt = new Date(transaction.created_at).getTime()
          return createdAt >= previousMonthStart.getTime() && createdAt < previousMonthComparableEnd.getTime()
            ? sum + transaction.total
            : sum
        }, 0)

        if (cancelled) return
        setBusinessName(profile.business_name)
        setStats({
          todayRevenue: todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0),
          todayTransactions: todayTransactions.length,
          totalProducts: productCount ?? 0,
          monthRevenue,
          yesterdayRevenue,
          previousMonthRevenue,
        })
        setCashflow({ revenue, expenses: expensesTotal, cogs, netProfit: revenue - cogs - expensesTotal })
        setRecent(transactionRows.slice(0, 5))
        setLoadError('')
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : translateText("Terjadi kesalahan saat memuat dashboard.", localizedLanguage))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [cashflowPeriod, localizedLanguage, supabase])

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const statCards = [
    { label: 'Pendapatan Hari Ini', value: formatCurrency(stats.todayRevenue), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Transaksi Hari Ini', value: stats.todayTransactions, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Produk Aktif', value: stats.totalProducts, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pendapatan Bulan Ini', value: formatCurrency(stats.monthRevenue), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  const paymentMethodLabels: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    ewallet: 'E-Wallet',
    qris: 'QRIS',
    mixed: 'Split',
  }

  const cashflowCards = [
    { label: 'Pendapatan', value: cashflow.revenue, icon: Banknote, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pengeluaran', value: cashflow.expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'HPP', value: cashflow.cogs, icon: WalletCards, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Laba Bersih', value: cashflow.netProfit, icon: CircleDollarSign, color: cashflow.netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: cashflow.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">{<LocalizedText text={"Memuat data..."} />}</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Dashboard"} />}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {<LocalizedText text={"\r\n          Selamat datang kembali, "} />}<span className="font-medium text-gray-700">{businessName}</span>
        </p>
      </div>
      {loadError && (
        <p role="alert" className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {<LocalizedText text={"\r\n          Gagal memuat dashboard: "} />}{loadError}
        </p>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5"><LocalizedText text={label} /></p>
          </div>
        ))}
      </div>

      {/* Sales Comparison */}
      <section className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid sm:grid-cols-2">
          {([
            {
              label: 'Perbandingan Penjualan Harian',
              currentLabel: 'Hari ini',
              previousLabel: 'Kemarin',
              current: stats.todayRevenue,
              previous: stats.yesterdayRevenue,
            },
            {
              label: 'Perbandingan Penjualan Bulanan',
              currentLabel: 'Bulan ini',
              previousLabel: 'Bulan lalu',
              current: stats.monthRevenue,
              previous: stats.previousMonthRevenue,
            },
          ] as const).map(comparison => {
            const change = comparison.current - comparison.previous
            const percentChange = comparison.previous > 0
              ? (change / comparison.previous) * 100
              : null
            const positive = change > 0
            const negative = change < 0

            return (
              <div
                key={comparison.label}
                className="px-4 py-3 first:border-b first:border-gray-200 sm:first:border-b-0 sm:first:border-r sm:first:border-gray-200"
              >
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-medium text-gray-800">
                    <LocalizedText text={comparison.label} />
                  </h3>
                  <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                    positive ? 'bg-green-50 text-green-700' : negative ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {positive
                      ? <TrendingUp size={13} />
                      : negative
                        ? <TrendingDown size={13} />
                        : null}
                    {percentChange === null
                      ? comparison.current > 0
                        ? <LocalizedText text="Baru" />
                        : '0%'
                      : `${positive ? '+' : ''}${percentChange.toFixed(1)}%`}
                  </span>
                </div>
                <div className="grid grid-cols-2">
                  <div className="pr-3">
                    <p className="text-xs text-gray-500"><LocalizedText text={comparison.currentLabel} /> <span className="text-gray-300">·</span> <span className="font-semibold text-gray-900">{formatCurrency(comparison.current)}</span></p>
                  </div>
                  <div className="border-l border-gray-200 pl-3">
                    <p className="text-xs text-gray-500"><LocalizedText text={comparison.previousLabel} /> <span className="text-gray-300">·</span> <span className="font-semibold text-gray-900">{formatCurrency(comparison.previous)}</span></p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Cash Flow */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800 whitespace-nowrap">{<LocalizedText text={"Cash Inflow/Outflow"} />}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {<LocalizedText text={"\r\n              Ringkasan pendapatan, biaya, dan laba bersih\r\n            "} />}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${cashflowVisible ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0'}`}>
              <div className="relative inline-flex">
                <select
                  value={cashflowPeriod}
                  onChange={e => setCashflowPeriod(e.target.value as CashflowPeriod)}
                  tabIndex={cashflowVisible ? 0 : -1}
                  className="appearance-none px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label={translateText("Periode cash flow", localizedLanguage)}
                >
                  <option value="today">{<LocalizedText text={"Hari ini"} />}</option>
                  <option value="7days">{<LocalizedText text={"7 Hari"} />}</option>
                  <option value="month">{<LocalizedText text={"Bulan ini"} />}</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCashflowVisible(visible => !visible)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-expanded={cashflowVisible}
              aria-label={cashflowVisible ? translateText("Sembunyikan Cash Flow", localizedLanguage) : translateText("Tampilkan Cash Flow", localizedLanguage)}
              title={cashflowVisible ? translateText("Sembunyikan Cash Flow", localizedLanguage) : translateText("Tampilkan Cash Flow", localizedLanguage)}
            >
              <span className="transition-transform duration-500 ease-in-out">{cashflowVisible ? <EyeOff size={15} /> : <Eye size={15} />}</span>
              <span className="hidden sm:inline">{cashflowVisible ? <LocalizedText text={"Sembunyikan"} /> : <LocalizedText text={"Tampilkan"} />}</span>
            </button>
          </div>
        </div>
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${cashflowVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 translate-y-0 transition-transform duration-500 ease-in-out">
            {cashflowCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-xl border border-gray-200 p-4">
                <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon size={16} className={color} />
                </div>
                <p className={`text-lg font-bold ${label === 'Laba Bersih' && cashflow.netProfit < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {formatCurrency(value)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5"><LocalizedText text={label} /></p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaksi Terbaru */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{<LocalizedText text={"Transaksi Terbaru"} />}</h2>
          <a href="/transactions" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
            {<LocalizedText text={"\r\n            Lihat semua "} />}<ArrowUpRight size={12} />
          </a>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {<LocalizedText text={"\r\n            Belum ada transaksi hari ini\r\n          "} />}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(tx => (
              <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.invoice_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(tx.total)}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">
                    {translateText(paymentMethodLabels[tx.payment_method] ?? tx.payment_method, localizedLanguage)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}