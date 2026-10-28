'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import { TrendingUp, Package, TrendingDown, Wallet, FileSpreadsheet, CalendarDays } from 'lucide-react'

type ViewType = 'weekly' | 'monthly15' | 'monthly30' | 'customMonth'

interface ReportDataPoint {
  label: string
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  profit: number
  transactions: number
}

interface ReportTransaction {
  id: string
  total: number
  created_at: string
  transaction_items: { cost_price: number | null; quantity: number }[] | null
}

interface ReportExpense {
  amount: number
  date: string
}

interface TopProduct {
  name: string
  qty: number
  revenue: number
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function ReportsPage() {
  const localizedLanguage = useLanguage().language

  const supabase = createClient()
  const { formatCurrency, currency } = useCurrency()
  const monthInputRef = useRef<HTMLInputElement>(null)
  const [weeklyData, setWeeklyData] = useState<ReportDataPoint[]>([])
  const [monthly15Data, setMonthly15Data] = useState<ReportDataPoint[]>([])
  const [monthly30Data, setMonthly30Data] = useState<ReportDataPoint[]>([])
  const [selectedMonthData, setSelectedMonthData] = useState<ReportDataPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [view, setView] = useState<ViewType>('customMonth')
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(new Date()))
  const [loading, setLoading] = useState(true)
  const [monthLoading, setMonthLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [monthError, setMonthError] = useState('')
  const [topProductsError, setTopProductsError] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Sesi login tidak ditemukan.')

        const now = new Date()
        const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
        const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const startDate = toDateKey(startDay)
        const endDate = toDateKey(endDay)

        const [
          { data: transactions, error: transactionsError },
          { data: expenses, error: expensesError },
          { data: top, error: topError },
        ] = await Promise.all([
          supabase.from('transactions')
            .select('id, total, created_at, transaction_items(cost_price, quantity)')
            .eq('user_id', user.id)
            .gte('created_at', startDay.toISOString())
            .lt('created_at', endDay.toISOString()),
          supabase.from('expenses')
            .select('amount, date')
            .eq('user_id', user.id)
            .gte('date', startDate)
            .lt('date', endDate),
          supabase.rpc('get_top_selling_products'),
        ])

        if (transactionsError) throw transactionsError
        if (expensesError) throw expensesError
        const transactionRows: ReportTransaction[] = transactions ?? []
        const expenseRows: ReportExpense[] = expenses ?? []
        const dailyTotals = new Map<string, Omit<ReportDataPoint, 'label' | 'grossProfit' | 'profit'>>()
        const getTotals = (
          totals: Map<string, Omit<ReportDataPoint, 'label' | 'grossProfit' | 'profit'>>,
          key: string,
        ) => {
          let value = totals.get(key)
          if (!value) {
            value = { revenue: 0, cogs: 0, expenses: 0, transactions: 0 }
            totals.set(key, value)
          }
          return value
        }

        for (const transaction of transactionRows) {
          const transactionDate = new Date(transaction.created_at)
          const cogs = transaction.transaction_items?.reduce(
            (total, item) => total + (item.cost_price ?? 0) * item.quantity,
            0,
          ) ?? 0
          const dayTotals = getTotals(dailyTotals, toDateKey(transactionDate))
          dayTotals.revenue += transaction.total
          dayTotals.cogs += cogs
          dayTotals.transactions += 1
        }

        for (const expense of expenseRows) {
          getTotals(dailyTotals, expense.date).expenses += expense.amount
        }

        const days = Array.from({ length: 30 }, (_, index) => {
          const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29 + index)
          const totals = getTotals(dailyTotals, toDateKey(day))
          const grossProfit = totals.revenue - totals.cogs
          return {
            label: day.toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short' }),
            ...totals,
            grossProfit,
            profit: grossProfit - totals.expenses,
          }
        })

