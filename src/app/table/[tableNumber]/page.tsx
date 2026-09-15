'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Minus, Plus, ShoppingCart, CheckCircle2, AlertCircle, Wallet, X } from 'lucide-react'

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
  const [latestOrderNote, setLatestOrderNote] = useState('')
  const [latestOrderCreatedAt, setLatestOrderCreatedAt] = useState<string | null>(null)
  const [customerNote, setCustomerNote] = useState('')
  const [showPaymentSummary, setShowPaymentSummary] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastStatusRef = useRef<'pending' | 'processing' | 'ready' | 'done' | null>(null)
  const lastOrderIdRef = useRef<string | null>(null)
  const hasUserInteractionRef = useRef(false)
  const orderDetailUserOverrideRef = useRef(false)

  const unlockAudio = async () => {
    if (hasUserInteractionRef.current) return

    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
        const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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

    const preferredSource = customerSoundUrl || '/sounds/pelanggan.wav'

    try {
      void unlockAudio()
      const audio = new Audio(preferredSource)
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

    const pickLatestTableOrder = (rows: Array<{ id?: string; status?: 'pending' | 'processing' | 'ready' | 'done'; items?: unknown; total?: number; payment_method?: 'cash' | 'qris'; note?: string; updated_at?: string; created_at?: string }>) => {
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
      const { data, error: orderError } = await supabase
        .from('table_orders')
        .select('id, status, table_number, items, total, payment_method, note, updated_at, created_at')
        .eq('user_id', ownerId)
        .eq('table_number', tableNumber)
        .order('updated_at', { ascending: false })

      if (orderError) {
        setError('Status pesanan belum bisa dimuat. Periksa koneksi atau policy table_orders di Supabase.')
        return
      }

      const latest = pickLatestTableOrder((data ?? []) as Array<{ id?: string; status?: 'pending' | 'processing' | 'ready' | 'done'; items?: unknown; total?: number; payment_method?: 'cash' | 'qris'; note?: string; updated_at?: string; created_at?: string }>)

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
        setLatestOrderNote(latest.note?.split(' — ').slice(1).join(' — ') ?? '')
        setLatestOrderCreatedAt(latest.created_at ?? null)

        if (nextStatus === 'done') {
          orderDetailUserOverrideRef.current = false
          setShowOrderDetail(false)
        } else if (!orderDetailUserOverrideRef.current) {
          setShowOrderDetail(Boolean(latest.id))
        }
      } else {
        setOrderId(null)
        setOrderStatus(null)
        lastStatusRef.current = null
        lastOrderIdRef.current = null
        setLatestOrderItems([])
        setLatestOrderTotal(0)
        setLatestOrderNote('')
        setLatestOrderCreatedAt(null)
        orderDetailUserOverrideRef.current = false
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
  const canCancelOrder = Boolean(liveOrderStatus === 'pending')
  const isOrderLocked = Boolean(hasActiveOrder && liveOrderStatus && liveOrderStatus !== 'done' && liveOrderStatus !== 'pending')
  const canShowPaymentButton = !hasOrderRecord && !isOrderLocked && totalItems > 0
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
      label: 'Menunggu konfirmasi',
      className: 'bg-amber-100 text-amber-700 border border-amber-200 shadow-[0_0_0_4px_rgba(251,191,36,0.12)] animate-pulse',
    },
    processing: { label: 'Sedang diproses', className: 'bg-blue-100 text-blue-700 border border-blue-200 shadow-[0_0_0_4px_rgba(59,130,246,0.12)] animate-pulse' },
    ready: { label: 'Sudah siap', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] animate-pulse' },
    done: { label: 'Selesai', className: 'bg-slate-200 text-slate-700 border border-slate-300' },
  }

  const addItem = (product: Product) => {
    if (isOrderLocked) return

    setCart(prev => {
      const qty = prev[product.id] ?? 0
      if (product.stock <= 0) return prev
      if (qty >= product.stock) return prev
      return { ...prev, [product.id]: qty + 1 }
    })
  }

  const removeItem = (product: Product) => {
    if (isOrderLocked) return

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
    if (isOrderLocked) {
      setError('Order yang sedang aktif tidak bisa diubah. Tunggu proses selesai dulu.')
      return
    }

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

    const trimmedNote = customerNote.trim()
    const qrText = paymentMethod === 'qris'
      ? `Order via QR Meja ${tableNumber} - menunggu konfirmasi pembayaran QRIS`
      : `Order via QR Meja ${tableNumber}`
    const noteText = trimmedNote ? `${qrText} — ${trimmedNote}` : qrText

    const payload = {
      user_id: ownerId,
      table_number: tableNumber,
      customer_name: `Pelanggan Meja ${tableNumber}`,
      total: subtotal,
      status: 'pending',
      items: orderItems,
      note: noteText,
      payment_method: paymentMethod,
    }

    let createdOrderId: string | null = null

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
          note: noteText,
        })
        .select('id')
        .single()

      if (fallback.error || !fallback.data) {
        setError('Gagal mengirim order. Coba ulang sebentar lagi.')
        setSubmitting(false)
        return
      }

      createdOrderId = fallback.data.id ?? null
    } else {
      createdOrderId = data?.id ?? null
    }

    setOrderId(createdOrderId)
    setCart({})
    setOrderStatus('pending')
    setLatestOrderItems(orderItems)
    setLatestOrderTotal(subtotal)
    setLatestOrderNote(trimmedNote)
    setLatestOrderCreatedAt(new Date().toISOString())
    setCustomerNote('')
    orderDetailUserOverrideRef.current = false
    setShowOrderDetail(true)
    setSuccess(
      paymentMethod === 'qris'
        ? `✅ Pesanan meja ${tableNumber} diterima. Bayar via QRIS dulu, lalu tunggu konfirmasi kasir.`
        : `✅ Pesanan meja ${tableNumber} berhasil dikirim ke kasir.`
    )
    setSubmitting(false)
  }

  const cancelOrder = async () => {
    if (!canCancelOrder) {
      setError('Order sudah diproses oleh kasir, pembatalan tidak tersedia.')
      return
    }

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
    orderDetailUserOverrideRef.current = false
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
                  onClick={() => {
                    orderDetailUserOverrideRef.current = true
                    setShowOrderDetail(value => !value)
                  }}
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
                <p className="text-sm font-semibold text-indigo-800">Rincian Order</p>
                <span className="text-xs font-medium text-indigo-600">{orderStatusMeta[liveOrderStatus].label}</span>
              </div>

              {latestOrderCreatedAt && (
                <div className="mb-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[11px] text-indigo-800">
                  <span className="font-semibold">Waktu order:</span>{' '}
                  {new Date(latestOrderCreatedAt).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </div>
              )}

              <div className="rounded-lg border border-indigo-200 bg-white p-3">
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
              </div>

              {latestOrderNote && (
                <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-800 break-words whitespace-pre-wrap">
                  <span className="font-semibold">Catatan:</span> {latestOrderNote}
                </div>
              )}

              <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 flex items-center justify-between text-sm font-semibold text-indigo-900">
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
                            <span className="font-bold text-indigo-600">{formatRupiah(product.price)}</span>
                            <span className="text-xs font-medium text-red-500">Stok habis</span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="font-bold text-indigo-600">{formatRupiah(product.price)}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeItem(product)}
                                disabled={isOrderLocked}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isOrderLocked
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                aria-label={`Kurangi ${product.name}`}
                              >
                                <Minus size={15} />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold text-gray-800">{qty}</span>
                              <button
                                onClick={() => addItem(product)}
                                disabled={isOrderLocked}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isOrderLocked
                                    ? 'bg-indigo-300 text-white cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
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

              {!hasActiveOrder && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Catatan untuk kasir
                  </label>
                  <textarea
                    value={customerNote}
                    onChange={e => setCustomerNote(e.target.value.slice(0, 200))}
                    rows={3}
                    maxLength={200}
                    placeholder="Contoh: tidak pedas, tolong dipisah pakai wadah"
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 overflow-y-auto break-words"
                  />
                </div>
              )}

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

            {canCancelOrder ? (
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

      {/* Floating Payment Button */}
      {canShowPaymentButton && (
        <button
          onClick={() => setShowPaymentSummary(true)}
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 px-5 py-3"
        >
          <Wallet size={20} />
          <span className="font-semibold text-sm">{formatRupiah(summaryTotal)}</span>
        </button>
      )}

      {/* Payment Summary Bottom Sheet */}
      {showPaymentSummary && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPaymentSummary(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4 mb-2 max-h-[85vh] overflow-y-auto shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Ringkasan Pembayaran</h3>
              <button
                onClick={() => setShowPaymentSummary(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Rincian Order */}
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Rincian Order
                </p>
                <div className="space-y-2">
                  {summaryItems.map(item => (
                    <div key={`${item.id}-${item.name}`} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-700">
                        {item.name} <span className="text-gray-400">x{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-gray-900">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rincian Harga */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-700">{formatRupiah(summaryTotal)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-1">
                  <span className="text-gray-800">Total</span>
                  <span className="text-indigo-700">{formatRupiah(summaryTotal)}</span>
                </div>
              </div>

              {/* Metode Bayar */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Metode Bayar</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'qris'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(method)
                      }}
                      className={`rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${
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

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Catatan untuk kasir
                </label>
                <textarea
                  value={customerNote}
                  onChange={e => setCustomerNote(e.target.value.slice(0, 200))}
                  rows={3}
                  maxLength={200}
                  placeholder="Contoh: tidak pedas, tolong dipisah pakai wadah"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 overflow-y-auto break-words"
                />
              </div>

              {/* QRIS */}
              {paymentMethod === 'qris' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Scan QRIS</p>
                  {qrisImageUrl ? (
                    <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrisImageUrl}
                        alt="QRIS Pembayaran"
                        className="w-48 h-48 object-contain rounded-lg bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-3">Scan & bayar sejumlah</p>
                      <p className="text-lg font-bold text-indigo-700">{formatRupiah(summaryTotal)}</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                      <p className="text-sm text-amber-700 font-medium">QRIS belum diatur</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Unggah gambar QRIS di menu Pengaturan terlebih dahulu.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Pesanan */}
              {hasOrderRecord && liveOrderStatus && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Status pesanan: <span className="font-semibold">{orderStatusMeta[liveOrderStatus].label}</span>
                </div>
              )}
            </div>

            {/* Tombol Bayar */}
            <div className="px-5 pb-5">
              <button
                onClick={() => {
                  setShowPaymentSummary(false)
                  submitOrder()
                }}
                disabled={submitting || totalItems === 0 || isOrderLocked}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Memproses...'
                  : isOrderLocked
                    ? 'Order sedang diproses'
                    : paymentMethod === 'qris'
                      ? `Bayar ${formatRupiah(summaryTotal)} via QRIS`
                      : `Bayar ${formatRupiah(summaryTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
