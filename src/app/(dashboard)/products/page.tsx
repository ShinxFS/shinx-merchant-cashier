'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { useRole } from '@/lib/useRole'
import { Plus, Pencil, Trash2, Package, Search, Download, Upload } from 'lucide-react'
import ProductFormModal from '@/components/products/ProductFormModal'

interface Category {
  id: string
  name: string
  color: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  price: number
  cost_price: number
  stock: number
  unit: string
  image_url: string | null
  is_active: boolean
  category_id: string | null
  category_id_2: string | null
  category?: Category | null
  category2?: Category | null
}

export default function ProductsPage() {
  const supabase = createClient()
  const { isOwner } = useRole()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from('products')
        .select('*, category:categories!category_id(id, name, color), category2:categories!category_id_2(id, name, color)')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
    ])

    setProducts(prods ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const handleEdit = (product: Product) => {
    setEditProduct(product)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditProduct(null)
    load()
  }

  // ==========================================
  // LOGIKA EXPORT TO CSV (DENGAN GAMBAR)
  // ==========================================
  const exportToCSV = () => {
    if (products.length === 0) return alert("Belum ada data produk untuk di-export.")

    // Struktur header menyertakan gambar_url di akhir kolom
    const headers = ['nama_produk', 'sku_barcode', 'harga_modal', 'harga_jual', 'stok', 'satuan', 'gambar_url']
    const csvRows = [headers.join(',')]

    products.forEach(p => {
      const safeName = p.name.replace(/,/g, ' ')
      const safeSku = (p.sku || '').replace(/,/g, ' ')
      const safeUnit = (p.unit || 'pcs').replace(/,/g, ' ')
      const safeImageUrl = (p.image_url || '').replace(/,/g, ' ')
      
      const row = [
        safeName,
        safeSku,
        p.cost_price || 0,
        p.price || 0,
        p.stock || 0,
        safeUnit,
        safeImageUrl
      ]
      csvRows.push(row.join(','))
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "shinx_template_produk_lengkap.csv")
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ==========================================
  // LOGIKA IMPORT FROM CSV (DENGAN GAMBAR)
  // ==========================================
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').map(line => line.trim()).filter(line => line)
      
      const dataLines = lines.slice(1) // Lewati baris header
      if (dataLines.length === 0) return alert("File CSV kosong atau format salah.")

      setLoading(true)
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("User tidak terautentikasi")

        const productsToInsert = dataLines.map(line => {
          const [name, sku, cost_price, price, stock, unit, gambar_url] = line.split(',')

          return {
            user_id: user.id,
            name: name?.trim(),
            sku: sku?.trim() || null,
            cost_price: parseFloat(cost_price) || 0,
            price: parseFloat(price) || 0,
            stock: parseInt(stock) || 0,
            unit: unit?.trim() || 'pcs',
            image_url: gambar_url?.trim() || null, // Memetakan link gambar secara otomatis
            is_active: true,
            category_id: null,
            category_id_2: null
          }
        }).filter(p => p.name) 

        if (productsToInsert.length === 0) throw new Error("Tidak ada data produk valid untuk dimasukkan.")

        const { error } = await supabase
          .from('products')
          .insert(productsToInsert)

        if (error) throw error

        alert(`Berhasil mengimpor ${productsToInsert.length} produk beserta gambarnya!`)
        load()

      } catch (err: any) {
        alert("Gagal mengimpor produk: " + err.message)
      } finally {
        setLoading(false)
        if (fileInputRef.current) fileInputRef.current.value = '' 
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Produk</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} produk terdaftar</p>
        </div>
        
        {/* Kontainer Tombol Aksi */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Tombol Export bisa diakses oleh Owner maupun Staff */}
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>

          {/* Tombol Import & Tambah Produk diproteksi hanya untuk Owner */}
          {isOwner && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportCSV} 
                accept=".csv" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
             // bg-indigo-50 diganti menjadi bg-white border border-gray-200
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
>
               <Upload size={16} />
                Import CSV
              </button>

              <button
                onClick={() => { setEditProduct(null); setShowModal(true) }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} />
                Tambah Produk
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau SKU..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* Notifikasi stok menipis */}
      {products.filter(p => p.stock <= 5 && p.stock > 0).length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-orange-700 mb-1">⚠️ Stok Menipis</p>
          <div className="flex flex-wrap gap-2">
            {products.filter(p => p.stock <= 5 && p.stock > 0).map(p => (
              <span key={p.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg">
                {p.name} — sisa {p.stock} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notifikasi stok habis */}
      {products.filter(p => p.stock === 0).length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-1">🚫 Stok Habis</p>
          <div className="flex flex-wrap gap-2">
            {products.filter(p => p.stock === 0).map(p => (
              <span key={p.id} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabel */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuat produk...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {products.length === 0 ? 'Belum ada produk. Tambah produk pertama kamu!' : 'Produk tidak ditemukan'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Produk</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Kategori</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Harga</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Stok</th>
                {isOwner && (
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.image_url
                          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          : <span className="text-lg">🛍️</span>
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{product.name}</p>
                        {product.sku && <p className="text-xs text-gray-400">{product.sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {product.category || product.category2 ? (
                      <div className="flex flex-wrap gap-1">
                        {[product.category, product.category2]
                          .filter((c): c is Category => !!c)
                          .map(c => (
                            <span
                              key={c.id}
                              className="text-xs px-2 py-1 rounded-lg font-medium"
                              style={{
                                backgroundColor: c.color + '20',
                                color: c.color,
                              }}
                            >
                              {c.name}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold text-gray-800">{formatRupiah(product.price)}</p>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className={`text-sm font-medium ${product.stock <= 5 ? 'text-red-500' : 'text-gray-700'}`}>
                      {product.stock} {product.unit}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}