        if (cancelled) return
        setWeeklyData(days.slice(-7))
        setMonthly15Data(days.slice(-15))
        setMonthly30Data(days)
        if (topError) {
          setTopProductsError(topError.message)
        } else {
          setTopProducts((top ?? []) as TopProduct[])
        }
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : translateText('Terjadi kesalahan saat memuat laporan.', localizedLanguage))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [localizedLanguage, supabase])

  useEffect(() => {
    if (view !== 'customMonth') return

    let cancelled = false

    const loadSelectedMonth = async () => {
      setMonthLoading(true)
      setMonthError('')
      setSelectedMonthData([])

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Sesi login tidak ditemukan.')

        const [year, month] = selectedMonth.split('-').map(Number)
        const startMonth = new Date(year, month - 1, 1)
        const endMonth = new Date(year, month, 1)
        const [
          { data: transactions, error: transactionsError },
          { data: expenses, error: expensesError },
        ] = await Promise.all([
          supabase.from('transactions')
            .select('id, total, created_at, transaction_items(cost_price, quantity)')
            .eq('user_id', user.id)
            .gte('created_at', startMonth.toISOString())
            .lt('created_at', endMonth.toISOString()),
          supabase.from('expenses')
            .select('amount, date')
            .eq('user_id', user.id)
            .gte('date', toDateKey(startMonth))
            .lt('date', toDateKey(endMonth)),
        ])

        if (transactionsError) throw transactionsError
        if (expensesError) throw expensesError

        const dailyTotals = new Map<string, {
          revenue: number
          cogs: number
          expenses: number
          transactions: number
        }>()
        const getDayTotals = (key: string) => {
          let totals = dailyTotals.get(key)
          if (!totals) {
            totals = { revenue: 0, cogs: 0, expenses: 0, transactions: 0 }
            dailyTotals.set(key, totals)
          }
          return totals
        }

        for (const transaction of (transactions ?? []) as ReportTransaction[]) {
          const date = toDateKey(new Date(transaction.created_at))
          const totals = getDayTotals(date)
          totals.revenue += transaction.total
          totals.cogs += transaction.transaction_items?.reduce(
            (sum, item) => sum + (item.cost_price ?? 0) * item.quantity,
            0,
          ) ?? 0
          totals.transactions += 1
        }

        for (const expense of (expenses ?? []) as ReportExpense[]) {
          getDayTotals(expense.date).expenses += expense.amount
        }

        const daysInMonth = new Date(year, month, 0).getDate()
        const days = Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(year, month - 1, index + 1)
          const totals = dailyTotals.get(toDateKey(date)) ?? {
            revenue: 0,
            cogs: 0,
            expenses: 0,
            transactions: 0,
          }
          const grossProfit = totals.revenue - totals.cogs
          return {
            label: date.toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short' }),
            ...totals,
            grossProfit,
            profit: grossProfit - totals.expenses,
          }
        })

        if (!cancelled) setSelectedMonthData(days)
      } catch (error) {
        if (!cancelled) {
          setMonthError(error instanceof Error ? error.message : translateText('Terjadi kesalahan saat memuat laporan bulanan.', localizedLanguage))
        }
      } finally {
        if (!cancelled) setMonthLoading(false)
      }
    }

    loadSelectedMonth()
    return () => { cancelled = true }
  }, [localizedLanguage, selectedMonth, supabase, view])

  const chartData =
    view === 'weekly' ? weeklyData :
    view === 'monthly15' ? monthly15Data :
    view === 'monthly30' ? monthly30Data :
    selectedMonthData

  const selectedMonthLabel = new Date(
    Number(selectedMonth.slice(0, 4)),
    Number(selectedMonth.slice(5, 7)) - 1,
    1,
  ).toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID', { month: 'long', year: 'numeric' })
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0)
  const totalCogs = chartData.reduce((s, d) => s + d.cogs, 0)
  const totalGrossProfit = chartData.reduce((s, d) => s + d.grossProfit, 0)
  const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0)
  const totalProfit = chartData.reduce((s, d) => s + d.profit, 0)
  const tabs: { key: ViewType; label: string }[] = [
    { key: 'weekly', label: '7 Hari' },
    { key: 'monthly15', label: '15 Hari' },
    { key: 'monthly30', label: '30 Hari' },
  ]

  const exportExcel = () => {
    try {
      const selectedPeriod = view === 'customMonth'
        ? selectedMonthLabel
        : translateText(tabs.find(tab => tab.key === view)?.label ?? view, localizedLanguage)
      const periodFilename = view === 'customMonth' ? selectedMonth : view
      const workbook = XLSX.utils.book_new()
      const summarySheet = XLSX.utils.json_to_sheet([
        { [translateText('Informasi', localizedLanguage)]: translateText('Periode', localizedLanguage), [translateText('Nilai', localizedLanguage)]: selectedPeriod },
        { [translateText('Informasi', localizedLanguage)]: translateText('Mata Uang', localizedLanguage), [translateText('Nilai', localizedLanguage)]: currency },
        { [translateText('Informasi', localizedLanguage)]: translateText('Tanggal Ekspor', localizedLanguage), [translateText('Nilai', localizedLanguage)]: new Date().toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID') },
        { [translateText('Informasi', localizedLanguage)]: translateText('Pendapatan', localizedLanguage), [translateText('Nilai', localizedLanguage)]: totalRevenue },
        { [translateText('Informasi', localizedLanguage)]: translateText('HPP', localizedLanguage), [translateText('Nilai', localizedLanguage)]: totalCogs },
        { [translateText('Informasi', localizedLanguage)]: translateText('Laba Kotor', localizedLanguage), [translateText('Nilai', localizedLanguage)]: totalGrossProfit },
        { [translateText('Informasi', localizedLanguage)]: translateText('Pengeluaran', localizedLanguage), [translateText('Nilai', localizedLanguage)]: totalExpenses },
        { [translateText('Informasi', localizedLanguage)]: translateText('Laba Bersih', localizedLanguage), [translateText('Nilai', localizedLanguage)]: totalProfit },
        { [translateText('Informasi', localizedLanguage)]: translateText('Jumlah Transaksi', localizedLanguage), [translateText('Nilai', localizedLanguage)]: chartData.reduce((sum, item) => sum + item.transactions, 0) },
      ])
      summarySheet['!cols'] = [{ wch: 24 }, { wch: 24 }]
      XLSX.utils.book_append_sheet(workbook, summarySheet, translateText('Ringkasan', localizedLanguage))

      const detailsSheet = XLSX.utils.json_to_sheet(chartData.map(item => ({
        [translateText('Periode', localizedLanguage)]: item.label,
        [translateText('Pendapatan', localizedLanguage)]: item.revenue,
        [translateText('HPP', localizedLanguage)]: item.cogs,
        [translateText('Laba Kotor', localizedLanguage)]: item.grossProfit,
        [translateText('Pengeluaran', localizedLanguage)]: item.expenses,
        [translateText('Laba Bersih', localizedLanguage)]: item.profit,
        [translateText('Transaksi', localizedLanguage)]: item.transactions,
      })))
      detailsSheet['!cols'] = [
        { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 12 },
      ]
      XLSX.utils.book_append_sheet(workbook, detailsSheet, translateText('Rincian Periode', localizedLanguage))

      const productsSheet = XLSX.utils.json_to_sheet(topProducts.map((product, index) => ({
        [translateText('Peringkat', localizedLanguage)]: index + 1,
        [translateText('Produk', localizedLanguage)]: product.name,
        [translateText('Jumlah Terjual', localizedLanguage)]: product.qty,
        [translateText('Pendapatan', localizedLanguage)]: product.revenue,
      })))
      productsSheet['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(workbook, productsSheet, translateText('Produk Terlaris', localizedLanguage))

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      saveAs(
        new Blob([buffer], { type: 'application/octet-stream' }),
        `laporan-penjualan-${periodFilename}-${toDateKey(new Date())}.xlsx`,
      )
      setExportError('')
    } catch (error) {
      setExportError(error instanceof Error ? error.message : translateText('Terjadi kesalahan saat mengekspor laporan.', localizedLanguage))
    }
  }

  const isMultiDay = view === 'monthly15' || view === 'monthly30' || view === 'customMonth'

  if (loading || (view === 'customMonth' && monthLoading)) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        {<LocalizedText text={"\r\n        Memuat laporan...\r\n      "} />}</div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Laporan Penjualan"} />}</h1>
        <button
          type="button"
          onClick={exportExcel}
          disabled={!!loadError}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet size={16} />
          {<LocalizedText text={"\r\n          Export ke Excel\r\n        "} />}</button>
      </div>
      {loadError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {<LocalizedText text={"\r\n          Gagal memuat laporan: "} />}{loadError}
        </p>
      )}
      {exportError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {<LocalizedText text={"\r\n          Gagal mengekspor laporan: "} />}{exportError}
        </p>
      )}

      {/* Toggle */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setView('customMonth')
            const input = monthInputRef.current
            if (!input) return
            if (typeof input.showPicker === 'function') input.showPicker()
            else input.click()
          }}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            view === 'customMonth'
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CalendarDays size={16} />
          {<LocalizedText text={"\r\n          Pilih Bulan: "} />}{selectedMonthLabel}
        </button>
        <input
          ref={monthInputRef}
          type="month"
          aria-label={translateText("Pilih bulan laporan", localizedLanguage)}
          value={selectedMonth}
          max={toMonthKey(new Date())}
          onChange={event => {
            setSelectedMonth(event.target.value)
            setView('customMonth')
          }}
          className="sr-only"
        />
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === key
                ? "bg-indigo-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'customMonth' && monthError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {<LocalizedText text={"\r\n          Gagal memuat laporan bulanan: "} />}{monthError}
        </p>
      )}

      {/* Ringkasan periode */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-indigo-500" />
            <p className="text-xs text-gray-500">{<LocalizedText text={"Pendapatan"} />}</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-orange-500" />
            <p className="text-xs text-gray-500">{<LocalizedText text={"HPP"} />}</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalCogs)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-amber-500" />
            <p className="text-xs text-gray-500">{<LocalizedText text={"Laba Kotor"} />}</p>
          </div>
          <p className={`text-lg font-bold ${totalGrossProfit >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
            {formatCurrency(totalGrossProfit)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-500" />
            <p className="text-xs text-gray-500">{<LocalizedText text={"Pengeluaran"} />}</p>
          </div>
          <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-green-500" />
            <p className="text-xs text-gray-500">{<LocalizedText text={"Laba Bersih"} />}</p>
          </div>
          <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatCurrency(totalProfit)}
          </p>
        </div>
      </div>

      {/* Grafik Pendapatan / Pengeluaran */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Pendapatan / Pengeluaran"} />}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={isMultiDay ? 17 : 24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMultiDay ? 9 : 11, fill: '#9ca3af' }}
              interval={view === 'monthly30' || view === 'customMonth' ? 4 : view === 'monthly15' ? 2 : 0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${Number(v) / 1000}k`} />
            <Tooltip
              formatter={(v, name) => [
              formatCurrency(Number(v)),
              translateText(name === 'revenue' ? 'Pendapatan' : name === 'expenses' ? 'Pengeluaran' : 'Laba', localizedLanguage)
              ]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
            />
            <Legend formatter={(v) => translateText(v === 'revenue' ? 'Pendapatan' : v === 'expenses' ? 'Pengeluaran' : 'Laba', localizedLanguage)} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grafik Laba Kotor (Pendapatan / HPP) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Laba Kotor (Pendapatan / HPP)"} />}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={isMultiDay ? 17 : 24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMultiDay ? 9 : 11, fill: '#9ca3af' }}
              interval={view === 'monthly30' || view === 'customMonth' ? 4 : view === 'monthly15' ? 2 : 0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${Number(v) / 1000}k`} />
            <Tooltip
              formatter={(v, name) => [
              formatCurrency(Number(v)),
              translateText(name === 'revenue' ? 'Pendapatan' : name === 'cogs' ? 'HPP' : 'Laba Kotor', localizedLanguage)
              ]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
            />
            <Legend formatter={(v) => translateText(v === 'revenue' ? 'Pendapatan' : v === 'cogs' ? 'HPP' : 'Laba Kotor', localizedLanguage)} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cogs" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="grossProfit" fill="#eab308" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grafik Laba Bersih */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Grafik Laba Bersih"} />}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMultiDay ? 9 : 11, fill: '#9ca3af' }}
              interval={view === 'monthly30' || view === 'customMonth' ? 4 : view === 'monthly15' ? 2 : 0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${Number(v) / 1000}k`} />
            <Tooltip
              formatter={v => [formatCurrency(Number(v)), translateText('Laba Bersih', localizedLanguage)]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={{ r: isMultiDay ? 2 : 4, fill: '#22c55e' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Grafik Transaksi */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Jumlah Transaksi"} />}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMultiDay ? 9 : 11, fill: '#9ca3af' }}
              interval={view === 'monthly30' || view === 'customMonth' ? 4 : view === 'monthly15' ? 2 : 0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
            <Tooltip
              formatter={v => [v, translateText('Transaksi', localizedLanguage)]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Line type="monotone" dataKey="transactions" stroke="#3b82f6" strokeWidth={2} dot={{ r: isMultiDay ? 2 : 4, fill: '#3b82f6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Produk */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-purple-500" />
          <h2 className="font-semibold text-gray-800">{<LocalizedText text={"Produk Terlaris"} />}</h2>
        </div>
        {topProductsError ? (
          <p role="alert" className="text-sm text-red-500 text-center py-6">
            {<LocalizedText text={"\r\n            Gagal memuat produk terlaris: "} />}{topProductsError}
          </p>
        ) : topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{<LocalizedText text={"Belum ada data"} />}</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => {
              const maxQty = topProducts[0]?.qty ?? 1
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      <span className="text-gray-400 mr-2">{<LocalizedText text={"#"} />}{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="text-gray-500">{p.qty}{<LocalizedText text={"x · "} />}{formatCurrency(p.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(p.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}