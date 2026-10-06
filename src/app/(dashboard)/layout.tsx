'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, ClipboardList,
  Settings, LogOut, Menu, Store, BarChart2, WalletCards, Users, Calculator, Bell, X, Grid2X2, ScrollText,
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
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [notificationLogOpen, setNotificationLogOpen] = useState(false)
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationShopUserId, setNotificationShopUserId] = useState<string | null>(null)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const sidebarMenuRef = useRef<HTMLDivElement>(null)
  const sidebarMenuButtonRef = useRef<HTMLButtonElement>(null)
  const changelogPanelRef = useRef<HTMLElement>(null)
  const changelogButtonRef = useRef<HTMLButtonElement>(null)
  const notificationPanelRef = useRef<HTMLElement>(null)

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

  useEffect(() => {
    if (!notificationLogOpen && !sidebarMenuOpen && !changelogOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (notificationPanelRef.current?.contains(target)) return
      if (sidebarMenuRef.current?.contains(target)) return
      if (sidebarMenuButtonRef.current?.contains(target)) return
      if (changelogPanelRef.current?.contains(target)) return
      if (changelogButtonRef.current?.contains(target)) return
      setNotificationLogOpen(false)
      setSidebarMenuOpen(false)
      setChangelogOpen(false)
    }

    document.addEventListener('click', closeOnOutsideClick, true)
    return () => document.removeEventListener('click', closeOnOutsideClick, true)
  }, [notificationLogOpen, sidebarMenuOpen, changelogOpen])

  const handleLogout = async () => {
    setNotificationLogOpen(false)
    setSidebarMenuOpen(false)
    setChangelogOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const openNotificationLog = async () => {
    setSidebarMenuOpen(false)
    setChangelogOpen(false)
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

  const toggleSidebarMenu = () => {
    setNotificationLogOpen(false)
    setChangelogOpen(false)
    setSidebarMenuOpen(prev => !prev)
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
              onClick={() => {
                setSidebarOpen(false)
                setNotificationLogOpen(false)
                setSidebarMenuOpen(false)
                setChangelogOpen(false)
              }}
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
        <div className="relative ml-[5px] mt-2 w-fit">
          {sidebarMenuOpen && (
            <div ref={sidebarMenuRef} className="absolute bottom-full left-0 z-[60] mb-2 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => void openNotificationLog()}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="relative">
                  <Bell size={16} className="text-gray-500" />
                  {hasUnreadNotifications && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />}
                </span>
                Notifikasi
              </button>
              <button
                type="button"
                ref={changelogButtonRef}
                onClick={() => {
                  setSidebarMenuOpen(false)
                  setNotificationLogOpen(false)
                  setChangelogOpen(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <ScrollText size={16} className="text-gray-500" />
                Changelog
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                Keluar
              </button>
            </div>
          )}
          <button
            type="button"
            ref={sidebarMenuButtonRef}
            onClick={toggleSidebarMenu}
            aria-label="Menu"
            aria-expanded={sidebarMenuOpen}
            className="group relative flex h-9 w-9 items-center justify-center text-gray-600 transition-colors hover:text-indigo-600"
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50">
              <Grid2X2 size={17} />
              {hasUnreadNotifications && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            >
              Menu
            </span>
          </button>
        </div>
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
        <section ref={notificationPanelRef} className="fixed bottom-28 left-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
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

      {changelogOpen && (
        <section ref={changelogPanelRef} className="fixed bottom-28 left-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Changelog</h2>
            <button
              type="button"
              onClick={() => setChangelogOpen(false)}
              aria-label="Tutup changelog"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto px-4">
            <article className="py-3">
              <p className="text-sm font-medium text-gray-800">Restock produk</p>
              <p className="mt-0.5 text-sm text-gray-600">Tambah stok langsung dari daftar produk.</p>
            </article>
            <article className="py-3">
              <p className="text-sm font-medium text-gray-800">Status produk</p>
              <p className="mt-0.5 text-sm text-gray-600">Badge Aktif dan Nonaktif terlihat di daftar produk.</p>
            </article>
            <article className="py-3">
              <p className="text-sm font-medium text-gray-800">Riwayat transaksi</p>
              <p className="mt-0.5 text-sm text-gray-600">Filter transaksi menurut bulan dan tahun.</p>
            </article>
            <article className="py-3">
              <p className="text-sm font-medium text-gray-800">Log notifikasi</p>
              <p className="mt-0.5 text-sm text-gray-600">Catatan produk baru, stok menipis, dan perubahan nama toko.</p>
            </article>
          </div>
        </section>
      )}
    </div>
  )
}