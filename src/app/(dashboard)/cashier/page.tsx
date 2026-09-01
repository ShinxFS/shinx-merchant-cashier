'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateInvoice } from '@/lib/utils'
import ProductCard from '@/components/cashier/ProductCard'
import CartItem, { CartItemType } from '@/components/cashier/CartItem'
import PaymentModal from '@/components/cashier/PaymentModal'
import ReceiptModal from '@/components/cashier/ReceiptModal'
import BarcodeScanner from '@/components/cashier/BarcodeScanner'
import { Search, ShoppingCart, Trash2, ChevronRight, ChevronLeft, ScanLine, Plus, X, Bell, CheckCheck } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface TableOrder {
  id: string
  user_id: string
  table_number: number
  customer_name: string
  total: number
  status: 'pending' | 'processing' | 'ready' | 'done'
  payment_method?: 'cash' | 'qris'
  items: Array<{
    id: string
    name: string
    quantity: number
    price: number
    subtotal: number
  }>
  note?: string | null
  created_at: string
}

interface Product {
  id: string
  name: string
  sku?: string | null
  price: number
  cost_price?: number
  stock: number
  image_url: string | null
  category?: { name: string; color: string } | null
  category2?: { name: string; color: string } | null
}

export default function CashierPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  // Keranjang per-meja: key 'takeaway' | '1' | '2' | ... → daftar item
  const [carts, setCarts] = useState<Record<string, CartItemType[]>>({})
  const [tables, setTables] = useState<number[]>([1, 2, 3, 4])
  const [activeTable, setActiveTable] = useState<string>('1')
  const [hydrated, setHydrated] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showScanner, setShowScanner] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [receiptData, setReceiptData] = useState<any>(null)
  const [cartVisible, setCartVisible] = useState(true)
  const [effectiveUserId, setEffectiveUserId] = useState<string>('')
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null)
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([])
  const [tableNotification, setTableNotification] = useState<{ table: number; message: string } | null>(null)
  const [tableStates, setTableStates] = useState<Record<string, 'empty' | 'occupied'>>({})
  const [cashierSoundUrl, setCashierSoundUrl] = useState<string | null>(null)
  const [cashierTone, setCashierTone] = useState('classic')
  const [businessProfile, setBusinessProfile] = useState({
    business_name: 'Toko',
    address: '',
    phone: '',
  })
  const tablesRef = useRef<number[]>(tables)

  const audioContextRef = useRef<AudioContext | null>(null)
  const hasUserInteractionRef = useRef(false)
  const lastOrderSnapshotRef = useRef<string[]>([])

  const unlockAudio = async () => {
    if (hasUserInteractionRef.current) return

    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtor) return

      const context = audioContextRef.current ?? new AudioCtor()
      audioContextRef.current = context
      if (context.state === 'suspended') {
        await context.resume()
      }
      hasUserInteractionRef.current = true
    } catch {
      // ignored on unsupported browsers
    }
  }

  useEffect(() => {
    const onUserInteraction = () => {
      void unlockAudio()
    }

    window.addEventListener('pointerdown', onUserInteraction)
    window.addEventListener('keydown', onUserInteraction)
    window.addEventListener('touchstart', onUserInteraction)

    return () => {
      window.removeEventListener('pointerdown', onUserInteraction)
      window.removeEventListener('keydown', onUserInteraction)
      window.removeEventListener('touchstart', onUserInteraction)
    }
  }, [])

  const playCashierTone = () => {
    const fallbackTone = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return

        const audioContext = audioContextRef.current ?? new AudioCtx()
        audioContextRef.current = audioContext

        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()

        const variation = cashierTone || 'classic'
        const now = audioContext.currentTime

        if (variation === 'beep') {
          oscillator.type = 'square'
          oscillator.frequency.setValueAtTime(680, now)
          oscillator.frequency.exponentialRampToValueAtTime(1100, now + 0.12)
        } else if (variation === 'soft') {
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(440, now)
          oscillator.frequency.exponentialRampToValueAtTime(620, now + 0.2)
        } else if (variation === 'success') {
          oscillator.type = 'triangle'
          oscillator.frequency.setValueAtTime(540, now)
          oscillator.frequency.exponentialRampToValueAtTime(860, now + 0.16)
        } else {
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(880, now)
        }

        gain.gain.setValueAtTime(0.04, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)
        oscillator.connect(gain)
        gain.connect(audioContext.destination)
        oscillator.start(now)
        oscillator.stop(now + 0.26)
      } catch {
        // ignore unsupported browsers
      }
    }

    if (cashierSoundUrl) {
      try {
        void unlockAudio()
        const audio = new Audio(cashierSoundUrl)
        audio.volume = 1
        const playPromise = audio.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => fallbackTone())
        }
      } catch {
        fallbackTone()
      }
      return
    }

    if ((cashierTone || 'classic') !== 'classic') {
      fallbackTone()
      return
    }

    try {
      void unlockAudio()
      const audio = new Audio('/sounds/kasir.wav')
      audio.volume = 1
      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => fallbackTone())
      }
    } catch {
      fallbackTone()
    }
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, owner_id')
        .eq('id', user.id)
        .single()

      const isStaff = profile?.role === 'staff'
      const targetUserId = isStaff ? (profile?.owner_id ?? user.id) : user.id
      setEffectiveUserId(targetUserId)

      const { data } = await supabase
        .from('products')
        .select('*, category:categories!category_id(name, color), category2:categories!category_id_2(name, color)')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .order('name')
      setProducts(data ?? [])
      setFiltered(data ?? [])

      const { data: prof } = await supabase
        .from('profiles')
        .select('business_name, address, phone, qris_image_url, cashier_sound_url, cashier_tone')
        .eq('id', targetUserId)
        .single()
      if (prof) {
        setBusinessProfile({
          business_name: prof.business_name ?? 'Toko',
          address: prof.address ?? '',
          phone: prof.phone ?? '',
        })
        setQrisImageUrl(prof.qris_image_url ?? null)
        setCashierSoundUrl(prof.cashier_sound_url ?? null)
        setCashierTone(prof.cashier_tone ?? 'classic')
      }
    }
    load()
  }, [])

  useEffect(() => {
    tablesRef.current = tables
  }, [tables])

  useEffect(() => {
    if (!effectiveUserId) return

    const loadTableOrders = async () => {
      const { data, error } = await supabase
        .from('table_orders')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (error) return

      const loadedOrders = (data as TableOrder[]) ?? []
      const currentIds = loadedOrders.map(order => order.id)
      const previousIds = lastOrderSnapshotRef.current

      const newOrderIds = currentIds.filter(id => !previousIds.includes(id))
      const justCompleted = loadedOrders.filter(order => {
        const prev = previousIds.includes(order.id)
        return prev && order.status === 'done'
      })

      setTableOrders(loadedOrders)
      lastOrderSnapshotRef.current = currentIds

      const nextState = {} as Record<string, 'empty' | 'occupied'>
      for (const tableNumber of tablesRef.current) {
        nextState[String(tableNumber)] = 'empty'
      }

      for (const order of loadedOrders) {
        if (order.status !== 'done') {
          nextState[String(order.table_number)] = 'occupied'
        }
      }

      setTableStates(nextState)

      if (newOrderIds.length > 0) {
        const newestNewOrder = loadedOrders.find(order => newOrderIds.includes(order.id))
        if (newestNewOrder?.table_number) {
          setTableNotification({ table: newestNewOrder.table_number, message: `Pesanan meja ${newestNewOrder.table_number} masuk!` })
          playCashierTone()
          setTimeout(() => setTableNotification(null), 4000)
        }
      }

      if (justCompleted.length > 0) {
        const newestCompleted = justCompleted[0]
        if (newestCompleted.table_number) {
          setTableNotification({ table: newestCompleted.table_number, message: `Meja ${newestCompleted.table_number} sudah selesai!` })
          playCashierTone()
          setTimeout(() => setTableNotification(null), 4000)
        }
      }
    }

    const refreshAndNotify = async (eventType: 'insert' | 'update' | 'delete', row?: Partial<TableOrder>) => {
      await loadTableOrders()

      if (eventType === 'insert' && row?.table_number) {
        setTableNotification({ table: row.table_number, message: `Pesanan meja ${row.table_number} masuk!` })
        playCashierTone()
        setTimeout(() => setTableNotification(null), 4000)
      }

      if (eventType === 'update' && row?.table_number && row.status === 'done') {
        setTableNotification({ table: row.table_number, message: `Meja ${row.table_number} sudah selesai!` })
        playCashierTone()
        setTimeout(() => setTableNotification(null), 4000)
      }
    }

    loadTableOrders()

    const intervalId = window.setInterval(() => {
      void loadTableOrders()
    }, 4000)

    const channel = supabase.channel(`table-orders-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_orders',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        payload => {
          void refreshAndNotify('insert', payload.new as Partial<TableOrder>)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'table_orders',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        payload => {
          void refreshAndNotify('update', payload.new as Partial<TableOrder>)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'table_orders',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        payload => {
          void loadTableOrders()
          const deleted = payload.old as Partial<TableOrder>
          if (deleted.table_number) {
            setTableStates(prev => ({ ...prev, [String(deleted.table_number)]: 'empty' }))
          }
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(intervalId)
      supabase.removeChannel(channel)
    }
  }, [effectiveUserId])

  // Daftar kategori unik dari semua produk (gabungan category & category2)
  const categories = Array.from(
    new Map(
      products
        .flatMap(p => [p.category, p.category2])
        .filter((c): c is { name: string; color: string } => !!c?.name)
        .map(c => [c.name, c])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      products.filter(p => {
        const matchName = p.name.toLowerCase().includes(q)
        const matchCategory =
          activeCategory === 'all' ||
          p.category?.name === activeCategory ||
          p.category2?.name === activeCategory
        return matchName && matchCategory
      })
    )
  }, [search, products, activeCategory])

  // Muat keranjang per-meja yang tersimpan (biar refresh tidak menghilangkan pesanan meja)
  useEffect(() => {
    if (!effectiveUserId) return
    try {
      const raw = localStorage.getItem(`pos_carts_${effectiveUserId}`)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.carts) setCarts(saved.carts)
        if (Array.isArray(saved.tables) && saved.tables.length) setTables(saved.tables)
        if (saved.activeTable) setActiveTable(saved.activeTable)
      }

      const tableStateRaw = localStorage.getItem(`pos_table_states_${effectiveUserId}`)
      if (tableStateRaw) {
        const parsed = JSON.parse(tableStateRaw)
        if (parsed && typeof parsed === 'object') setTableStates(parsed)
      }
    } catch {}
    setHydrated(true)
  }, [effectiveUserId])

  // Simpan otomatis setiap ada perubahan (setelah selesai memuat, biar tidak menimpa data)
  useEffect(() => {
    if (!hydrated || !effectiveUserId) return
    try {
      localStorage.setItem(
        `pos_carts_${effectiveUserId}`,
        JSON.stringify({ carts, tables, activeTable })
      )
      localStorage.setItem(
        `pos_table_states_${effectiveUserId}`,
        JSON.stringify(tableStates)
      )
    } catch {}
  }, [carts, tables, activeTable, hydrated, effectiveUserId, tableStates])

  // Keranjang meja yang sedang aktif
  const cart = carts[activeTable] ?? []
  const activeLabel = activeTable === 'takeaway' ? 'Bawa Pulang' : `Meja ${activeTable}`

  const setActiveCart = (updater: (prev: CartItemType[]) => CartItemType[]) =>
    setCarts(prev => ({ ...prev, [activeTable]: updater(prev[activeTable] ?? []) }))

  const addTable = () => {
    const next = (tables.length ? Math.max(...tables) : 0) + 1
    setTables(prev => [...prev, next])
    setActiveTable(String(next))
    setTableStates(prev => ({ ...prev, [String(next)]: 'empty' }))
  }

  const removeTable = (key: string) => {
    const num = Number(key)
    const hasItems = (carts[key]?.length ?? 0) > 0
    if (hasItems && !confirm(`Meja ${num} masih ada pesanan. Hapus meja & buang pesanannya?`)) return

    const remaining = tables.filter(t => t !== num)
    setTables(remaining)
    setCarts(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setTableStates(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (activeTable === key) {
      setActiveTable(remaining.length ? String(remaining[0]) : 'takeaway')
    }
  }

  const setTableAvailability = (key: string, status: 'empty' | 'occupied') => {
    setTableStates(prev => ({ ...prev, [key]: status }))
  }

  const addToCart = (product: Product) => {
    setActiveCart(prev => {
      const exist = prev.find(i => i.id === product.id)
      if (exist) {
        if (exist.quantity >= product.stock) return prev
        return prev.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
        image_url: product.image_url,
      }]
    })
  }

  const handleScan = (code: string) => {
    setShowScanner(false)
    const term = code.trim().toLowerCase()
    const product = products.find(p => (p.sku ?? '').trim().toLowerCase() === term)

    const flash = (msg: string) => {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(''), 3500)
    }

    if (!product) {
      flash(`❌ Barcode "${code}" tidak terdaftar`)
      return
    }
    if (product.stock <= 0) {
      flash(`⚠️ Stok "${product.name}" habis`)
      return
    }
    addToCart(product)
    flash(`✅ ${product.name} ditambahkan ke keranjang`)
  }

  const increase = (id: string) => setActiveCart(prev =>
    prev.map(i => i.id === id && i.quantity < i.stock ? { ...i, quantity: i.quantity + 1 } : i)
  )
  const decrease = (id: string) => setActiveCart(prev =>
    prev.map(i => i.id === id && i.quantity > 1 ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0)
  )
  const remove = (id: string) => setActiveCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => setActiveCart(() => [])

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const submitTableOrder = async () => {
    if (activeTable === 'takeaway' || !effectiveUserId || cart.length === 0) return

    const payload = {
      user_id: effectiveUserId,
      table_number: Number(activeTable),
      customer_name: `Pelanggan Meja ${activeTable}`,
      total: subtotal,
      status: 'pending',
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
      })),
      note: `Order dari meja ${activeTable}`,
    }

    const { data, error } = await supabase
      .from('table_orders')
      .insert(payload)
      .select()
      .single()

    if (error || !data) {
      setSuccessMsg('⚠️ Gagal mengirim pesanan meja')
      setTimeout(() => setSuccessMsg(''), 3000)
      return
    }

    setTableOrders(prev => [data as TableOrder, ...prev])
    setTableNotification({
      table: Number(activeTable),
      message: `Pesanan meja ${activeTable} masuk ke kasir!`,
    })
    playCashierTone()
    setTimeout(() => setTableNotification(null), 4000)
    setActiveCart(() => [])
    setSuccessMsg(`✅ Pesanan meja ${activeTable} dikirim`) 
    setTimeout(() => setSuccessMsg(''), 2500)
  }

  const updateOrderStatus = async (id: string, status: TableOrder['status']) => {
    const currentOrder = tableOrders.find(order => order.id === id)
    if (!currentOrder) return

    const { data, error } = await supabase
      .from('table_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return

    if (data) {
      setTableOrders(prev => prev.map(order => order.id === id ? data as TableOrder : order))
    }

    if (status === 'done' && currentOrder.status !== 'done') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const invoice = generateInvoice()
      const baseTx = {
        user_id: effectiveUserId,
        created_by: user.id,
        invoice_number: invoice,
        subtotal: currentOrder.total,
        discount: 0,
        tax: 0,
        total: currentOrder.total,
        payment_method: 'cash',
        amount_paid: currentOrder.total,
        change_amount: 0,
        table_number: currentOrder.table_number,
        notes: `Pesanan meja ${currentOrder.table_number}`,
      }

      let transaction: any = null
      let txError: any = null

      const insertResult = await supabase
        .from('transactions')
        .insert(baseTx)
        .select()
        .single()

      transaction = insertResult.data
      txError = insertResult.error

      if (txError && /table_number/i.test(txError.message)) {
        const retry = await supabase
          .from('transactions')
          .insert({
            user_id: effectiveUserId,
            created_by: user.id,
            invoice_number: invoice,
            subtotal: currentOrder.total,
            discount: 0,
            tax: 0,
            total: currentOrder.total,
            payment_method: 'cash',
            amount_paid: currentOrder.total,
            change_amount: 0,
            notes: `Pesanan meja ${currentOrder.table_number}`,
          })
          .select()
          .single()

        transaction = retry.data
        txError = retry.error
      }

      if (!transaction || txError) {
        return
      }

      const itemsToInsert = currentOrder.items.map(item => {
        const product = products.find(p => p.id === item.id)
        return {
          transaction_id: transaction.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          cost_price: product?.cost_price ?? 0,
          subtotal: item.subtotal,
        }
      })

      if (itemsToInsert.length > 0) {
        await supabase.from('transaction_items').insert(itemsToInsert)
      }

      setSuccessMsg(`✅ Meja ${currentOrder.table_number} masuk ke transaksi hari ini`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const deleteCompletedOrder = async (id: string) => {
    const target = tableOrders.find(order => order.id === id)
    if (!target || target.status !== 'done') return

    const { error } = await supabase
      .from('table_orders')
      .delete()
      .eq('id', id)

    if (!error) {
      setTableOrders(prev => prev.filter(order => order.id !== id))
      setSuccessMsg('✅ Pesanan selesai berhasil dihapus')
      setTimeout(() => setSuccessMsg(''), 2500)
    }
  }

  const handlePayment = async (
    method: string,
    amountPaid: number,
    discount: number,
    tax: number
  ) => {
    setPaymentLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const total = subtotal - discount + tax
    const change = method === 'cash' ? amountPaid - total : 0
    const invoice = generateInvoice()
    const tableNumber = activeTable === 'takeaway' ? null : Number(activeTable)

    // Simpan transaksi dengan effectiveUserId (owner punya karyawan)
    const baseTx = {
      user_id: effectiveUserId,
      created_by: user.id,
      invoice_number: invoice,
      subtotal,
      discount,
      tax,
      total,
      payment_method: method,
      amount_paid: amountPaid,
      change_amount: change,
    }

    let { data: tx, error } = await supabase
      .from('transactions')
      .insert({ ...baseTx, table_number: tableNumber })
      .select()
      .single()

    // Fallback: kalau kolom table_number belum dibuat di DB, simpan tanpa kolom itu
    if (error && /table_number/i.test(error.message)) {
      const retry = await supabase
        .from('transactions')
        .insert(baseTx)
        .select()
        .single()
      tx = retry.data
      error = retry.error
    }

    if (error || !tx) {
      setPaymentLoading(false)
      return
    }

    await supabase.from('transaction_items').insert(
      cart.map(i => {
        const product = products.find(p => p.id === i.id)
        return {
          transaction_id: tx.id,
          product_id: i.id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
          cost_price: product?.cost_price ?? 0,
          subtotal: i.price * i.quantity,
        }
      })
    )

    for (const item of cart) {
      const product = products.find(p => p.id === item.id)
      if (product) {
        await supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.id)
      }
    }

    setProducts(prev =>
      prev.map(p => {
        const cartItem = cart.find(i => i.id === p.id)
        return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p
      })
    )

    setReceiptData({
      invoice_number: invoice,
      created_at: new Date().toISOString(),
      items: cart.map(i => ({
        product_name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
        subtotal: i.price * i.quantity,
      })),
      subtotal,
      discount,
      tax,
      total,
      payment_method: method,
      amount_paid: amountPaid,
      change_amount: change,
      business_name: businessProfile.business_name,
      address: businessProfile.address,
      phone: businessProfile.phone,
      table_number: tableNumber,
      table_label: activeLabel,
    })

    setActiveCart(() => [])
    setShowPayment(false)
    setPaymentLoading(false)
  }

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

  const statusLabel: Record<TableOrder['status'], string> = {
    pending: 'Menunggu',
    processing: 'Diproses',
    ready: 'Siap',
    done: 'Selesai',
  }

  const statusColor: Record<TableOrder['status'], string> = {
    pending: 'bg-amber-100 text-amber-700',
    processing: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    done: 'bg-gray-200 text-gray-700',
  }

  return (
    <div className="flex h-full relative">

      {/* Kiri: Produk */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              title="Scan barcode"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <ScanLine size={16} />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          {/* Filter kategori */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto mt-3 -mb-1 pb-1">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Semua
              </button>
              {categories.map(c => {
                const isActive = activeCategory === c.name
                return (
                  <button
                    key={c.name}
                    onClick={() => setActiveCategory(c.name)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color || '#9ca3af' }}
                    />
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {successMsg && (
          <div className="mx-4 mt-3 bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg border border-green-200">
            {successMsg}
          </div>
        )}

        {tableNotification && (
          <div className="mx-4 mt-3 bg-indigo-50 text-indigo-700 text-sm px-4 py-2.5 rounded-lg border border-indigo-200 flex items-center gap-2">
            <Bell size={16} />
            {tableNotification.message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {products.length === 0
                ? 'Belum ada produk. Tambah produk dulu!'
                : 'Produk tidak ditemukan'}
            </div>
          ) : (
            <div className={`grid gap-3 ${
              cartVisible
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'
            }`}>
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tombol Toggle Keranjang */}
      <button
        onClick={() => setCartVisible(v => !v)}
        className="absolute top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-200 rounded-l-xl px-1.5 py-3 shadow-md hover:bg-gray-50 transition-colors"
        style={{ right: cartVisible ? '320px' : '0px' }}
      >
        {cartVisible ? (
          <ChevronRight size={16} className="text-gray-500" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <ChevronLeft size={16} className="text-gray-500" />
            {totalItems > 0 && (
              <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Kanan: Cart */}
      {cartVisible && (
        <div className="w-[18rem] sm:w-72 lg:w-80 xl:w-[20rem] flex-shrink-0 bg-white border-1 border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart size={20} className="text-indigo-600" />
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-800">Keranjang</span>
                  {cart.length > 0 && (
                    <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {cart.length}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-indigo-600 font-medium mt-1">{activeLabel}</span>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 size={13} /> Hapus Semua
              </button>
            )}
          </div>

          {/* Selector Meja */}
          <div className="px-3 py-3 border-b border-gray-100 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'takeaway', label: 'Bawa Pulang', canDelete: false },
                ...tables.map(t => ({ key: String(t), label: `Meja ${t}`, canDelete: true })),
              ].map(({ key, label, canDelete }) => {
                const isActive = activeTable === key
                const hasItems = (carts[key]?.length ?? 0) > 0
                const currentStatus = key === 'takeaway' ? 'occupied' : (tableStates[key] ?? 'empty')
                return (
                  <div
                    key={key}
                    className={`relative flex-shrink-0 flex items-center rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <button
                      onClick={() => setActiveTable(key)}
                      className={`py-1.5 pl-3 ${isActive && canDelete ? 'pr-1' : 'pr-3'}`}
                    >
                      {label}
                    </button>
                    {isActive && canDelete && (
                      <button
                        onClick={() => removeTable(key)}
                        title="Hapus meja"
                        className="pr-2 pl-0.5 py-1.5 text-indigo-200 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                    {hasItems && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white" />
                    )}
                    {key !== 'takeaway' && (
                      <span className={`absolute -bottom-1.5 right-1 px-1 py-0.5 rounded-full text-[8px] font-semibold ${currentStatus === 'occupied' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {currentStatus === 'occupied' ? 'Aktif' : 'Kosong'}
                      </span>
                    )}
                  </div>
                )
              })}
              <button
                onClick={addTable}
                title="Tambah meja"
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {tableOrders.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-3 bg-amber-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Bell size={15} />
                  Pesanan Meja
                </div>
                <span className="text-[10px] text-amber-700 font-medium">
                  {tableOrders.filter(order => order.status !== 'done').length} pending
                </span>
              </div>

              <div className="space-y-2">
                {tableOrders.slice(0, 3).map(order => (
                  <div key={order.id} className="bg-white rounded-lg border border-amber-200 p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-gray-800">Meja {order.table_number}</p>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {order.items.slice(0, 2).map(item => `${item.name} x${item.quantity}`).join(', ')}
                      {order.items.length > 2 ? ' ...' : ''}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-gray-700">{formatRupiah(order.total)}</span>
                        <span className="text-[10px] text-gray-500">{order.payment_method === 'qris' ? 'QRIS' : 'Tunai'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {order.status !== 'done' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, order.status === 'pending' ? 'processing' : order.status === 'processing' ? 'ready' : 'done')}
                            className="text-[10px] px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            {order.status === 'pending' ? 'Proses' : order.status === 'processing' ? 'Siap' : 'Selesai'}
                          </button>
                        )}
                        {order.status === 'done' && (
                          <button
                            onClick={() => deleteCompletedOrder(order.id)}
                            className="text-[10px] px-2 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-800">
                <ShoppingCart size={40} />
                <p className="text-sm mt-2">Keranjang kosong</p>
                <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
              </div>
            ) : (
              <div className="py-2">
                {cart.map(item => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onIncrease={increase}
                    onDecrease={decrease}
                    onRemove={remove}
                  />
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{totalItems} item</span>
                <span className="font-bold text-gray-900">{formatRupiah(subtotal)}</span>
              </div>

              {activeTable !== 'takeaway' && (
                <button
                  onClick={submitTableOrder}
                  className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors"
                >
                  Kirim Pesanan Meja {activeTable}
                </button>
              )}

              <button
                onClick={() => setShowPayment(true)}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
              >
                Bayar {formatRupiah(subtotal)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating bayar saat keranjang hidden */}
      {!cartVisible && cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-20">
          <button
            onClick={() => setShowPayment(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <ShoppingCart size={16} />
            Bayar {formatRupiah(subtotal)}
            <span className="bg-white text-indigo-600 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {totalItems}
            </span>
          </button>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner
          onDetected={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPayment && (
        <PaymentModal
          subtotal={subtotal}
          onConfirm={handlePayment}
          onClose={() => setShowPayment(false)}
          loading={paymentLoading}
          qrisImageUrl={qrisImageUrl}
        />
      )}

      {receiptData && (
        <ReceiptModal
          data={receiptData}
          onClose={() => {
            setReceiptData(null)
            setSuccessMsg('✅ Transaksi berhasil!')
            setTimeout(() => setSuccessMsg(''), 4000)
          }}
        />
      )}
    </div>
  )
}