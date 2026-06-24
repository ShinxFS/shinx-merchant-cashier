'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import {
  calcManufaktur, calcRetail, calcJasa, recommendPrice,
  type BusinessType,
} from '@/lib/hpp'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
  Calculator, RotateCcw, Save, Trash2, FileSpreadsheet, Factory, Store, Wrench,
} from 'lucide-react'

interface SavedProduct {
  id: string
  business_type: BusinessType
  product_name: string
  product_code: string | null
  category: string | null
  units: number
  inputs: Record<string, string>
  total_cost: number
  hpp_per_unit: number
  break_even_point: number
  target_margin: number
  min_price: number
  recommended_price: number
  created_at: string
}

type FieldKind = 'text' | 'number' | 'select'
interface FieldDef { key: string; label: string; kind?: FieldKind; options?: string[]; placeholder?: string }
interface GroupDef { title: string; fields: FieldDef[] }

interface TypeConfig {
  label: string
  icon: typeof Factory
  unitKey: string          // field pembagi (jumlah unit / layanan)
  identity: FieldDef[]      // field non-biaya
  groups: GroupDef[]        // kelompok komponen biaya (semua numerik)
}

const MANUFAKTUR_CATEGORIES = ['Makanan & Minuman', 'Fashion', 'Kerajinan', 'Lainnya']

const CONFIG: Record<BusinessType, TypeConfig> = {
  manufaktur: {
    label: 'Manufaktur',
    icon: Factory,
    unitKey: 'units',
    identity: [
      { key: 'product_name', label: 'Nama Produk', kind: 'text', placeholder: 'Contoh: Keripik Singkong' },
      { key: 'product_code', label: 'SKU / Kode Produk', kind: 'text', placeholder: 'Opsional' },
      { key: 'category', label: 'Kategori', kind: 'select', options: MANUFAKTUR_CATEGORIES },
      { key: 'units', label: 'Jumlah Unit Produksi', kind: 'number', placeholder: '1' },
    ],
    groups: [
      { title: 'Bahan Baku Langsung', fields: [
        { key: 'bahanUtama', label: 'Bahan Baku Utama' },
        { key: 'bahanPendukung', label: 'Bahan Pendukung' },
        { key: 'kemasan', label: 'Kemasan' },
      ] },
      { title: 'Tenaga Kerja Langsung', fields: [
        { key: 'upahProduksi', label: 'Upah Produksi' },
        { key: 'bonus', label: 'Bonus / Insentif' },
      ] },
      { title: 'Biaya Overhead', fields: [
        { key: 'listrik', label: 'Listrik & Utilitas' },
        { key: 'lainnya', label: 'Biaya Lainnya' },
      ] },
    ],
  },
  retail: {
    label: 'Perdagangan / Retail',
    icon: Store,
    unitKey: 'units',
    identity: [
      { key: 'product_name', label: 'Nama Produk', kind: 'text', placeholder: 'Contoh: Kaos Polos' },
      { key: 'product_code', label: 'SKU / Kode Produk', kind: 'text', placeholder: 'Opsional' },
      { key: 'supplier', label: 'Supplier', kind: 'text', placeholder: 'Opsional' },
      { key: 'units', label: 'Jumlah Unit', kind: 'number', placeholder: '1' },
    ],
    groups: [
      { title: 'Biaya Pembelian', fields: [
        { key: 'hargaBeliSatuan', label: 'Harga Beli Satuan' },
        { key: 'diskon', label: 'Diskon Pembelian (total)' },
      ] },
      { title: 'Biaya Tambahan', fields: [
        { key: 'ongkir', label: 'Ongkos Kirim' },
        { key: 'biayaImport', label: 'Biaya Import / Bea' },
        { key: 'penyimpanan', label: 'Biaya Penyimpanan' },
        { key: 'lainnya', label: 'Biaya Lainnya' },
      ] },
    ],
  },
  jasa: {
    label: 'Servis / Jasa',
    icon: Wrench,
    unitKey: 'jumlahLayanan',
    identity: [
      { key: 'product_name', label: 'Nama Layanan', kind: 'text', placeholder: 'Contoh: Servis AC' },
      { key: 'product_code', label: 'Kode Layanan', kind: 'text', placeholder: 'Opsional' },
      { key: 'durasi', label: 'Durasi (menit)', kind: 'number', placeholder: 'Opsional' },
      { key: 'jumlahLayanan', label: 'Jumlah Layanan', kind: 'number', placeholder: '1' },
    ],
    groups: [
      { title: 'Tenaga Kerja', fields: [
        { key: 'upah', label: 'Upah Teknisi / Staff' },
        { key: 'komisi', label: 'Komisi' },
      ] },
      { title: 'Material & Supplies', fields: [
        { key: 'material', label: 'Bahan / Material' },
        { key: 'peralatan', label: 'Peralatan Sekali Pakai' },
      ] },
      { title: 'Biaya Operasional', fields: [
        { key: 'listrik', label: 'Listrik & Utilitas' },
        { key: 'lainnya', label: 'Biaya Lainnya' },
      ] },
    ],
  },
}

