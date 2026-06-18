'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt,
  Settings, LogOut, Menu, Store, BarChart2, WalletCards, Users,
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [businessName, setBusinessName] = useState('Shinx Merchant')
  const [role, setRole] = useState<'owner' | 'staff'>('owner')

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const allNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', ownerOnly: false },
    { href: '/cashier', icon: ShoppingCart, label: 'Kasir', ownerOnly: false },
    { href: '/products', icon: Package, label: 'Produk', ownerOnly: false },
    { href: '/transactions', icon: Receipt, label: 'Transaksi', ownerOnly: false },
    { href: '/expenses', icon: WalletCards, label: 'Pengeluaran', ownerOnly: false },
    { href: '/reports', icon: BarChart2, label: 'Laporan', ownerOnly: false },
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
              {role === 'staff' ? 'KARYAWAN' : 'KASIR'}
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
              👤 Akun Karyawan
            </span>
          </div>
        )}
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
          <span className="font-bold text-gray-800 text-sm">{businessName}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}