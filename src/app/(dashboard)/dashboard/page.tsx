'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Banknote,
  ArrowUpRight,
  TrendingDown,
  WalletCards,
  CircleDollarSign,
} from 'lucide-react'

type CashflowPeriod = 'today' | '7days' | 'month'

interface Stats {
  todayRevenue: number
  todayTransactions: number
  totalProducts: number
  monthRevenue: number
}

interface RecentTransaction {
  id: string
  invoice_number: string
  total: number
  payment_method: string
  created_at: string
}

interface CashflowStats {
  revenue: number
  expenses: number
  cogs: number
  netProfit: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({
    todayRevenue: 0,
    todayTransactions: 0,
    totalProducts: 0,
    monthRevenue: 0,
  })
  const [recent, setRecent] = useState<RecentTransaction[]>([])
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(true)
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>('month')
  const [cashflow, setCashflow] = useState<CashflowStats>({ revenue: 0, expenses: 0, cogs: 0, netProfit: 0 })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', user.id)
        .single()
      if (profile) setBusinessName(profile.business_name)

      // Tanggal hari ini
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()

      // Bulan ini
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      // Transaksi hari ini
      const { data: todayTx } = await supabase
        .from('transactions')
        .select('total')
        .eq('user_id', user.id)
        .gte('created_at', todayStr)

      // Transaksi bulan ini
      const { data: monthTx } = await supabase
        .from('transactions')
        .select('total')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth)

      // Total produk
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)

      // Transaksi terbaru
      const { data: recentTx } = await supabase
        .from('transactions')
        .select('id, invoice_number, total, payment_method, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      const cashflowStart = new Date()
      if (cashflowPeriod === 'today') {
        cashflowStart.setHours(0, 0, 0, 0)
      } else if (cashflowPeriod === '7days') {
        cashflowStart.setDate(cashflowStart.getDate() - 6)
        cashflowStart.setHours(0, 0, 0, 0)
      } else {
        cashflowStart.setDate(1)
        cashflowStart.setHours(0, 0, 0, 0)
      }

      const [{ data: cashflowTx }, { data: cashflowExpenses }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, total')
          .eq('user_id', user.id)
          .gte('created_at', cashflowStart.toISOString()),
        supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', user.id)
          .gte('date', cashflowStart.toISOString().split('T')[0]),
      ])

      const transactionIds = cashflowTx?.map(transaction => transaction.id) ?? []
      const { data: cashflowItems } = transactionIds.length > 0
        ? await supabase
            .from('transaction_items')
            .select('cost_price, quantity')
            .in('transaction_id', transactionIds)
        : { data: [] }

      const revenue = cashflowTx?.reduce((sum, transaction) => sum + transaction.total, 0) ?? 0
      const expenses = cashflowExpenses?.reduce((sum, expense) => sum + expense.amount, 0) ?? 0
      const cogs = cashflowItems?.reduce((sum, item) => sum + (item.cost_price ?? 0) * item.quantity, 0) ?? 0
      setCashflow({ revenue, expenses, cogs, netProfit: revenue - cogs - expenses })

      setStats({
        todayRevenue: todayTx?.reduce((s, t) => s + t.total, 0) ?? 0,
        todayTransactions: todayTx?.length ?? 0,
        totalProducts: productCount ?? 0,
        monthRevenue: monthTx?.reduce((s, t) => s + t.total, 0) ?? 0,
      })
      setRecent(recentTx ?? [])
      setLoading(false)
    }
    load()
  }, [cashflowPeriod])

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const statCards = [
    { label: 'Pendapatan Hari Ini', value: formatRupiah(stats.todayRevenue), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Transaksi Hari Ini', value: stats.todayTransactions, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Produk Aktif', value: stats.totalProducts, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pendapatan Bulan Ini', value: formatRupiah(stats.monthRevenue), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  const cashflowCards = [
    { label: 'Pendapatan', value: cashflow.revenue, icon: Banknote, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pengeluaran', value: cashflow.expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'HPP', value: cashflow.cogs, icon: WalletCards, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Laba Bersih', value: cashflow.netProfit, icon: CircleDollarSign, color: cashflow.netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: cashflow.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Memuat data...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Selamat datang kembali, <span className="font-medium text-gray-700">{businessName}</span>
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Cash Flow */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800">Cash Flow</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ringkasan pendapatan, biaya, dan laba bersih</p>
          </div>
          <select
            value={cashflowPeriod}
            onChange={e => setCashflowPeriod(e.target.value as CashflowPeriod)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Periode arus kas"
          >
            <option value="today">Hari ini</option>
            <option value="7days">7 Hari</option>
            <option value="month">Bulan ini</option>
          </select>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5">
          {cashflowCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-gray-200 p-4">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
              </div>
              <p className={`text-lg font-bold ${label === 'Laba Bersih' && cashflow.netProfit < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatRupiah(value)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transaksi Terbaru */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Transaksi Terbaru</h2>
          <a href="/transactions" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
            Lihat semua <ArrowUpRight size={12} />
          </a>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            Belum ada transaksi hari ini
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(tx => (
              <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.invoice_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatRupiah(tx.total)}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{tx.payment_method}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}