const TYPE_ORDER: BusinessType[] = ['manufaktur', 'retail', 'jasa']

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

const calcFor = (type: BusinessType, form: Record<string, string>) =>
  type === 'manufaktur' ? calcManufaktur(form)
    : type === 'retail' ? calcRetail(form)
      : calcJasa(form)

export default function HppPage() {
  const supabase = createClient()
  const [businessType, setBusinessType] = useState<BusinessType>('manufaktur')
  const [form, setForm] = useState<Record<string, string>>({})
  const [margin, setMargin] = useState(20)
  const [saved, setSaved] = useState<SavedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const config = CONFIG[businessType]

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('hpp_products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSaved((data as SavedProduct[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const result = useMemo(() => calcFor(businessType, form), [businessType, form])
  const price = useMemo(() => recommendPrice(result.hppPerUnit, margin), [result.hppPerUnit, margin])

  const setField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const resetForm = () => { setForm({}); setMargin(20) }

  // Kumpulkan field biaya + identitas non-kolom ke dalam jsonb `inputs`.
  const collectInputs = (): Record<string, string> => {
    const keys = new Set<string>()
    config.groups.forEach(g => g.fields.forEach(f => keys.add(f.key)))
    config.identity.forEach(f => {
      if (!['product_name', 'product_code', 'category', 'units'].includes(f.key)) keys.add(f.key)
    })
    const out: Record<string, string> = {}
    keys.forEach(k => { if (form[k]) out[k] = form[k] })
    return out
  }

  const handleSave = async () => {
    if (!form.product_name?.trim()) {
      alert('Nama produk/layanan wajib diisi sebelum menyimpan.')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase.from('hpp_products').insert({
      user_id: user.id,
      business_type: businessType,
      product_name: form.product_name.trim(),
      product_code: form.product_code?.trim() || null,
      category: businessType === 'manufaktur' ? (form.category || null) : null,
      units: Number(form[config.unitKey]) || 1,
      inputs: collectInputs(),
      total_cost: result.totalCost,
      hpp_per_unit: result.hppPerUnit,
      break_even_point: result.breakEvenPoint,
      target_margin: margin,
      min_price: price.minPrice,
      recommended_price: price.recommendedPrice,
    })

    setSaving(false)
    if (error) { alert('Gagal menyimpan: ' + error.message); return }
    resetForm()
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus produk tersimpan ini?')) return
    await supabase.from('hpp_products').delete().eq('id', id)
    setSaved(prev => prev.filter(p => p.id !== id))
  }

  const exportExcel = () => {
    if (saved.length === 0) return
    const rows = saved.map(p => ({
      Tanggal: new Date(p.created_at).toLocaleDateString('id-ID'),
      'Jenis Bisnis': CONFIG[p.business_type]?.label ?? p.business_type,
      Nama: p.product_name,
      Kode: p.product_code ?? '',
      Kategori: p.category ?? '',
      'Jumlah Unit': p.units,
      'Total Biaya': p.total_cost,
      'HPP per Unit': p.hpp_per_unit,
      'Break Even Point': p.break_even_point,
      'Target Margin (%)': p.target_margin,
      'Harga Minimum': p.min_price,
      'Harga Rekomendasi': p.recommended_price,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'HPP')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const stamp = new Date().toISOString().split('T')[0]
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `kalkulator-hpp-${stamp}.xlsx`)
  }

  const renderField = (f: FieldDef) => {
    const value = form[f.key] ?? ''
    if (f.kind === 'select') {
      return (
        <select value={value} onChange={e => setField(f.key, e.target.value)} className={inputClass}>
          <option value="">Pilih {f.label}</option>
          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (f.kind === 'text') {
      return (
        <input
          value={value}
          onChange={e => setField(f.key, e.target.value)}
          placeholder={f.placeholder}
          className={inputClass}
        />
      )
    }
    // number (default) — termasuk komponen biaya
    return (
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => setField(f.key, e.target.value)}
        placeholder={f.placeholder ?? '0'}
        className={inputClass}
      />
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Calculator size={22} className="text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Kalkulator HPP</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          Hitung Harga Pokok Penjualan & rekomendasi harga jual berdasarkan target margin.
        </p>
      </div>

      {/* Tab jenis bisnis */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {TYPE_ORDER.map(type => {
          const c = CONFIG[type]
          const Icon = c.icon
          const active = businessType === type
          return (
            <button
              key={type}
              onClick={() => setBusinessType(type)}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-colors ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} /> <span className="hidden sm:inline">{c.label}</span>
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Kolom form */}
        <div className="lg:col-span-3 space-y-5">
          {/* Identitas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Identitas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {config.identity.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
          </div>

          {/* Kelompok biaya */}
          {config.groups.map(group => (
            <div key={group.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">{group.title}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {group.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} (Rp)</label>
                    {renderField(f)}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={15} /> Reset Form
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save size={15} /> {saving ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </div>

        {/* Kolom hasil */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-4">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Hasil Perhitungan</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Total Biaya</span>
                <span className="text-sm font-bold text-gray-800">{formatRupiah(result.totalCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">HPP per Unit</span>
                <span className="text-base font-bold text-indigo-600">{formatRupiah(result.hppPerUnit)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Break Even Point</span>
                <span className="text-sm font-bold text-gray-800">{formatRupiah(result.breakEvenPoint)}</span>
              </div>
            </div>

            {/* Rekomendasi harga */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">Target Margin</label>
                <span className="text-sm font-bold text-green-600">{margin}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={margin}
                onChange={e => setMargin(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Harga Minimum</p>
                  <p className="text-sm font-bold text-gray-800">{formatRupiah(price.minPrice)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600 mb-1">Harga Rekomendasi</p>
                  <p className="text-sm font-bold text-green-700">{formatRupiah(price.recommendedPrice)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Produk tersimpan */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">Produk Tersimpan</h2>
          <button
            onClick={exportExcel}
            disabled={saved.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet size={15} /> Export ke Excel
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Memuat data...</div>
        ) : saved.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Calculator size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada produk yang disimpan</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Jenis</th>
                  <th className="px-4 py-3 font-medium text-right">HPP/Unit</th>
                  <th className="px-4 py-3 font-medium text-right">Rekomendasi</th>
                  <th className="px-4 py-3 font-medium text-center">Margin</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {saved.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.product_name}</p>
                      {p.product_code && <p className="text-xs text-gray-400">{p.product_code}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{CONFIG[p.business_type]?.label ?? p.business_type}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatRupiah(p.hpp_per_unit)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatRupiah(p.recommended_price)}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{p.target_margin}%</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
