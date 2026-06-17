'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts'
import { TrendingUp, ShoppingCart, Package } from 'lucide-react'

type ViewType = 'weekly' | 'monthly15' | 'monthly30' | 'monthly6'

export default function ReportsPage() {
  const supabase = createClient()
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [monthly15Data, setMonthly15Data] = useState<any[]>([])
  const [monthly30Data, setMonthly30Data] = useState<any[]>([])
  const [monthly6Data, setMonthly6Data] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [view, setView] = useState<ViewType>('weekly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fetchDays = async (numDays: number) => {
        const days = Array.from({ length: numDays }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (numDays - 1 - i))
          return d
        })
        return Promise.all(days.map(async (day) => {
          const start = new Date(day); start.setHours(0, 0, 0, 0)
          const end = new Date(day); end.setHours(23, 59, 59, 999)
          const { data } = await supabase
            .from('transactions')
            .select('total')
            .eq('user_id', user.id)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
          return {
            label: day.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            revenue: data?.reduce((s, t) => s + t.total, 0) ?? 0,
            transactions: data?.length ?? 0,
          }
        }))
      }

      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (5 - i))
        return d
      })

      const monthly6Result = await Promise.all(months.map(async (month) => {
        const start = new Date(month.getFullYear(), month.getMonth(), 1)
        const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59)
        const { data } = await supabase
          .from('transactions')
          .select('total')
          .eq('user_id', user.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
        return {
          label: month.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
          revenue: data?.reduce((s, t) => s + t.total, 0) ?? 0,
          transactions: data?.length ?? 0,
        }
      }))

      const { data: items } = await supabase
        .from('transaction_items')
        .select('product_name, quantity, subtotal')

      const productMap: Record<string, { qty: number; revenue: number }> = {}
      items?.forEach(item => {
        if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 }
        productMap[item.product_name].qty += item.quantity
        productMap[item.product_name].revenue += item.subtotal
      })

      const top = Object.entries(productMap)
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8)

      const [w, d15, d30] = await Promise.all([
        fetchDays(7),
        fetchDays(15),
        fetchDays(30),
      ])

      setWeeklyData(w)
      setMonthly15Data(d15)
      setMonthly30Data(d30)
      setMonthly6Data(monthly6Result)
      setTopProducts(top)
      setLoading(false)
    }
    load()
  }, [])

  const chartData =
    view === 'weekly' ? weeklyData :
    view === 'monthly15' ? monthly15Data :
    view === 'monthly30' ? monthly30Data :
    monthly6Data

  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0)
  const totalTransactions = chartData.reduce((s, d) => s + d.transactions, 0)

  const tabs: { key: ViewType; label: string }[] = [
    { key: 'weekly', label: '7 Hari' },
    { key: 'monthly15', label: '15 Hari' },
    { key: 'monthly30', label: '30 Hari' },
    { key: 'monthly6', label: '6 Bulan' },
  ]

  const isMultiDay = view === 'monthly15' || view === 'monthly30'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Memuat laporan...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Laporan Penjualan</h1>

      {/* Toggle */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-indigo-500" />
            <p className="text-xs text-gray-500">Total Pendapatan</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatRupiah(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={16} className="text-blue-500" />
            <p className="text-xs text-gray-500">Total Transaksi</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalTransactions}</p>
        </div>
      </div>

      {/* Grafik Pendapatan */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Grafik Pendapatan</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={isMultiDay ? 23 : 30}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMultiDay ? 9 : 11, fill: '#9ca3af' }}
              interval={view === 'monthly30' ? 4 : view === 'monthly15' ? 2 : 0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(v: any) => `${Number(v) / 1000}k`}
            />
            <Tooltip
              formatter={(v: any) => [formatRupiah(Number(v)), 'Pendapatan']}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grafik Transaksi */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Jumlah Transaksi</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMultiDay ? 9 : 11, fill: '#9ca3af' }}
              interval={view === 'monthly30' ? 4 : view === 'monthly15' ? 2 : 0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
            <Tooltip
              formatter={(v: any) => [v, 'Transaksi']}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="transactions"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: isMultiDay ? 2 : 4, fill: '#22c55e' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Produk */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-purple-500" />
          <h2 className="font-semibold text-gray-800">Produk Terlaris</h2>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Belum ada data</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => {
              const maxQty = topProducts[0]?.qty ?? 1
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      <span className="text-gray-400 mr-2">#{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="text-gray-500">{p.qty}x · {formatRupiah(p.revenue)}</span>
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