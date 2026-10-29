'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Plus, Trash2, QrCode, Upload, Pencil, Check, X } from 'lucide-react'
import { CURRENCY_OPTIONS, isCurrencyCode, useCurrency } from '@/lib/currency'
import type { CurrencyCode } from '@/lib/currency'
import { LanguageToggle, useLanguage, LocalizedText, translateText } from '@/lib/language'
interface Category {
  id: string
  name: string
  color: string
}

interface PaymentAccount {
  id: string
  bank_name: string
  account_number: string
  account_name: string
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

const toneOptions = [
  { value: 'classic', label: 'Classic' },
  { value: 'beep', label: 'Beep' },
  { value: 'soft', label: 'Soft' },
  { value: 'success', label: 'Success' },
]

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function SettingsPage() {
  const localizedLanguage = useLanguage().language

  const supabase = useMemo(() => createClient(), [])
  const { currency, setCurrency, currencyError: profileCurrencyError } = useCurrency()
  const { language, isOwner: languageOwner, error: languageError } = useLanguage()
  const [profile, setProfile] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    address: '',
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([])
  const [accountForm, setAccountForm] = useState({ bank_name: '', account_number: '', account_name: '' })
  const [accountSaving, setAccountSaving] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [categorySavingId, setCategorySavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qrisUrl, setQrisUrl] = useState<string | null>(null)
  const [qrisUploading, setQrisUploading] = useState(false)
  const [cashierSoundUrl, setCashierSoundUrl] = useState<string | null>(null)
  const [customerSoundUrl, setCustomerSoundUrl] = useState<string | null>(null)
  const [cashierTone, setCashierTone] = useState('classic')
  const [customerTone, setCustomerTone] = useState('classic')
  const [cashierCompactMode, setCashierCompactMode] = useState(false)
  const [cashierCompactModeReady, setCashierCompactModeReady] = useState(false)
  const [cashierCompactModeSaving, setCashierCompactModeSaving] = useState(false)
  const [cashierCompactModeError, setCashierCompactModeError] = useState('')
  const [soundUploading, setSoundUploading] = useState<'cashier' | 'customer' | null>(null)
  const [tableQrLinks, setTableQrLinks] = useState<Record<number, string>>({})
  const [qrReady, setQrReady] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [nextCurrency, setNextCurrency] = useState<CurrencyCode | null>(null)
  const [currencySaving, setCurrencySaving] = useState(false)
  const [currencyError, setCurrencyError] = useState('')
  const [currencySaved, setCurrencySaved] = useState(false)
  const selectedCurrency = nextCurrency ?? currency

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prof }, { data: cats }, { data: accounts }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('payment_accounts').select('id, bank_name, account_number, account_name').eq('user_id', user.id).order('created_at'),
      ])
      if (prof) {
        setIsOwner(prof.role === 'owner')
        const hasCompactModeSetting = Object.prototype.hasOwnProperty.call(prof, 'cashier_compact_mode')
        setCashierCompactModeReady(hasCompactModeSetting)
        setCashierCompactMode(prof.cashier_compact_mode === true)
        if (!hasCompactModeSetting) {
          setCashierCompactModeError(
            'Pengaturan ini memerlukan pembaruan database. Jalankan supabase/add_cashier_compact_mode.sql di Supabase SQL Editor.'
          )
        }
        setProfile({
          business_name: prof.business_name ?? '',
          owner_name: prof.owner_name ?? '',
          phone: prof.phone ?? '',
          address: prof.address ?? '',
        })
        setQrisUrl(prof.qris_image_url ?? null)
        setCashierSoundUrl(prof.cashier_sound_url ?? null)
        setCustomerSoundUrl(prof.customer_sound_url ?? null)
        setCashierTone(prof.cashier_tone ?? 'classic')
        setCustomerTone(prof.customer_tone ?? 'classic')
      }
      setCategories(cats ?? [])
      setPaymentAccounts(accounts ?? [])

      const links = Object.fromEntries(
        [1, 2, 3, 4].map(table => {
          const target = `${window.location.origin}/table/${table}?owner=${user.id}`
          return [table, `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(target)}`]
        })
      ) as Record<number, string>

      setTableQrLinks(links)
      setQrReady(true)
    }
    load()
  }, [supabase])

  const handleCurrencyChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOwner || currencySaving || selectedCurrency === currency) return

    setCurrencySaving(true)
    setCurrencyError('')
    setCurrencySaved(false)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      setCurrencyError(`${translateText("Gagal menyimpan mata uang: ", localizedLanguage)}${userError?.message ?? translateText('Sesi pengguna tidak ditemukan.', localizedLanguage)}`)
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ currency_code: selectedCurrency })
        .eq('id', user.id)

      if (error) {
        setCurrencyError(`${translateText("Gagal menyimpan mata uang: ", localizedLanguage)}${error.message}`)
      } else {
        setCurrency(selectedCurrency)
        setNextCurrency(null)
        setCurrencySaved(true)
      }
    }
    setCurrencySaving(false)
  }

  const handleCashierCompactModeChange = async () => {
    if (!cashierCompactModeReady || cashierCompactModeSaving) return
    setCashierCompactModeSaving(true)
    setCashierCompactModeError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCashierCompactModeError(translateText("Sesi pengguna tidak ditemukan. Muat ulang halaman lalu coba lagi.", localizedLanguage))
      setCashierCompactModeSaving(false)
      return
    }

    const nextValue = !cashierCompactMode
    const { error } = await supabase
      .from('profiles')
      .update({ cashier_compact_mode: nextValue })
      .eq('id', user.id)

    if (error) {
      setCashierCompactModeError(`${translateText("Gagal menyimpan pengaturan: ", localizedLanguage)}${error.message}`)
    } else {
      setCashierCompactMode(nextValue)
    }
    setCashierCompactModeSaving(false)
  }

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

  const handleAddPaymentAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountForm.bank_name.trim() || !accountForm.account_number.trim() || !accountForm.account_name.trim()) return
    setAccountSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAccountSaving(false); return }

    const { data, error } = await supabase
      .from('payment_accounts')
      .insert({
        user_id: user.id,
        bank_name: accountForm.bank_name.trim(),
        account_number: accountForm.account_number.trim(),
        account_name: accountForm.account_name.trim(),
      })
      .select('id, bank_name, account_number, account_name')
      .single()

    if (error) {
      alert(translateText("Gagal menyimpan rekening: ", localizedLanguage) + error.message)
    } else if (data) {
      setPaymentAccounts(prev => [...prev, data])
      setAccountForm({ bank_name: '', account_number: '', account_name: '' })
    }
    setAccountSaving(false)
  }

  const handleDeletePaymentAccount = async (id: string) => {
    if (!confirm(translateText("Hapus rekening ini?", localizedLanguage))) return
    await supabase.from('payment_accounts').delete().eq('id', id)
    setPaymentAccounts(prev => prev.filter(account => account.id !== id))
  }

  const handleUploadQris = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert(translateText("File harus berupa gambar.", localizedLanguage))
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
    if (upErr) { alert(translateText("Gagal mengunggah QRIS.", localizedLanguage)); setQrisUploading(false); return }

    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
    await supabase.from('profiles').update({ qris_image_url: pub.publicUrl }).eq('id', user.id)
    setQrisUrl(pub.publicUrl)
    setQrisUploading(false)
  }

  const handleRemoveQris = async () => {
    if (!confirm(translateText("Hapus gambar QRIS?", localizedLanguage))) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ qris_image_url: null }).eq('id', user.id)
    setQrisUrl(null)
  }

  const handleUploadSound = async (kind: 'cashier' | 'customer', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      alert(translateText("File harus berupa audio. Format yang didukung: MP3, WAV, M4A.", localizedLanguage))
      return
    }

    setSoundUploading(kind)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSoundUploading(null)
      return
    }

    const ext = file.name.split('.').pop() || 'mp3'
    const path = `${user.id}/${kind}-sound-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true })

    if (upErr) {
      alert(translateText("Gagal mengunggah suara notifikasi.", localizedLanguage))
      setSoundUploading(null)
      return
    }

    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
    const payload = kind === 'cashier' ? { cashier_sound_url: pub.publicUrl } : { customer_sound_url: pub.publicUrl }
    await supabase.from('profiles').update(payload).eq('id', user.id)

    if (kind === 'cashier') setCashierSoundUrl(pub.publicUrl)
    else setCustomerSoundUrl(pub.publicUrl)

    setSoundUploading(null)
  }

  const handleRemoveSound = async (kind: 'cashier' | 'customer') => {
    if (!confirm(`${translateText("Hapus suara notifikasi ", localizedLanguage)}${kind === 'cashier' ? translateText("kasir", localizedLanguage) : translateText("pelanggan", localizedLanguage)}${translateText("?", localizedLanguage)}`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = kind === 'cashier' ? { cashier_sound_url: null } : { customer_sound_url: null }
    await supabase.from('profiles').update(payload).eq('id', user.id)

    if (kind === 'cashier') setCashierSoundUrl(null)
    else setCustomerSoundUrl(null)
  }

  const handleTestSound = (kind: 'cashier' | 'customer') => {
    const url = kind === 'cashier' ? cashierSoundUrl : customerSoundUrl
    if (url) {
      const audio = new Audio(url)
      audio.volume = 1
      void audio.play().catch(() => {
        alert(translateText("Browser memblokir suara otomatis. Klik sekali di halaman ini lalu coba lagi.", localizedLanguage))
      })
      return
    }

    const tone = kind === 'cashier' ? cashierTone : customerTone
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    const context = new AudioCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = tone === 'beep' ? 720 : tone === 'soft' ? 540 : tone === 'success' ? 880 : 660
    gain.gain.value = 0.04
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.2)
  }

  const handleToneChange = async (kind: 'cashier' | 'customer', value: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = kind === 'cashier' ? { cashier_tone: value } : { customer_tone: value }
    await supabase.from('profiles').update(payload).eq('id', user.id)

    if (kind === 'cashier') setCashierTone(value)
    else setCustomerTone(value)
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

  const handleUpdateCategory = async (id: string) => {
    const name = editingCategoryName.trim()
    if (!name) {
      alert(translateText("Nama kategori tidak boleh kosong.", localizedLanguage))
      return
    }

    setCategorySavingId(id)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        alert(translateText("Sesi berakhir. Silakan masuk kembali.", localizedLanguage))
        return
      }

      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        alert(`${translateText("Gagal mengubah nama kategori: ", localizedLanguage)}${error.message}`)
        return
      }

      setCategories(prev => prev.map(category => category.id === id ? data : category))
      setEditingCategoryId(null)
      setEditingCategoryName('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.'
      alert(`${translateText("Gagal mengubah nama kategori: ", localizedLanguage)}${message}`)
    } finally {
      setCategorySavingId(null)
    }
  }

  const cancelCategoryEdit = () => {
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(translateText("Hapus kategori ini?", localizedLanguage))) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Pengaturan"} />}</h1>

      {/* Profil Toko */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Profil Toko"} />}</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">

          {saved && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg border border-green-200">
              {<LocalizedText text={"\r\n              ✅ Perubahan berhasil disimpan!\r\n            "} />}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Nama Bisnis"} />}</label>
            <input
              value={profile.business_name}
              onChange={e => setProfile(p => ({ ...p, business_name: e.target.value }))}
              placeholder={translateText("Toko Shinx", localizedLanguage)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Nama Pemilik"} />}</label>
            <input
              value={profile.owner_name}
              onChange={e => setProfile(p => ({ ...p, owner_name: e.target.value }))}
              placeholder={translateText("Nama pemilik toko", localizedLanguage)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Nomor Telepon"} />}</label>
            <input
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder={translateText("08xxxxxxxxxx", localizedLanguage)}
              className={inputClass}
            />
          </div>

          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-gray-700 mb-1">{<LocalizedText text={"Alamat"} />}</label>
            <textarea
              suppressHydrationWarning
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              rows={3}
              placeholder={translateText("Alamat lengkap toko", localizedLanguage)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save size={15} />
            {loading ? <LocalizedText text={"Menyimpan..."} /> : <LocalizedText text={"Simpan Perubahan"} />}
          </button>
        </form>
      </div>

      {/* Mata Uang Toko */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">{language === 'id' ? <LocalizedText text={"Bahasa Toko"} /> : <LocalizedText text={"Store Language"} />}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {language === 'id'
            ? <LocalizedText text={"Bahasa ini berlaku untuk seluruh aplikasi dan halaman QR meja, serta tersinkron di semua perangkat."} />
            : <LocalizedText text={"This language applies to the entire app and table QR pages, and syncs across devices."} />}
        </p>
        {languageOwner ? (
          <LanguageToggle />
        ) : (
          <p className="text-sm text-gray-500">
            {language === 'id' ? <LocalizedText text={"Bahasa mengikuti pengaturan pemilik toko."} /> : <LocalizedText text={"The language follows the store owner’s setting."} />}
          </p>
        )}
        {languageError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {languageError}
            {" "}
            {language === 'id'
              ? <LocalizedText text={"Pastikan supabase/multi_language.sql sudah dijalankan di Supabase SQL Editor."} />
              : <LocalizedText text={"Make sure supabase/multi_language.sql has been run in the Supabase SQL Editor."} />}
          </p>
        )}
      </div>

      {/* Mata Uang Toko */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">{<LocalizedText text={"Mata Uang Toko"} />}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {<LocalizedText text={"\r\n          Pilihan ini hanya mengubah format tampilan, bukan angka yang sudah tersimpan. Jika benar-benar berpindah mata uang, sesuaikan angka lama secara manual terlebih dahulu.\r\n        "} />}</p>

        {profileCurrencyError && (
          <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            {<LocalizedText text={"\r\n            Gagal memuat mata uang toko: "} />}<LocalizedText text={profileCurrencyError} />{<LocalizedText text={". Jika kolom atau fungsi mata uang belum ada, jalankan "} />}<code>{<LocalizedText text={"supabase/multi_currency.sql"} />}</code> {<LocalizedText text={" di Supabase SQL Editor.\r\n          "} />}</p>
        )}

        {!isOwner ? (
          <p className="text-sm text-gray-500">{<LocalizedText text={"Hanya pemilik toko yang dapat mengganti mata uang."} />}</p>
        ) : (
          <form onSubmit={handleCurrencyChange} className="space-y-4">
            {currencySaved && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                {<LocalizedText text={"\r\n                Mata uang tampilan berhasil diubah. Nilai yang tersimpan tidak diubah.\r\n              "} />}</p>
            )}
            {currencyError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <LocalizedText text={currencyError} />
              </p>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{<LocalizedText text={"Mata uang saat ini"} />}</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                <LocalizedText text={CURRENCY_OPTIONS.find(option => option.code === currency)?.label ?? currency} />
              </p>
            </div>

            <div>
              <label htmlFor="store-currency" className="mb-1 block text-sm font-medium text-gray-700">
                {<LocalizedText text={"\r\n                Mata uang baru\r\n              "} />}</label>
              <select
                id="store-currency"
                value={selectedCurrency}
                onChange={event => {
                  if (isCurrencyCode(event.target.value)) setNextCurrency(event.target.value)
                  setCurrencyError('')
                  setCurrencySaved(false)
                }}
                className={inputClass}
                disabled={currencySaving || !!profileCurrencyError}
              >
                {CURRENCY_OPTIONS.map(option => (
                  <option key={option.code} value={option.code}><LocalizedText text={option.label} /></option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={currencySaving || !!profileCurrencyError || selectedCurrency === currency}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={15} />
              {currencySaving ? <LocalizedText text={"Menyimpan..."} /> : `${translateText('Simpan ', localizedLanguage)}${selectedCurrency}`}
            </button>
          </form>
        )}
      </div>

      {/* Tampilan Kasir */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">{<LocalizedText text={"Tampilan Kasir"} />}</h2>
        <p className="text-sm text-gray-400 mb-4">
          {<LocalizedText text={"\r\n          Sembunyikan gambar produk agar lebih banyak item terlihat di layar kasir.\r\n        "} />}</p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-25 p-4">
          <div>
            <p className="text-sm font-medium text-gray-800">{<LocalizedText text={"Mode Compact"} />}</p>
            <p className="text-xs text-gray-500">
              {cashierCompactMode ? <LocalizedText text={"Aktif — gambar produk nonaktif"} /> : <LocalizedText text={"Nonaktif — gambar produk aktif"} />}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cashierCompactMode}
            aria-label={translateText("Mode tanpa gambar", localizedLanguage)}
            aria-disabled={!cashierCompactModeReady || cashierCompactModeSaving}
            onClick={() => void handleCashierCompactModeChange()}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              !cashierCompactModeReady || cashierCompactModeSaving ? 'cursor-not-allowed opacity-50' : ''
            } ${
              cashierCompactMode ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                cashierCompactMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {cashierCompactModeError && (
          <p role="alert" className="mt-3 text-sm text-amber-700">
            <LocalizedText text={cashierCompactModeError} />
          </p>
        )}
        {cashierCompactModeSaving && (
          <p className="mt-2 text-xs text-gray-400">{<LocalizedText text={"Menyimpan pengaturan..."} />}</p>
        )}
      </div>

      {/* Rekening Transfer */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">{<LocalizedText text={"Rekening Transfer"} />}</h2>
        <p className="text-sm text-gray-400 mb-4">
          {<LocalizedText text={"\r\n          Rekening ini akan muncul di kasir saat metode pembayaran Transfer dipilih.\r\n        "} />}</p>

        <form onSubmit={handleAddPaymentAccount} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <input
            required
            value={accountForm.bank_name}
            onChange={e => setAccountForm(prev => ({ ...prev, bank_name: e.target.value }))}
            placeholder={translateText("Nama bank", localizedLanguage)}
            className={inputClass}
          />
          <input
            required
            value={accountForm.account_number}
            onChange={e => setAccountForm(prev => ({ ...prev, account_number: e.target.value }))}
            placeholder={translateText("Nomor rekening", localizedLanguage)}
            className={inputClass}
          />
          <input
            required
            value={accountForm.account_name}
            onChange={e => setAccountForm(prev => ({ ...prev, account_name: e.target.value }))}
            placeholder={translateText("Nama pemilik rekening", localizedLanguage)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={accountSaving}
            className="sm:col-span-3 flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={15} /> {accountSaving ? <LocalizedText text={"Menyimpan..."} /> : <LocalizedText text={"Tambah Rekening"} />}
          </button>
        </form>

        {paymentAccounts.length > 0 && (
          <div className="space-y-2">
            {paymentAccounts.map(account => (
              <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-0 border border-gray-200 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{account.bank_name} {<LocalizedText text={" · "} />}{account.account_number}</p>
                  <p className="text-xs text-gray-500">{<LocalizedText text={"a.n. "} />}{account.account_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeletePaymentAccount(account.id)}
                  className="text-gray-400 hover:text-indigo-600 transition-colors"
                  aria-label={`${translateText('Hapus rekening ', localizedLanguage)}${account.bank_name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QRIS Pembayaran */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <QrCode size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-800">{<LocalizedText text={"QRIS Pembayaran"} />}</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {<LocalizedText text={"\r\n          Unggah gambar QRIS toko. Akan tampil di kasir saat metode bayar QRIS dipilih.\r\n        "} />}</p>

        {qrisUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrisUrl}
              alt={translateText("QRIS Toko", localizedLanguage)}
              className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white"
            />
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer transition-colors w-fit">
                <Upload size={15} />
                {qrisUploading ? <LocalizedText text={"Mengunggah..."} /> : <LocalizedText text={"Ganti Gambar"} />}
                <input type="file" accept="image/*" onChange={handleUploadQris} disabled={qrisUploading} className="hidden" />
              </label>
              <button
                onClick={handleRemoveQris}
                className="flex items-center gap-2 text-red-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors w-fit"
              >
                <Trash2 size={15} />
                {<LocalizedText text={"\r\n                Hapus\r\n              "} />}</button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
            <Upload size={22} className="text-gray-400" />
            <span className="text-sm text-gray-500 font-medium">
              {qrisUploading ? <LocalizedText text={"Mengunggah..."} /> : <LocalizedText text={"Klik untuk unggah gambar QRIS"} />}
            </span>
            <span className="text-xs text-gray-400">{<LocalizedText text={"PNG / JPG"} />}</span>
            <input type="file" accept="image/*" onChange={handleUploadQris} disabled={qrisUploading} className="hidden" />
          </label>
        )}
      </div>

      {/* Suara Notifikasi */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Suara Notifikasi"} />}</h2>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-0 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{<LocalizedText text={"Suara Kasir"} />}</p>
                <p className="text-xs text-gray-500">{<LocalizedText text={"Diputar saat ada pesanan baru atau meja selesai"} />}</p>
              </div>
              {cashierSoundUrl && (
                <audio controls src={cashierSoundUrl} className="h-8" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center justify-center bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700">
                  {soundUploading === 'cashier' ? <LocalizedText text={"Mengunggah..."} /> : <LocalizedText text={"Upload suara"} />}
                  <input type="file" accept="audio/*" onChange={e => handleUploadSound('cashier', e)} className="hidden" />
                </label>
                <button onClick={() => handleTestSound('cashier')} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">
                  {<LocalizedText text={"\r\n                  Tes suara\r\n                "} />}</button>
                {cashierSoundUrl && (
                  <button onClick={() => handleRemoveSound('cashier')} className="text-red-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                    {<LocalizedText text={"\r\n                    Hapus\r\n                  "} />}</button>
                )}
              </div>
              <div className="w-full max-w-xs">
                <label className="block text-xs font-medium text-gray-600 mb-1">{<LocalizedText text={"Variasi nada default"} />}</label>
                <select
                  value={cashierTone}
                  onChange={e => void handleToneChange('cashier', e.target.value)}
                  className={inputClass}
                >
                  {toneOptions.map(option => (
                    <option key={option.value} value={option.value}><LocalizedText text={option.label} /></option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-0 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{<LocalizedText text={"Suara Pelanggan"} />}</p>
                <p className="text-xs text-gray-500">{<LocalizedText text={"Diputar saat pesanan sudah siap di meja pelanggan"} />}</p>
              </div>
              {customerSoundUrl && (
                <audio controls src={customerSoundUrl} className="h-8" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center justify-center bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700">
                  {soundUploading === 'customer' ? <LocalizedText text={"Mengunggah..."} /> : <LocalizedText text={"Upload suara"} />}
                  <input type="file" accept="audio/*" onChange={e => handleUploadSound('customer', e)} className="hidden" />
                </label>
                <button onClick={() => handleTestSound('customer')} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">
                  {<LocalizedText text={"\r\n                  Tes suara\r\n                "} />}</button>
                {customerSoundUrl && (
                  <button onClick={() => handleRemoveSound('customer')} className="text-red-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                    {<LocalizedText text={"\r\n                    Hapus\r\n                  "} />}</button>
                )}
              </div>
              <div className="w-full max-w-xs">
                <label className="block text-xs font-medium text-gray-600 mb-1">{<LocalizedText text={"Variasi nada default"} />}</label>
                <select
                  value={customerTone}
                  onChange={e => void handleToneChange('customer', e.target.value)}
                  className={inputClass}
                >
                  {toneOptions.map(option => (
                    <option key={option.value} value={option.value}><LocalizedText text={option.label} /></option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Meja Pelanggan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-800">{<LocalizedText text={"QR Meja Pelanggan"} />}</h2>
        </div>

        {qrReady ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(tableNumber => (
              <div key={tableNumber} className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tableQrLinks[tableNumber]}
                  alt={`${translateText('QR Meja ', localizedLanguage)}${tableNumber}`}
                  className="w-24 h-24 rounded-lg bg-white border border-gray-200"
                />
                <span className="text-xs font-medium text-gray-700">{<LocalizedText text={"Meja "} />}{tableNumber}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">{<LocalizedText text={"Menyiapkan QR meja..."} />}</div>
        )}
      </div>

      {/* Kategori */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">{<LocalizedText text={"Kategori Produk"} />}</h2>

        <div className="flex gap-2 mb-4">
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            placeholder={translateText("Nama kategori baru...", localizedLanguage)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} /> {<LocalizedText text={" Tambah\r\n          "} />}</button>
        </div>

        {/* Pilih warna */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setNewCatColor(color)}
              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${newCatColor === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{<LocalizedText text={"Belum ada kategori"} />}</p>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  {editingCategoryId === cat.id ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-2"
                      onSubmit={event => {
                        event.preventDefault()
                        void handleUpdateCategory(cat.id)
                      }}
                    >
                      <input
                        autoFocus
                        aria-label={`${translateText('Nama kategori ', localizedLanguage)}${cat.name}`}
                        value={editingCategoryName}
                        onChange={event => setEditingCategoryName(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Escape') cancelCategoryEdit()
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        aria-label={`${translateText('Simpan nama kategori ', localizedLanguage)}${cat.name}`}
                        disabled={categorySavingId === cat.id || !editingCategoryName.trim()}
                        className="text-green-600 transition-colors hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check size={17} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${translateText('Batal mengedit kategori ', localizedLanguage)}${cat.name}`}
                        disabled={categorySavingId === cat.id}
                        onClick={cancelCategoryEdit}
                        className="text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X size={17} />
                      </button>
                    </form>
                  ) : (
                    <span className="truncate text-sm text-gray-700">{cat.name}</span>
                  )}
                </div>
                {editingCategoryId !== cat.id && (
                  <div className="ml-3 flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`${translateText('Edit kategori ', localizedLanguage)}${cat.name}`}
                      onClick={() => {
                        setEditingCategoryId(cat.id)
                        setEditingCategoryName(cat.name)
                      }}
                      className="text-gray-400 transition-colors hover:text-indigo-600"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${translateText('Hapus kategori ', localizedLanguage)}${cat.name}`}
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-gray-400 transition-colors hover:text-indigo-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}