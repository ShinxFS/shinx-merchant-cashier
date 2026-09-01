'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Bell, CheckCheck, Clock3, CircleDashed, PackageCheck, Search, Trash2 } from 'lucide-react'

interface TableOrderItem {
  id: string
  name: string
  quantity: number
  price: number
  subtotal: number
}

interface TableOrder {
  id: string
  user_id?: string
  table_number: number
  customer_name: string
  total: number
  status: 'pending' | 'processing' | 'ready' | 'done'
  items: TableOrderItem[]
  note?: string | null
  created_at: string
}

export default function TableOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data } = await supabase
        .from('table_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setOrders((data as TableOrder[]) ?? [])
      setLoading(false)
    }

    load()

    const channel = supabase.channel('table-order-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'table_orders' },
        payload => {
          const newOrder = payload.new as TableOrder
          if (newOrder.user_id !== userId) return
          setOrders(prev => [newOrder, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'table_orders' },
        payload => {
          const updated = payload.new as TableOrder
          setOrders(prev => prev.map(order => order.id === updated.id ? updated : order))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'table_orders' },
        payload => {
          const deleted = payload.old as TableOrder
          setOrders(prev => prev.filter(order => order.id !== deleted.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return orders

    return orders.filter(order =>
      String(order.table_number).includes(q) ||
      order.customer_name.toLowerCase().includes(q) ||
      order.items.some(item => item.name.toLowerCase().includes(q))
    )
  }, [orders, search])

  const statusMeta: Record<TableOrder['status'], { label: string; className: string; icon: any }> = {
    pending: { label: 'Menunggu', className: 'bg-amber-100 text-amber-700 border border-amber-200', icon: Clock3 },
    processing: { label: 'Diproses', className: 'bg-blue-100 text-blue-700 border border-blue-200', icon: CircleDashed },
    ready: { label: 'Siap', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: PackageCheck },
    done: { label: 'Selesai', className: 'bg-slate-200 text-slate-700 border border-slate-300', icon: CheckCheck },
  }

  const updateStatus = async (id: string, status: TableOrder['status']) => {
    await supabase.from('table_orders').update({ status }).eq('id', id)
  }

  const deleteOrder = async (id: string) => {
    if (!confirm('Hapus order meja ini?')) return
    await supabase.from('table_orders').delete().eq('id', id)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order Meja</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} pesanan aktif</p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari meja / menu / pelanggan"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-16">Memuat daftar order meja...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-500">
          Belum ada pesanan meja.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const currentStatus = statusMeta[order.status]
            const StatusIcon = currentStatus.icon

            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      {order.table_number}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Meja {order.table_number}</p>
                      <p className="text-xs text-gray-500">{order.customer_name}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${currentStatus.className}`}>
                      <StatusIcon size={12} />
                      {currentStatus.label}
                    </div>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-600 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} />
                      Hapus
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_0.7fr]">
                  <div className="space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm text-gray-700">
                        <span>
                          {item.name} <span className="text-gray-400">x{item.quantity}</span>
                        </span>
                        <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>Total</span>
                      <span className="font-semibold text-gray-900">{formatRupiah(order.total)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(['pending', 'processing', 'ready', 'done'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => updateStatus(order.id, status)}
                          className={`text-[10px] font-medium rounded-lg px-2 py-2 transition-colors ${
                            order.status === status
                              ? statusMeta[status].className
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {statusMeta[status].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {order.note && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Bell size={13} className="text-amber-600" />
                    {order.note}
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
