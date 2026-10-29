'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import { useRole } from '@/lib/useRole'
import { Plus, Pencil, Trash2, Package, PackagePlus, Search, Download, Upload, X, Grid2X2, List } from 'lucide-react'
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
  const localizedLanguage = useLanguage().language

  const supabase = createClient()
  const { formatCurrency } = useCurrency()
  const { isOwner } = useRole()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [compactView, setCompactView] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockQuantity, setRestockQuantity] = useState('')
  const [restockLoading, setRestockLoading] = useState(false)
  const [restockError, setRestockError] = useState('')

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadError(translateText("Sesi login tidak ditemukan. Silakan masuk kembali.", localizedLanguage))
      setLoading(false)
      return
    }

    const [{ data: prods, error: productsError }, { data: cats }] = await Promise.all([
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

    if (productsError) {
      setLoadError(productsError.message)
      setLoading(false)
      return
    }

    setLoadError('')
    setProducts(prods ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const productCategories = Array.from(
    new Map(
      products
        .flatMap(product => [product.category, product.category2])
        .filter((category): category is Category => !!category)
        .map(category => [category.id, category])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const filtered = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      !!product.sku?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      activeCategory === 'all' ||
      product.category_id === activeCategory ||
      product.category_id_2 === activeCategory
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'low' && product.stock > 0 && product.stock <= 5) ||
      (stockFilter === 'out' && product.stock <= 0)

    return matchesSearch && matchesCategory && matchesStock
  })

  const handleDelete = async (id: string) => {
    if (!confirm(translateText("Hapus produk ini?", localizedLanguage))) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const handleRestock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!restockProduct) return

    const quantity = Number(restockQuantity)
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setRestockError(translateText("Masukkan jumlah restock berupa bilangan bulat lebih dari 0.", localizedLanguage))
      return
    }

    setRestockLoading(true)
    setRestockError('')
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', restockProduct.id)
      .single()

    if (fetchError || !currentProduct) {
      setRestockError(translateText("Gagal mengambil stok terbaru. Coba lagi.", localizedLanguage))
      setRestockLoading(false)
      return
    }

    const updatedStock = currentProduct.stock + quantity
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: updatedStock })
      .eq('id', restockProduct.id)

    if (updateError) {
      setRestockError(translateText("Gagal menyimpan stok. Coba lagi.", localizedLanguage))
      setRestockLoading(false)
      return
    }

    setProducts(prev => prev.map(product =>
      product.id === restockProduct.id ? { ...product, stock: updatedStock } : product
    ))
    setRestockProduct(null)
    setRestockQuantity('')
    setRestockLoading(false)
  }

  const closeRestockModal = () => {
    setRestockProduct(null)
    setRestockQuantity('')
    setRestockError('')
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
    if (products.length === 0) return alert(translateText("Belum ada data produk untuk di-export.", localizedLanguage))

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
      if (dataLines.length === 0) return alert(translateText("File CSV kosong atau format salah.", localizedLanguage))

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

        alert(`${translateText("Berhasil mengimpor ", localizedLanguage)}${productsToInsert.length}${translateText(" produk beserta gambarnya!", localizedLanguage)}`)
        load()

      } catch (err: any) {
        alert(translateText("Gagal mengimpor produk: ", localizedLanguage) + err.message)
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
          <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Produk"} />}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} {<LocalizedText text={" produk terdaftar"} />}</p>
        </div>
        
        {/* Kontainer Tombol Aksi */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setCompactView(value => !value)}
            aria-label={translateText(compactView ? 'Tampilan Tabel' : 'Tampilan Ringkas', localizedLanguage)}
            title={translateText(compactView ? 'Tampilan Tabel' : 'Tampilan Ringkas', localizedLanguage)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            {compactView ? <List size={16} /> : <Grid2X2 size={16} />}
            <span className="hidden sm:inline">
              <LocalizedText text={compactView ? 'Tampilan Tabel' : 'Tampilan Ringkas'} />
            </span>
          </button>

          {/* Tombol Export bisa diakses oleh Owner maupun Staff */}
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            {<LocalizedText text={"\r\n            Export CSV\r\n          "} />}</button>

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
                {<LocalizedText text={"\r\n                Import CSV\r\n              "} />}</button>

              <button
                onClick={() => { setEditProduct(null); setShowModal(true) }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} />
                {<LocalizedText text={"\r\n                Tambah Produk\r\n              "} />}</button>
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
          placeholder={translateText("Cari nama atau SKU...", localizedLanguage)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {products.length > 0 && (
        <div className="scrollbar-thin mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            aria-pressed={activeCategory === 'all'}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LocalizedText text="Semua" />
          </button>
          <button
            type="button"
            onClick={() => setStockFilter(value => value === 'out' ? 'all' : 'out')}
            aria-pressed={stockFilter === 'out'}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              stockFilter === 'out'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stockFilter === 'out' ? 'bg-red-500' : 'bg-gray-400'}`} />
            <LocalizedText text="Stok Habis" />
          </button>
          <button
            type="button"
            onClick={() => setStockFilter(value => value === 'low' ? 'all' : 'low')}
            aria-pressed={stockFilter === 'low'}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              stockFilter === 'low'
                ? 'border-orange-300 bg-orange-50 text-orange-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stockFilter === 'low' ? 'bg-orange-500' : 'bg-gray-400'}`} />
            <LocalizedText text="Stok Menipis" />
          </button>
          {productCategories.length > 0 && (
            <span aria-hidden="true" className="mx-1 h-5 flex-shrink-0 border-l border-gray-200" />
          )}
          {productCategories.map(category => {
            const isActive = activeCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                aria-pressed={isActive}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? ''
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                style={isActive ? {
                  borderColor: `${category.color}80`,
                  backgroundColor: `${category.color}14`,
                  color: category.color,
                } : undefined}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: category.color || '#9ca3af' }}
                />
                {category.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Notifikasi stok menipis */}
      {products.filter(p => p.stock <= 5 && p.stock > 0).length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-orange-700 mb-1">{<LocalizedText text={"⚠️ Stok Menipis"} />}</p>
          <div className="flex flex-wrap gap-2">
            {products.filter(p => p.stock <= 5 && p.stock > 0).map(p => (
              <span key={p.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg">
                {p.name} {<LocalizedText text={" — sisa "} />}{p.stock} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notifikasi stok habis */}
      {products.filter(p => p.stock === 0).length > 0 && (
        <div className="stock-out-alert mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-1">{<LocalizedText text={"🚫 Stok Habis"} />}</p>
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
        <div className="text-center py-16 text-gray-400 text-sm">{<LocalizedText text={"Memuat produk..."} />}</div>
      ) : loadError ? (
        <div className="text-center py-16 text-sm text-red-600">
          {<LocalizedText text={"\r\n          Gagal memuat produk: "} />}{loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {products.length === 0 ? <LocalizedText text={"Belum ada produk. Tambah produk pertama kamu!"} /> : <LocalizedText text={"Produk tidak ditemukan"} />}
          </p>
        </div>
      ) : (
        compactView ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map(product => (
              <article key={product.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package size={18} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1">
                      <h2 className="truncate text-[11px] font-semibold text-gray-800 sm:text-xs" title={product.name}>{product.name}</h2>
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${product.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.is_active ? <LocalizedText text={"Aktif"} /> : <LocalizedText text={"Nonaktif"} />}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden">
                      {product.sku && <span className="hidden max-w-20 truncate text-[9px] text-gray-400 xl:block">{product.sku}</span>}
                      {[product.category, product.category2]
                        .filter((category): category is Category => !!category)
                        .map(category => (
                          <span
                            key={category.id}
                            className="max-w-16 flex-shrink-0 truncate rounded-md px-1 py-0.5 text-[9px] font-medium"
                            style={{ backgroundColor: `${category.color}20`, color: category.color }}
                          >
                            {category.name}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2.5">
                  <div className="min-w-0 text-right">
                    <p className="truncate text-[10px] font-semibold text-gray-800 sm:text-xs">{formatCurrency(product.price)}</p>
                  </div>
                  <div className="hidden flex-shrink-0 border-l border-gray-100 pl-1.5 text-right sm:block sm:pl-2">
                    <p className={`text-[10px] font-medium sm:text-xs ${product.stock <= 5 ? 'text-red-500' : 'text-gray-700'}`}>
                      {product.stock} {product.unit}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex flex-shrink-0 items-center gap-0.5 border-l border-gray-100 pl-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRestockProduct(product)
                          setRestockQuantity('')
                          setRestockError('')
                        }}
                        aria-label={`${translateText('Tambah stok ', localizedLanguage)}${product.name}`}
                        title={translateText("Restock", localizedLanguage)}
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
                      >
                        <PackagePlus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        aria-label={`${translateText('Edit ', localizedLanguage)}${product.name}`}
                        title={translateText("Edit produk", localizedLanguage)}
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        aria-label={`${translateText('Hapus ', localizedLanguage)}${product.name}`}
                        title={translateText("Hapus produk", localizedLanguage)}
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{<LocalizedText text={"Produk"} />}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">{<LocalizedText text={"Kategori"} />}</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">{<LocalizedText text={"Harga"} />}</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">{<LocalizedText text={"Stok"} />}</th>
                {isOwner && (
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">{<LocalizedText text={"Aksi"} />}</th>
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
                          : <span className="text-lg">{<LocalizedText text={"🛍️"} />}</span>
                        }
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">{product.name}</p>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${product.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {product.is_active ? <LocalizedText text={"Aktif"} /> : <LocalizedText text={"Nonaktif"} />}
                          </span>
                        </div>
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
                      <span className="text-xs text-gray-300">{<LocalizedText text={"—"} />}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(product.price)}</p>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className={`text-sm font-medium ${product.stock <= 5 ? "text-red-500" : "text-gray-700"}`}>
                      {product.stock} {product.unit}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setRestockProduct(product)
                            setRestockQuantity('')
                            setRestockError('')
                          }}
                          aria-label={`${translateText('Tambah stok ', localizedLanguage)}${product.name}`}
                          title={translateText("Restock", localizedLanguage)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <PackagePlus size={15} />
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          aria-label={`${translateText('Edit ', localizedLanguage)}${product.name}`}
                          title={translateText("Edit produk", localizedLanguage)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          aria-label={`${translateText('Hapus ', localizedLanguage)}${product.name}`}
                          title={translateText("Hapus produk", localizedLanguage)}
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
        )
      )}

      {showModal && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={handleModalClose}
        />
      )}

      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <h2 className="font-bold text-gray-900">{<LocalizedText text={"Restock Barang"} />}</h2>
              <button
                type="button"
                onClick={closeRestockModal}
                disabled={restockLoading}
                aria-label={translateText("Tutup restock barang", localizedLanguage)}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4 p-6">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">{<LocalizedText text={"Detail Produk:"} />}</p>
                <p className="mt-1 text-sm text-gray-700">{restockProduct.name}</p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{<LocalizedText text={"Jumlah saat ini"} />}</span>
                  <span>{restockProduct.stock} {restockProduct.unit}</span>
                </div>
                <div className="mt-2 flex justify-between font-semibold text-gray-900">
                  <span>{<LocalizedText text={"Jumlah setelah restock"} />}</span>
                  <span>
                    {restockProduct.stock + (Number(restockQuantity) || 0)} {restockProduct.unit}
                  </span>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                {<LocalizedText text={"\r\n                Jumlah tambahan\r\n                "} />}<input
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  value={restockQuantity}
                  onChange={e => setRestockQuantity(e.target.value)}
                  placeholder={`${translateText('Jumlah dalam ', localizedLanguage)}${restockProduct.unit}`}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              {restockError && <p className="text-sm text-red-600">{restockError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRestockModal}
                  disabled={restockLoading}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {<LocalizedText text={"\r\n                  Batal\r\n                "} />}</button>
                <button
                  type="submit"
                  disabled={restockLoading}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {restockLoading ? <LocalizedText text={"Menyimpan..."} /> : <LocalizedText text={"Simpan"} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}