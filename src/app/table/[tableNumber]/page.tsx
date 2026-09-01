'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Minus, Plus, ShoppingCart, CheckCircle2, AlertCircle } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  image_url: string | null
  sku?: string | null
  category?: { name: string; color: string } | null
  category2?: { name: string; color: string } | null
}

export default function TableOrderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const tableNumber = Number(params.tableNumber)
  const ownerId = searchParams.get('owner') ?? ''

  const [products, setProducts] = useState<Product[]>([])
  const [businessName, setBusinessName] = useState('Toko')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orderStatus, setOrderStatus] = useState<'pending' | 'processing' | 'ready' | 'done' | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash')
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null)
  const [customerSoundUrl, setCustomerSoundUrl] = useState<string | null>(null)
  const [customerTone, setCustomerTone] = useState('classic')
  const [latestOrderItems, setLatestOrderItems] = useState<Array<{ id: string; name: string; quantity: number; price: number; subtotal: number }>>([])
  const [latestOrderTotal, setLatestOrderTotal] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastStatusRef = useRef<'pending' | 'processing' | 'ready' | 'done' | null>(null)
  const lastOrderIdRef = useRef<string | null>(null)
  const hasUserInteractionRef = useRef(false)

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

  const playReadyTone = () => {
    const fallbackTone = () => {
      try {
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtor) return

        const context = audioContextRef.current ?? new AudioCtor()
        audioContextRef.current = context

        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const variation = customerTone || 'classic'
        const now = context.currentTime

        if (variation === 'beep') {
          oscillator.type = 'square'
          oscillator.frequency.setValueAtTime(700, now)
          oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.16)
        } else if (variation === 'soft') {
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(420, now)
          oscillator.frequency.exponentialRampToValueAtTime(650, now + 0.24)
        } else if (variation === 'success') {
          oscillator.type = 'triangle'
          oscillator.frequency.setValueAtTime(560, now)
          oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.18)
        } else {
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(880, now)
          oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.18)
        }

        gain.gain.setValueAtTime(0.04, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(now)
        oscillator.stop(now + 0.25)
      } catch {
        // ignore unsupported browsers
      }
    }

    if (customerSoundUrl) {
      try {
        void unlockAudio()
        const audio = new Audio(customerSoundUrl)
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

    if ((customerTone || 'classic') !== 'classic') {
      fallbackTone()
      return
    }

    try {
      void unlockAudio()
      const audio = new Audio('/sounds/pelanggan.wav')
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
      if (!ownerId) {
        setError('Link pesanan tidak valid. Hubungi kasir untuk mendapatkan QR meja.')
        setLoading(false)
        return
      }

      const [{ data: profile }, { data: items }] = await Promise.all([
        supabase.from('profiles').select('business_name, qris_image_url, customer_sound_url, customer_tone').eq('id', ownerId).single(),
        supabase
          .from('products')
          .select('*, category:categories!category_id(name, color), category2:categories!category_id_2(name, color)')
          .eq('user_id', ownerId)
          .eq('is_active', true)
          .order('name'),
      ])

      if (profile?.business_name) setBusinessName(profile.business_name)
      if (profile?.qris_image_url) setQrisImageUrl(profile.qris_image_url)
      if (profile?.customer_sound_url) setCustomerSoundUrl(profile.customer_sound_url)
      setCustomerTone(profile?.customer_tone ?? 'classic')
      setProducts(items ?? [])
      setLoading(false)
    }

    load()
  }, [ownerId])

  useEffect(() => {
    if (!ownerId || !tableNumber) return

    const normalizeOrderItems = (items: unknown) => {
      if (!Array.isArray(items)) return []

      return items
        .map(item => {
          const record = item as {
            id?: string
            product_id?: string
            name?: string
            quantity?: number
            price?: number
            subtotal?: number
          }

          const id = record.id ?? record.product_id ?? ''
          const name = record.name ?? 'Produk'
          const quantity = Number(record.quantity ?? 0)
          const price = Number(record.price ?? 0)
          const subtotal = Number(record.subtotal ?? quantity * price)

          if (!id && !name) return null

          return {
            id,
            name,
            quantity,
            price,
            subtotal,
          }
        })
        .filter(Boolean) as Array<{ id: string; name: string; quantity: number; price: number; subtotal: number }>
    }

    const pickLatestTableOrder = (rows: Array<{ id?: string; status?: 'pending' | 'processing' | 'ready' | 'done'; items?: unknown; total?: number; payment_method?: 'cash' | 'qris'; updated_at?: string; created_at?: string }>) => {
      if (!rows || rows.length === 0) return null

      const sortedRows = [...rows].sort((a, b) => {
        const at = new Date(a.updated_at ?? a.created_at ?? 0).getTime()
        const bt = new Date(b.updated_at ?? b.created_at ?? 0).getTime()
        return bt - at
      })

      const activeRow = sortedRows.find(row => row.status && row.status !== 'done') ?? sortedRows[0]
      return activeRow ?? null
    }

    const loadLatestOrderStatus = async () => {
      const { data } = await supabase
        .from('table_orders')
        .select('id, status, table_number, items, total, payment_method, updated_at, created_at')
        .eq('user_id', ownerId)
        .eq('table_number', tableNumber)
        .order('updated_at', { ascending: false })

      const latest = pickLatestTableOrder((data ?? []) as Array<{ id?: string; status?: 'pending' | 'processing' | 'ready' | 'done'; items?: unknown; total?: number; payment_method?: 'cash' | 'qris'; updated_at?: string; created_at?: string }>)

      if (latest) {
        const items = normalizeOrderItems(latest.items)
        const nextStatus = latest.status ?? 'pending'
        const nextOrderId = latest.id ?? null

        setOrderId(nextOrderId)
        setOrderStatus(nextStatus)
        if (nextStatus === 'ready' && (lastStatusRef.current !== 'ready' || lastOrderIdRef.current !== nextOrderId)) {
          playReadyTone()
        }
        lastStatusRef.current = nextStatus
        lastOrderIdRef.current = nextOrderId
        setPaymentMethod(latest.payment_method ?? 'cash')
        setLatestOrderItems(items)
        setLatestOrderTotal(Number(latest.total ?? items.reduce((sum, item) => sum + item.subtotal, 0)))
        setShowOrderDetail(Boolean(latest.id) && nextStatus !== 'done')
      } else {
        setOrderId(null)
        setOrderStatus(null)
        lastStatusRef.current = null
        lastOrderIdRef.current = null
        setLatestOrderItems([])
        setLatestOrderTotal(0)
        setShowOrderDetail(false)
      }
    }

    loadLatestOrderStatus()

    const intervalId = window.setInterval(() => {
      loadLatestOrderStatus()
    }, 4000)

    const channel = supabase.channel(`table-status-${ownerId}-${tableNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_orders',
          filter: `user_id=eq.${ownerId}`,
        },
        async payload => {
          const updated = payload.new as { table_number?: number }
          if (updated.table_number !== tableNumber) return
          await loadLatestOrderStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'table_orders',
          filter: `user_id=eq.${ownerId}`,
        },
        async payload => {
          const updated = payload.new as { table_number?: number }
          if (updated.table_number !== tableNumber) return
          await loadLatestOrderStatus()
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(intervalId)
      supabase.removeChannel(channel)
    }
  }, [ownerId, tableNumber])

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const subtotal = useMemo(
    () => products.reduce((sum, product) => {
      const qty = cart[product.id] ?? 0
      return sum + qty * product.price
    }, 0),
    [cart, products]
  )
  const orderReview = products.filter(product => (cart[product.id] ?? 0) > 0)
  const liveOrderStatus = orderStatus ?? (orderId ? 'pending' : null)
  const hasOrderRecord = Boolean(orderId || latestOrderItems.length > 0 || liveOrderStatus)
  const hasActiveOrder = Boolean(orderId || latestOrderItems.length > 0 || (liveOrderStatus && liveOrderStatus !== 'done'))
  const summaryItems = latestOrderItems.length > 0 ? latestOrderItems : orderReview.map(product => ({
    id: product.id,
    name: product.name,
    quantity: cart[product.id] ?? 0,
    price: product.price,
    subtotal: (cart[product.id] ?? 0) * product.price,
  }))
  const summaryTotal = latestOrderItems.length > 0 ? latestOrderTotal : subtotal

  const orderStatusMeta: Record<NonNullable<typeof orderStatus>, { label: string; className: string }> = {
    pending: {
      label: paymentMethod === 'qris' ? 'Menunggu konfirmasi bayar' : 'Masih diproses',
      className: 'bg-amber-100 text-amber-700 border border-amber-200 shadow-[0_0_0_4px_rgba(251,191,36,0.12)] animate-pulse',
    },
    processing: { label: 'Sedang diproses', className: 'bg-blue-100 text-blue-700 border border-blue-200 shadow-[0_0_0_4px_rgba(59,130,246,0.12)] animate-pulse' },
    ready: { label: 'Sudah siap', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] animate-bounce' },
    done: { label: 'Selesai', className: 'bg-slate-200 text-slate-700 border border-slate-300' },
  }

  const addItem = (product: Product) => {
    setCart(prev => {
      const qty = prev[product.id] ?? 0
      if (product.stock <= 0) return prev
      if (qty >= product.stock) return prev
      return { ...prev, [product.id]: qty + 1 }
    })
  }

  const removeItem = (product: Product) => {
    setCart(prev => {
      const qty = prev[product.id] ?? 0
      if (!qty) return prev
      if (qty === 1) {
        const next = { ...prev }
        delete next[product.id]
        return next
      }
      return { ...prev, [product.id]: qty - 1 }
    })
  }

  const submitOrder = async () => {
    if (!ownerId || !tableNumber || totalItems === 0) return

    const orderItems = products
      .filter(product => (cart[product.id] ?? 0) > 0)
      .map(product => ({
        id: product.id,
        name: product.name,
        quantity: cart[product.id],
        price: product.price,
        subtotal: (cart[product.id] ?? 0) * product.price,
      }))

    setSubmitting(true)
    setError('')
    setSuccess('')

    const payload = {
      user_id: ownerId,
      table_number: tableNumber,
      customer_name: `Pelanggan Meja ${tableNumber}`,
      total: subtotal,
      status: paymentMethod === 'qris' ? 'pending' : 'pending',
      items: orderItems,
      note: paymentMethod === 'qris'
        ? `Order via QR Meja ${tableNumber} - menunggu konfirmasi pembayaran QRIS`
        : `Order via QR Meja ${tableNumber}`,
      payment_method: paymentMethod,
    }

    const { data, error: insertErr } = await supabase
      .from('table_orders')
      .insert(payload)
      .select('id')
      .single()

    if (insertErr) {
      const fallback = await supabase
        .from('table_orders')
        .insert({
          user_id: ownerId,
          table_number: tableNumber,
          customer_name: `Pelanggan Meja ${tableNumber}`,
          total: subtotal,
          status: 'pending',
          items: orderItems,
          note: `Order via QR Meja ${tableNumber}`,
        })
        .select('id')
        .single()

      if (fallback.error || !fallback.data) {
        setError('Gagal mengirim order. Coba ulang sebentar lagi.')
        setSubmitting(false)
        return
      }

      setOrderId(fallback.data.id ?? null)
    } else {
      setOrderId(data?.id ?? null)
    }

    setCart({})
    setOrderStatus('pending')
    setLatestOrderItems(orderItems)
    setLatestOrderTotal(subtotal)
    setShowOrderDetail(true)
    setSuccess(
      paymentMethod === 'qris'
        ? `✅ Pesanan meja ${tableNumber} diterima. Bayar via QRIS dulu, lalu tunggu konfirmasi kasir.`
        : `✅ Pesanan meja ${tableNumber} berhasil dikirim ke kasir.`
    )
    setSubmitting(false)
  }

  const cancelOrder = async () => {
    if (!ownerId || !tableNumber || !orderId) {
      setError('Belum ada pesanan yang bisa dibatalkan.')
      return
    }

    const { error } = await supabase
      .from('table_orders')
      .delete()
      .eq('id', orderId)

    if (error) {
      setError('Gagal membatalkan pesanan. Coba ulang sebentar lagi.')
      return
    }

    setOrderId(null)
    setOrderStatus(null)
    setLatestOrderItems([])
    setLatestOrderTotal(0)
    setShowOrderDetail(false)
    setSuccess(`✅ Pesanan meja ${tableNumber} berhasil dibatalkan.`)
    setError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 text-sm text-gray-600 shadow-sm">
          Memuat menu meja {tableNumber || ''}...
        </div>
      </div>
    )
  }

  if (!ownerId || Number.isNaN(tableNumber) || tableNumber < 1) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 rounded-2xl px-6 py-5 max-w-md text-sm text-red-700 shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={18} />
            QR meja tidak valid
          </div>
          <p className="mt-2">Silakan scan QR dari meja yang benar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Pesanan Meja</p>
              <h1 className="text-2xl font-bold text-gray-900">{businessName}</h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-indigo-50 text-indigo-700 rounded-full px-3 py-1.5 text-sm font-semibold">
                Meja {tableNumber}
              </div>
              {liveOrderStatus ? (
                <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${orderStatusMeta[liveOrderStatus].className}`}>
                  {orderStatusMeta[liveOrderStatus].label}
                </div>
              ) : (
                <div className="bg-gray-100 text-gray-600 rounded-full px-3 py-1.5 text-xs font-semibold">
                  Belum ada pesanan
                </div>
              )}
              {hasActiveOrder && liveOrderStatus && liveOrderStatus !== 'done' && (
                <button
                  type="button"
                  onClick={() => setShowOrderDetail(value => !value)}
                  className="bg-slate-900 text-white rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  {showOrderDetail ? 'Sembunyikan Detail' : 'Lihat Detail'}
                </button>
              )}
            </div>
          </div>

          {hasOrderRecord && liveOrderStatus && showOrderDetail && (
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-indigo-800">Detail pesanan Anda</p>
                <span className="text-xs font-medium text-indigo-600">{orderStatusMeta[liveOrderStatus].label}</span>
              </div>

              <div className="space-y-2 text-sm text-indigo-900">
                {summaryItems.map(item => (
                  <div key={`${item.id}-${item.name}`} className="flex items-center justify-between gap-3">
                    <span>
                      {item.name} <span className="text-indigo-600">x{item.quantity}</span>
                    </span>
                    <span className="font-semibold">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-indigo-200 flex items-center justify-between text-sm font-semibold text-indigo-900">
                <span>Total</span>
                <span>{formatRupiah(summaryTotal)}</span>
              </div>
            </div>
          )}
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-4">
            {products.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500 text-sm">
                Menu untuk meja ini belum tersedia.
              </div>
            ) : (
              products.map(product => {
                const qty = cart[product.id] ?? 0
                const outOfStock = product.stock <= 0

                return (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400">IMG</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-gray-900 text-base">{product.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{product.category?.name ?? 'Umum'}</p>

                        {outOfStock ? (
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-red-500">Stok habis</span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="font-bold text-indigo-600">{formatRupiah(product.price)}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeItem(product)}
                                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center"
                                aria-label={`Kurangi ${product.name}`}
                              >
                                <Minus size={15} />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold text-gray-800">{qty}</span>
                              <button
                                onClick={() => addItem(product)}
                                className="w-8 h-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center"
                                aria-label={`Tambah ${product.name}`}
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <aside className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm h-fit sticky top-4">
            <div className="flex items-center gap-2 mb-4 text-gray-800">
              <ShoppingCart size={18} className="text-indigo-600" />
              <h3 className="font-semibold">Ringkasan Order</h3>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Item</span>
                <span>{orderId && latestOrderItems.length > 0 ? summaryItems.reduce((sum, item) => sum + item.quantity, 0) : totalItems}</span>
              </div>

              {summaryItems.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{orderId ? 'Detail pesanan Anda' : 'Rincian order'}</p>
                  {summaryItems.map(item => (
                    <div key={`${item.id}-${item.name}`} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-700">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                      <span className="font-semibold text-gray-900">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-400">
                  Belum ada produk yang dipilih.
                </div>
              )}

              <div className="flex justify-between">
                <span>{hasActiveOrder ? 'Total pesanan' : 'Subtotal'}</span>
                <span className="font-semibold text-gray-900">{formatRupiah(summaryTotal)}</span>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Metode bayar</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'qris'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                        paymentMethod === method
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method === 'cash' ? 'Tunai' : 'QRIS'}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'qris' && (
                <div className="rounded-xl border border-indigo-200 bg-white p-3">
                  {qrisImageUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrisImageUrl} alt="QRIS pembayaran" className="w-32 h-32 object-contain rounded-xl border border-gray-200 bg-white" />
                      <p className="text-center text-[11px] text-gray-600">
                        Bayar sebesar <span className="font-semibold text-gray-900">{formatRupiah(summaryTotal)}</span>
                      </p>
                      <p className="text-center text-[10px] text-amber-700 font-medium">
                        Setelah bayar, tunggu konfirmasi kasir untuk melanjutkan proses pesanan.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-700">
                      QRIS belum diatur oleh pemilik toko.
                    </div>
                  )}
                </div>
              )}

              {hasOrderRecord && liveOrderStatus && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Status pesanan: <span className="font-semibold">{orderStatusMeta[liveOrderStatus].label}</span>
                </div>
              )}
            </div>

            {hasActiveOrder && orderStatus === 'pending' ? (
              <button
                onClick={cancelOrder}
                className="w-full mt-3 bg-red-50 text-red-600 border border-red-200 rounded-xl py-3 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                Batal / Hapus Order
              </button>
            ) : null}

            {!hasActiveOrder || orderStatus === 'done' ? (
              <button
                onClick={submitOrder}
                disabled={submitting || totalItems === 0 || !!orderId}
                className="w-full mt-5 bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors"
              >
                {submitting ? 'Mengirim...' : orderId ? 'Order sudah dikirim' : `Kirim ke kasir • ${formatRupiah(subtotal)}`}
              </button>
            ) : null}

            {hasActiveOrder && orderStatus && orderStatus !== 'pending' && orderStatus !== 'done' && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Order sedang diproses oleh kasir, pembatalan tidak tersedia.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
