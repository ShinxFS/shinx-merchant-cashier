'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateInvoice } from '@/lib/utils'
import ProductCard from '@/components/cashier/ProductCard'
import CartItem, { CartItemType } from '@/components/cashier/CartItem'
import PaymentModal from '@/components/cashier/PaymentModal'
import ReceiptModal from '@/components/cashier/ReceiptModal'
import { Search, ShoppingCart, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface Product {
  id: string
  name: string
  price: number
  cost_price?: number
  stock: number
  image_url: string | null
  categories?: { name: string; color: string } | null
}

export default function CashierPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItemType[]>([])
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [receiptData, setReceiptData] = useState<any>(null)
  const [cartVisible, setCartVisible] = useState(true)
  const [effectiveUserId, setEffectiveUserId] = useState<string>('')
  const [businessProfile, setBusinessProfile] = useState({
    business_name: 'Toko',
    address: '',
    phone: '',
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cek role — kalau karyawan, pakai owner_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, owner_id')
        .eq('id', user.id)
        .single()

      const isStaff = profile?.role === 'staff'
      const targetUserId = isStaff ? (profile?.owner_id ?? user.id) : user.id
      setEffectiveUserId(targetUserId)

      // Load produk milik owner
      const { data } = await supabase
        .from('products')
        .select('*, categories(name, color)')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .order('name')
      setProducts(data ?? [])
      setFiltered(data ?? [])

      // Load profil owner
      const { data: prof } = await supabase
        .from('profiles')
        .select('business_name, address, phone')
        .eq('id', targetUserId)
        .single()
      if (prof) setBusinessProfile(prof)
    }
    load()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(products.filter(p => p.name.toLowerCase().includes(q)))
  }, [search, products])

  const addToCart = (product: Product) => {
    setCart(prev => {
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

  const increase = (id: string) => setCart(prev =>
    prev.map(i => i.id === id && i.quantity < i.stock ? { ...i, quantity: i.quantity + 1 } : i)
  )
  const decrease = (id: string) => setCart(prev =>
    prev.map(i => i.id === id && i.quantity > 1 ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0)
  )
  const remove = (id: string) => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => setCart([])

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

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

    // Simpan transaksi dengan effectiveUserId (owner punya karyawan)
    const { data: tx, error } = await supabase
      .from('transactions')
      .insert({
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
      })
      .select()
      .single()

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
    })

    setCart([])
    setShowPayment(false)
    setPaymentLoading(false)
  }

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="flex h-full relative">

      {/* Kiri: Produk */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            />
          </div>
        </div>

        {successMsg && (
          <div className="mx-4 mt-3 bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg border border-green-200">
            {successMsg}
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
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-indigo-600" />
              <span className="font-bold text-gray-800">Keranjang</span>
              {cart.length > 0 && (
                <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 size={13} /> Kosongkan
              </button>
            )}
          </div>

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

      {showPayment && (
        <PaymentModal
          subtotal={subtotal}
          onConfirm={handlePayment}
          onClose={() => setShowPayment(false)}
          loading={paymentLoading}
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