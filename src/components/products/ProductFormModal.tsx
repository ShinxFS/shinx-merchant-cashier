'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, ScanLine } from 'lucide-react'
import BarcodeScanner from '@/components/cashier/BarcodeScanner'

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
}

interface Props {
  product: Product | null
  categories: Category[]
  onClose: () => void
}

// Fungsi compress gambar pakai Canvas
const compressImage = (file: File, quality = 0.75): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')

        // Max dimensi 320px
        const MAX_SIZE = 320
        let { width, height } = img
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          } else {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressed)
          },
          'image/jpeg',
          quality
        )
      }
    }
  })
}

export default function ProductFormModal({ product, categories, onClose }: Props) {
  const supabase = createClient()
  const isEdit = !!product

  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    price: product?.price ?? 0,
    cost_price: product?.cost_price ?? 0,
    stock: product?.stock ?? 0,
    unit: product?.unit ?? 'pcs',
    category_id: product?.category_id ?? '',
    category_id_2: product?.category_id_2 ?? '',
    is_active: product?.is_active ?? true,
    image_url: product?.image_url ?? '',
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(product?.image_url ?? '')
  const [loading, setLoading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState('')
  const [imageInfo, setImageInfo] = useState<{ original: string; compressed: string } | null>(null)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCompressing(true)
    const originalSize = (file.size / 1024 / 1024).toFixed(2)

    try {
      const compressed = await compressImage(file, 0.75)
      const compressedSize = (compressed.size / 1024 / 1024).toFixed(2)

      setImageFile(compressed)
      setImagePreview(URL.createObjectURL(compressed))
      setImageInfo({
        original: `${originalSize} MB`,
        compressed: `${compressedSize} MB`,
      })
    } catch {
      // Kalau gagal compress, pakai file asli
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    } finally {
      setCompressing(false)
    }
  }

  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageFile) return form.image_url || null
    const ext = 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, imageFile, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const imageUrl = await uploadImage(user.id)

    const payload = {
      name: form.name,
      sku: form.sku || null,
      price: Number(form.price),
      cost_price: Number(form.cost_price),
      stock: Number(form.stock),
      unit: form.unit,
      category_id: form.category_id || null,
      category_id_2: form.category_id_2 || null,
      is_active: form.is_active,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('products').update(payload).eq('id', product.id)
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.from('products').insert({ ...payload, user_id: user.id })
      if (error) { setError(error.message); setLoading(false); return }
    }

    setLoading(false)
    onClose()
  }

  const set = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <>
    {showScanner && (
      <BarcodeScanner
        onDetected={(code) => { set('sku', code); setShowScanner(false) }}
        onClose={() => setShowScanner(false)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{isEdit ? 'Edit Produk' : 'Tambah Produk'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Upload Gambar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {compressing ? (
                <span className="text-xs text-gray-400">Kompres...</span>
              ) : imagePreview ? (
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">🛍️</span>
              )}
            </div>
            <div>
              <label className="cursor-pointer flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-700">
                <Upload size={15} />
                {compressing ? 'Mengompres...' : 'Upload Foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={compressing}
                />
              </label>
              {imageInfo ? (
                <p className="text-xs text-green-600 mt-1">
                  ✅ {imageInfo.original} → {imageInfo.compressed}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">JPG, PNG — otomatis dikompres</p>
              )}
            </div>
          </div>

          {/* Nama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Contoh: Kopi Hitam"
              className={inputClass}
            />
          </div>

          {/* SKU / Barcode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU / Barcode <span className="text-gray-400">(opsional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                value={form.sku}
                onChange={e => set('sku', e.target.value)}
                placeholder="Ketik manual atau scan"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                title="Scan barcode"
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <ScanLine size={16} />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
          </div>

          {/* Harga */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual *</label>
              <input
                required
                type="number"
                min={0}
                value={form.price}
                onChange={e => set('price', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga Modal</label>
              <input
                type="number"
                min={0}
                value={form.cost_price}
                onChange={e => set('cost_price', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Stok & Satuan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stok *</label>
              <input
                required
                type="number"
                min={0}
                value={form.stock}
                onChange={e => set('stock', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
              <select
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className={inputClass}
              >
                {['pcs', 'cup', 'porsi', 'lusin', 'kg', 'gram', 'liter', 'botol', 'pack', 'box'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Kategori (bisa sampai 2) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori 1</label>
              <select
                value={form.category_id}
                onChange={e => {
                  const val = e.target.value
                  set('category_id', val)
                  // Kalau kategori 2 jadi sama dgn kategori 1, kosongkan kategori 2
                  if (val && val === form.category_id_2) set('category_id_2', '')
                }}
                className={inputClass}
              >
                <option value="">— Tanpa Kategori —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori 2 <span className="text-gray-400">(opsional)</span>
              </label>
              <select
                value={form.category_id_2}
                onChange={e => set('category_id_2', e.target.value)}
                disabled={!form.category_id}
                className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
              >
                <option value="">— Tanpa Kategori —</option>
                {categories
                  .filter(c => c.id !== form.category_id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Produk aktif (tampil di kasir)
            </label>
          </div>

          {/* Tombol */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || compressing}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Menyimpan...' : compressing ? 'Mengompres...' : isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}