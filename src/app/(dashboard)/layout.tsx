'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, ClipboardList,
  Settings, LogOut, Menu, Store, BarChart2, WalletCards, Users, Calculator, Bell, X,
} from 'lucide-react'

interface NotificationLog {
  id: string
  event_type: string
  title: string
  message: string
  created_at: string
}

const getLastSeenAt = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const setLastSeenAt = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [businessName, setBusinessName] = useState('Shinx Merchant')
  const [role, setRole] = useState<'owner' | 'staff'>('owner')
  const [notificationLogOpen, setNotificationLogOpen] = useState(false)
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationShopUserId, setNotificationShopUserId] = useState<string | null>(null)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('business_name, role, owner_id')
        .eq('id', user.id)
        .single()
      if (data?.business_name) setBusinessName(data.business_name)
      if (data?.role) setRole(data.role as 'owner' | 'staff')
      const shopUserId = data?.role === 'staff' ? data.owner_id : user.id
      if (shopUserId) setNotificationShopUserId(shopUserId)

      // Kalau karyawan, ambil nama bisnis dari owner
      if (data?.role === 'staff' && data?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('business_name')
          .eq('id', data.owner_id)
          .single()
        if (ownerProfile?.business_name) setBusinessName(ownerProfile.business_name)
      }
    }
    getProfile()
  }, [])

  useEffect(() => {
    if (!notificationShopUserId) return

    const lastSeenKey = `notification-log-last-seen:${notificationShopUserId}`
    const loadLatestNotification = async () => {
      const { data } = await supabase
        .from('notification_logs')
        .select('created_at')
        .eq('user_id', notificationShopUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return
      const lastSeenAt = getLastSeenAt(lastSeenKey)
      if (!lastSeenAt || Date.parse(data.created_at) > Date.parse(lastSeenAt)) {
        setHasUnreadNotifications(true)
      }
    }

    void loadLatestNotification()

    const channel = supabase
      .channel(`notification-logs-${notificationShopUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs',
          filter: `user_id=eq.${notificationShopUserId}`,
        },
        payload => {
          const createdAt = (payload.new as { created_at?: string }).created_at
          const lastSeenAt = getLastSeenAt(lastSeenKey)
          if (!lastSeenAt || (createdAt && Date.parse(createdAt) > Date.parse(lastSeenAt))) {
            setHasUnreadNotifications(true)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [notificationShopUserId])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const openNotificationLog = async () => {
    setNotificationLogOpen(true)
    setNotificationLoading(true)
    setNotificationError('')

    if (!notificationShopUserId) {
      setNotificationLogs([])
      setNotificationError('Data toko belum siap. Tutup lalu coba buka lagi.')
      setNotificationLoading(false)
      return
    }

    const controller = typeof AbortController === 'undefined' ? null : new AbortController()
    let timeoutId = 0

    try {
      const request = supabase
        .from('notification_logs')
        .select('id, event_type, title, message, created_at')
        .eq('user_id', notificationShopUserId)
        .order('created_at', { ascending: false })
        .limit(50)
      const timedRequest = controller ? request.abortSignal(controller.signal) : request
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller?.abort()
          reject(new Error('notification-timeout'))
        }, 12000)
      })
      const { data, error } = await Promise.race([timedRequest, timeout])

      if (error) throw error

      setNotificationLogs(data ?? [])
      setNotificationError('')
      setLastSeenAt(
        `notification-log-last-seen:${notificationShopUserId}`,
        data?.[0]?.created_at ?? new Date().toISOString()
      )
      setHasUnreadNotifications(false)
    } catch (error) {
      setNotificationLogs([])
      setNotificationError(
        error instanceof Error && error.message === 'notification-timeout'
          ? 'Permintaan terlalu lama. Periksa koneksi lalu coba lagi.'
          : 'Gagal memuat log notifikasi. Periksa koneksi atau konfigurasi database.'
      )
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId)
      setNotificationLoading(false)
    }
  }

  const formatNotificationDate = (date: string) =>
    new Date(date).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const toggleNotificationLog = () => {
    if (notificationLogOpen) setNotificationLogOpen(false)
    else void openNotificationLog()
  }

  const allNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', ownerOnly: false },
    { href: '/cashier', icon: ShoppingCart, label: 'Kasir', ownerOnly: false },
    { href: '/table-orders', icon: ClipboardList, label: 'Order Meja', ownerOnly: false },
    { href: '/products', icon: Package, label: 'Produk', ownerOnly: false },
    { href: '/transactions', icon: Receipt, label: 'Transaksi', ownerOnly: false },
    { href: '/hpp', icon: Calculator, label: 'Kalkulator HPP', ownerOnly: true },
    { href: '/expenses', icon: WalletCards, label: 'Pengeluaran', ownerOnly: true },
    { href: '/reports', icon: BarChart2, label: 'Laporan', ownerOnly: true },
    { href: '/staff', icon: Users, label: 'Karyawan', ownerOnly: true },
    { href: '/settings', icon: Settings, label: 'Pengaturan', ownerOnly: true },
  ]

  const navItems = allNavItems.filter(item => !item.ownerOnly || role === 'owner')

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Store size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">
              {role === 'staff' ? 'Staff' : 'Owner'}
            </p>
            <p className="text-sm font-bold text-gray-800 leading-tight truncate max-w-[140px]">
              {businessName}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        {role === 'staff' && (
          <div className="px-3 py-2 mb-2">
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
              👤 Staff Account
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleNotificationLog}
          aria-label={notificationLogOpen ? 'Tutup log notifikasi' : 'Buka log notifikasi'}
          aria-expanded={notificationLogOpen}
          title="Log notifikasi"
          className="relative ml-3 mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Bell size={17} />
          {hasUnreadNotifications && (
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut size={18} />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-60 h-full">
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu size={20} className="text-gray-600" />
          </button>
          <span className="flex-1 truncate font-bold text-gray-800 text-sm">{businessName}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {notificationLogOpen && (
        <section className="fixed bottom-28 left-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Log Notifikasi</h2>
            <button
              type="button"
              onClick={() => setNotificationLogOpen(false)}
              aria-label="Tutup log notifikasi"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {notificationLoading ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Memuat notifikasi...</p>
            ) : notificationError ? (
              <p className="px-4 py-8 text-center text-sm text-red-500">{notificationError}</p>
            ) : notificationLogs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Belum ada notifikasi.</p>
            ) : (
              notificationLogs.map(notification => (
                <article key={notification.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                  <p className="text-sm font-medium text-gray-800">{notification.title}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{notification.message}</p>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {formatNotificationDate(notification.created_at)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}