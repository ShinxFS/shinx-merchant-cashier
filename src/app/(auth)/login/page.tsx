'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSelectedServerIdFromCookie, selectSupabaseServer, subscribeToSupabaseServer } from '@/lib/supabase/client'
import { isSupabaseServerConfigured, type SupabaseServerId } from '@/lib/supabase/config'
import Link from 'next/link'
import { LanguageToggle, useLanguage, LocalizedText, translateText } from '@/lib/language'
export default function LoginPage() {
  const localizedLanguage = useLanguage().language

  const router = useRouter()
  const selectedServer = useSyncExternalStore(
    subscribeToSupabaseServer,
    getSelectedServerIdFromCookie,
    () => '0' as const
  )
  const supabase = useMemo(() => createClient(selectedServer), [selectedServer])
  const { t: translate } = useLanguage()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!isSupabaseServerConfigured(selectedServer)) {
      setError(translate('Server ini belum dikonfigurasi.'))
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(translate('Email atau password salah.'))
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="mb-5 flex justify-start">
          <LanguageToggle localOnly />
        </div>
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl font-bold">{<LocalizedText text={"S"} />}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{<LocalizedText text={"Shinx Merchant Cashier"} />}</h1>
          <p className="text-gray-500 text-sm mt-1">{translate('Masuk ke akun kamu')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="server" className="block text-sm font-medium text-gray-700 mb-1">
              {translate('Pilih Server')}
            </label>
            <select
              id="server"
              value={selectedServer}
              onChange={event => {
                const nextServer = event.target.value as SupabaseServerId
                if (!isSupabaseServerConfigured(nextServer)) return
                selectSupabaseServer(nextServer)
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="0" disabled={!isSupabaseServerConfigured('0')}>
                {translate(isSupabaseServerConfigured('0') ? 'Server 0 (Aktif)' : 'Server 0 (Belum dikonfigurasi)')}
              </option>
              <option value="1" disabled={!isSupabaseServerConfigured('1')}>
                {translate(isSupabaseServerConfigured('1') ? 'Server 1 (Aktif)' : 'Server 1 (Belum dikonfigurasi)')}
              </option>
              <option value="2" disabled={!isSupabaseServerConfigured('2')}>
                {translate(isSupabaseServerConfigured('2') ? 'Server 2 (Aktif)' : 'Server 2 (Belum dikonfigurasi)')}
              </option>
              <option value="3" disabled={!isSupabaseServerConfigured('3')}>
                {translate(isSupabaseServerConfigured('3') ? 'Server 3 (Aktif)' : 'Server 3 (Belum dikonfigurasi)')}
              </option>
              <option value="4" disabled={!isSupabaseServerConfigured('4')}>
                {translate(isSupabaseServerConfigured('4') ? 'Server 4 (Aktif)' : 'Server 4 (Belum dikonfigurasi)')}
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {translate(selectedServer === '0' ? 'Server 0 menggunakan database saat ini.' : `Server ${selectedServer} menggunakan database terpisah.`)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{translate('Email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder={translateText("nama@email.com", localizedLanguage)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{translate('Password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder={translateText("••••••••", localizedLanguage)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? translate('Memuat...') : translate('Masuk')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {translate('Belum punya akun?')}{" "}
          <Link href="/register" className="text-indigo-600 font-medium hover:underline">
            {translate('Daftar sekarang')}
          </Link>
        </p>
      </div>
    </div>
  )
}