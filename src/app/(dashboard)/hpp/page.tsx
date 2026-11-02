'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
import {
  calcManufaktur, calcRetail, calcJasa, recommendPrice,
  type BusinessType,
} from '@/lib/hpp'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
  Calculator, RotateCcw, Save, Trash2, FileSpreadsheet, Factory, Store, Wrench, PackagePlus,
  ChevronDown,
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
  target_margin: number // Legacy database column; stores markup percentage.
  min_price: number
  recommended_price: number
  created_at: string
}

type FieldKind = 'text' | 'number' | 'select'
interface FieldDef { key: string; label: string; kind?: FieldKind; options?: string[]; placeholder?: string }
interface GroupDef { title: string; fields: FieldDef[] }
type CalculatorOperator = '+' | '−' | '×' | '÷'
interface CalculatorState {
  display: string
  storedValue: number | null
  operator: CalculatorOperator | null
  waitingForOperand: boolean
  hasError: boolean
}

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

const initialCalculatorState: CalculatorState = {
  display: '0',
  storedValue: null,
  operator: null,
  waitingForOperand: false,
  hasError: false,
}

const calculate = (left: number, right: number, operator: CalculatorOperator) => {
  if (operator === '÷' && right === 0) return null

  const result = operator === '+' ? left + right
    : operator === '−' ? left - right
      : operator === '×' ? left * right
        : left / right

  return Number.isFinite(result) ? result : null
}

const formatCalculatorValue = (value: number) => String(Number(value.toPrecision(12)))

const getSavedMarkupPercent = (product: SavedProduct) => {
  if (product.hpp_per_unit <= 0) return product.target_margin
  return Number(((product.recommended_price / product.hpp_per_unit - 1) * 100).toFixed(1))
}

const calcFor = (type: BusinessType, form: Record<string, string>) =>
  type === 'manufaktur' ? calcManufaktur(form)
    : type === 'retail' ? calcRetail(form)
      : calcJasa(form)

