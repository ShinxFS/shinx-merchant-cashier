'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Plus, Trash2, QrCode, Upload } from 'lucide-react'

interface Category {
  id: string
  name: string
  color: string
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    address: '',
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qrisUrl, setQrisUrl] = useState<string | null>(null)
  const [qrisUploading, setQrisUploading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prof }, { data: cats }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      ])
      if (prof) {
        setProfile({
          business_name: prof.business_name ?? '',
          owner_name: prof.owner_name ?? '',
          phone: prof.phone ?? '',
          address: prof.address ?? '',
        })
        setQrisUrl(prof.qris_image_url ?? null)
      }
      setCategories(cats ?? [])
    }
    load()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update(profile).eq('id', user.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleUploadQris = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar.')
      return
    }
    setQrisUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQrisUploading(false); return }

    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/qris-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true })
    if (upErr) { alert('Gagal mengunggah QRIS.'); setQrisUploading(false); return }

    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
    await supabase.from('profiles').update({ qris_image_url: pub.publicUrl }).eq('id', user.id)
    setQrisUrl(pub.publicUrl)
    setQrisUploading(false)
  }

  const handleRemoveQris = async () => {
    if (!confirm('Hapus gambar QRIS?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ qris_image_url: null }).eq('id', user.id)
    setQrisUrl(null)
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: newCatName.trim(), color: newCatColor })
      .select()
      .single()
    if (data) { setCategories(prev => [...prev, data]); setNewCatName('') }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Hapus kategori ini?')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Pengaturan</h1>

      {/* Profil Toko */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Profil Toko</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">

          {saved && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg border border-green-200">
              ✅ Perubahan berhasil disimpan!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bisnis</label>
            <input
              value={profile.business_name}
              onChange={e => setProfile(p => ({ ...p, business_name: e.target.value }))}
              placeholder="Toko Shinx"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik</label>
            <input
              value={profile.owner_name}
              onChange={e => setProfile(p => ({ ...p, owner_name: e.target.value }))}
              placeholder="Nama pemilik toko"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon</label>
            <input
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="08xxxxxxxxxx"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <textarea
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              rows={3}
              placeholder="Alamat lengkap toko"
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save size={15} />
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>

      {/* QRIS Pembayaran */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <QrCode size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-800">QRIS Pembayaran</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Unggah gambar QRIS toko. Akan tampil di kasir saat metode bayar QRIS dipilih.
        </p>

        {qrisUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrisUrl}
              alt="QRIS Toko"
              className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white"
            />
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer transition-colors w-fit">
                <Upload size={15} />
                {qrisUploading ? 'Mengunggah...' : 'Ganti Gambar'}
                <input type="file" accept="image/*" onChange={handleUploadQris} disabled={qrisUploading} className="hidden" />
              </label>
              <button
                onClick={handleRemoveQris}
                className="flex items-center gap-2 text-red-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors w-fit"
              >
                <Trash2 size={15} />
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
            <Upload size={22} className="text-gray-400" />
            <span className="text-sm text-gray-500 font-medium">
              {qrisUploading ? 'Mengunggah...' : 'Klik untuk unggah gambar QRIS'}
            </span>
            <span className="text-xs text-gray-400">PNG / JPG</span>
            <input type="file" accept="image/*" onChange={handleUploadQris} disabled={qrisUploading} className="hidden" />
          </label>
        )}
      </div>

      {/* Kategori */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Kategori Produk</h2>

        <div className="flex gap-2 mb-4">
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            placeholder="Nama kategori baru..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} /> Tambah
          </button>
        </div>

        {/* Pilih warna */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setNewCatColor(color)}
              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${newCatColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Belum ada kategori</p>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-gray-700">{cat.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}