export default function HppPage() {
  const localizedLanguage = useLanguage().language

  const supabase = createClient()
  const { formatCurrency, currency } = useCurrency()
  const [businessType, setBusinessType] = useState<BusinessType>('manufaktur')
  const [form, setForm] = useState<Record<string, string>>({})
  const [markupPct, setMarkupPct] = useState(20)
  const [calculator, setCalculator] = useState<CalculatorState>(initialCalculatorState)
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
  const price = useMemo(() => recommendPrice(result.hppPerUnit, markupPct), [result.hppPerUnit, markupPct])

  const setField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const enterCalculatorDigit = (digit: string) => {
    setCalculator(current => {
      const display = current.hasError || current.waitingForOperand
        ? digit
        : current.display === '0'
          ? digit
          : current.display.length < 15
            ? current.display + digit
            : current.display
      return { ...current, display, waitingForOperand: false, hasError: false }
    })
  }

  const enterCalculatorDecimal = () => {
    setCalculator(current => {
      if (current.hasError || current.waitingForOperand) {
        return { ...current, display: '0.', waitingForOperand: false, hasError: false }
      }
      if (current.display.includes('.')) return current
      return { ...current, display: `${current.display}.` }
    })
  }

  const setCalculatorOperator = (operator: CalculatorOperator) => {
    setCalculator(current => {
      if (current.hasError) return initialCalculatorState
      if (current.operator && current.storedValue !== null && !current.waitingForOperand) {
        const result = calculate(current.storedValue, Number(current.display), current.operator)
        if (result === null) {
          return { ...initialCalculatorState, display: 'Error', waitingForOperand: true, hasError: true }
        }
        return {
          display: formatCalculatorValue(result),
          storedValue: result,
          operator,
          waitingForOperand: true,
          hasError: false,
        }
      }
      return {
        ...current,
        storedValue: current.operator ? current.storedValue : Number(current.display),
        operator,
        waitingForOperand: true,
      }
    })
  }

  const calculateCalculatorResult = () => {
    setCalculator(current => {
      if (current.hasError || !current.operator || current.storedValue === null || current.waitingForOperand) return current
      const result = calculate(current.storedValue, Number(current.display), current.operator)
      if (result === null) {
        return { ...initialCalculatorState, display: 'Error', waitingForOperand: true, hasError: true }
      }
      return {
        ...initialCalculatorState,
        display: formatCalculatorValue(result),
        waitingForOperand: true,
      }
    })
  }

  const applyCalculatorUnary = (operation: (value: number) => number) => {
    setCalculator(current => {
      if (current.hasError || current.waitingForOperand) return current
      return { ...current, display: formatCalculatorValue(operation(Number(current.display))) }
    })
  }

  const resetForm = () => { setForm({}); setMarkupPct(20) }

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
      alert(translateText("Nama produk/layanan wajib diisi sebelum menyimpan.", localizedLanguage))
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
      target_margin: markupPct,
      min_price: price.minPrice,
      recommended_price: price.recommendedPrice,
    })

    setSaving(false)
    if (error) { alert(translateText("Gagal menyimpan: ", localizedLanguage) + error.message); return }
    resetForm()
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(translateText("Hapus produk tersimpan ini?", localizedLanguage))) return
    await supabase.from('hpp_products').delete().eq('id', id)
    setSaved(prev => prev.filter(p => p.id !== id))
  }

  // Jadikan hasil HPP sebagai produk jual di tabel `products`.
  const convertToProduct = async (p: SavedProduct) => {
    if (!confirm(`${translateText("Jadikan \"", localizedLanguage)}${p.product_name}${translateText("\" sebagai produk jual?\n\nHarga modal = HPP (", localizedLanguage)}${formatCurrency(p.hpp_per_unit)}${translateText("), harga jual = rekomendasi (", localizedLanguage)}${formatCurrency(p.recommended_price)}${translateText("). Stok awal 0 — atur di menu Produk.", localizedLanguage)}`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('products').insert({
      user_id: user.id,
      name: p.product_name,
      sku: p.product_code || null,
      price: p.recommended_price,
      cost_price: p.hpp_per_unit,
      stock: 0,
      unit: 'pcs',
      category_id: null,
      is_active: true,
      image_url: null,
    })

    if (error) { alert(translateText("Gagal membuat produk: ", localizedLanguage) + error.message); return }
    alert(`${translateText("✅ \"", localizedLanguage)}${p.product_name}${translateText("\" ditambahkan ke Produk. Stok masih 0 — atur stok & foto di menu Produk.", localizedLanguage)}`)
  }

  const exportExcel = () => {
    if (saved.length === 0) return
    const rows = saved.map(p => ({
      Tanggal: new Date(p.created_at).toLocaleDateString(localizedLanguage === 'en' ? 'en-US' : 'id-ID'),
      'Jenis Bisnis': CONFIG[p.business_type]?.label ?? p.business_type,
      Nama: p.product_name,
      Kode: p.product_code ?? '',
      Kategori: p.category ?? '',
      'Jumlah Unit': p.units,
      'Total Biaya': p.total_cost,
      'HPP per Unit': p.hpp_per_unit,
      'Break Even Point': p.break_even_point,
      'Markup dari HPP (%)': getSavedMarkupPercent(p),
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
        <div className="relative">
          <select
            value={value}
            onChange={e => setField(f.key, e.target.value)}
            className={`${inputClass} appearance-none pr-9`}
          >
            <option value="">{<LocalizedText text={"Pilih "} />}<LocalizedText text={f.label} /></option>
            {f.options?.map(o => <option key={o} value={o}><LocalizedText text={o} /></option>)}
          </select>
          <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
      )
    }
    if (f.kind === 'text') {
      return (
        <input
          value={value}
          onChange={e => setField(f.key, e.target.value)}
          placeholder={f.placeholder ? translateText(f.placeholder, localizedLanguage) : undefined}
          className={inputClass}
        />
      )
    }
    // number (default) — termasuk komponen biaya
    return (
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={e => setField(f.key, e.target.value)}
        placeholder={f.placeholder ?? translateText("0", localizedLanguage)}
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
          <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Kalkulator HPP"} />}</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {<LocalizedText text={"\r\n          Hitung Harga Pokok Penjualan & rekomendasi harga jual berdasarkan target margin.\r\n        "} />}</p>
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
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon size={16} /> <span className="hidden sm:inline"><LocalizedText text={c.label} /></span>
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Kolom form */}
        <div className="lg:col-span-3 space-y-5">
          {/* Identitas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">{<LocalizedText text={"Identitas"} />}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {config.identity.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><LocalizedText text={f.label} /></label>
                  {renderField(f)}
                </div>
              ))}
            </div>
          </div>

          {/* Kelompok biaya */}
          {config.groups.map(group => (
            <div key={group.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3"><LocalizedText text={group.title} /></h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {group.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><LocalizedText text={f.label} /> {<LocalizedText text={" ("} />}{currency}{<LocalizedText text={")"} />}</label>
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
              <RotateCcw size={15} /> {<LocalizedText text={" Reset Form\r\n            "} />}</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save size={15} /> {saving ? <LocalizedText text={"Menyimpan..."} /> : <LocalizedText text={"Simpan Produk"} />}
            </button>
          </div>
        </div>

        {/* Kolom hasil */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
              <Calculator size={16} className="text-indigo-600" />
              <LocalizedText text="Kalkulator" />
            </h3>
            <div className="hpp-calculator-display mb-3 rounded-lg bg-gray-50 px-3 py-2 text-right" aria-live="polite">
              <p className="min-h-4 truncate text-xs text-gray-500">
                {calculator.operator && calculator.storedValue !== null
                  ? `${formatCalculatorValue(calculator.storedValue)} ${calculator.operator}`
                  : '\u00a0'}
              </p>
              <p className="truncate text-xl font-semibold text-gray-900">{calculator.display}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setCalculator(initialCalculatorState)}
                aria-label={translateText("Hapus kalkulator", localizedLanguage)}
                className="min-h-10 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                AC
              </button>
              <button
                type="button"
                onClick={() => applyCalculatorUnary(value => value * -1)}
                aria-label={translateText("Ubah tanda", localizedLanguage)}
                className="min-h-10 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                +/−
              </button>
              <button
                type="button"
                onClick={() => applyCalculatorUnary(value => value / 100)}
                aria-label={translateText("Persen", localizedLanguage)}
                className="min-h-10 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setCalculatorOperator('÷')}
                aria-label={translateText("Bagi", localizedLanguage)}
                className="min-h-10 rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                ÷
              </button>
              {(['7', '8', '9'] as const).map(digit => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => enterCalculatorDigit(digit)}
                  className="hpp-calculator-key min-h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCalculatorOperator('×')}
                aria-label={translateText("Kali", localizedLanguage)}
                className="min-h-10 rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                ×
              </button>
              {(['4', '5', '6'] as const).map(digit => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => enterCalculatorDigit(digit)}
                  className="hpp-calculator-key min-h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCalculatorOperator('−')}
                aria-label={translateText("Kurang", localizedLanguage)}
                className="min-h-10 rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                −
              </button>
              {(['1', '2', '3'] as const).map(digit => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => enterCalculatorDigit(digit)}
                  className="hpp-calculator-key min-h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCalculatorOperator('+')}
                aria-label={translateText("Tambah", localizedLanguage)}
                className="min-h-10 rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => enterCalculatorDigit('0')}
                className="hpp-calculator-key col-span-2 min-h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={enterCalculatorDecimal}
                aria-label={translateText("Desimal", localizedLanguage)}
                className="hpp-calculator-key min-h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
              >
                .
              </button>
              <button
                type="button"
                onClick={calculateCalculatorResult}
                aria-label={translateText("Sama dengan", localizedLanguage)}
                className="min-h-10 rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                =
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 lg:sticky lg:top-4">
            <h3 className="text-sm font-bold text-gray-800 mb-2">{<LocalizedText text={"Hasil Perhitungan"} />}</h3>

            <div className="space-y-1">
              <div className="flex justify-between items-center py-1 border-b border-gray-50">
                <span className="text-sm text-gray-500">{<LocalizedText text={"Total Biaya"} />}</span>
                <span className="text-sm font-bold text-gray-800">{formatCurrency(result.totalCost)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-50">
                <span className="text-sm text-gray-500">{<LocalizedText text={"HPP per Unit"} />}</span>
                <span className="text-base font-bold text-indigo-600">{formatCurrency(result.hppPerUnit)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-500">{<LocalizedText text={"Break Even Point"} />}</span>
                <span className="text-sm font-bold text-gray-800">{formatCurrency(result.breakEvenPoint)}</span>
              </div>
            </div>

            {/* Rekomendasi harga */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700"><LocalizedText text="Markup dari HPP" /></label>
                <span className="text-sm font-bold text-green-600">{markupPct}{<LocalizedText text={"%"} />}</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={markupPct}
                onChange={e => setMarkupPct(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-1">{<LocalizedText text={"Harga Minimum"} />}</p>
                  <p className="text-sm font-bold text-gray-800">{formatCurrency(price.minPrice)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-xs text-green-600 mb-1">{<LocalizedText text={"Harga Rekomendasi"} />}</p>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(price.recommendedPrice)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Produk tersimpan */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">{<LocalizedText text={"Produk Tersimpan"} />}</h2>
          <button
            onClick={exportExcel}
            disabled={saved.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet size={15} /> {<LocalizedText text={" Export ke Excel\r\n          "} />}</button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">{<LocalizedText text={"Memuat data..."} />}</div>
        ) : saved.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Calculator size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{<LocalizedText text={"Belum ada produk yang disimpan"} />}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">{<LocalizedText text={"Nama"} />}</th>
                  <th className="px-4 py-3 font-medium">{<LocalizedText text={"Jenis"} />}</th>
                  <th className="px-4 py-3 font-medium text-right">{<LocalizedText text={"HPP/Unit"} />}</th>
                  <th className="px-4 py-3 font-medium text-right">{<LocalizedText text={"Rekomendasi"} />}</th>
                  <th className="px-4 py-3 font-medium text-center"><LocalizedText text="Markup" /></th>
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
                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatCurrency(p.hpp_per_unit)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(p.recommended_price)}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{getSavedMarkupPercent(p)}{<LocalizedText text={"%"} />}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => convertToProduct(p)}
                          title={translateText("Jadikan produk jual", localizedLanguage)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <PackagePlus size={15} />
                          <span className="hidden sm:inline">{<LocalizedText text={"Jadikan Produk"} />}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          title={translateText("Hapus", localizedLanguage)}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
