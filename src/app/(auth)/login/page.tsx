'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSelectedServerIdFromCookie, selectSupabaseServer, subscribeToSupabaseServer } from '@/lib/supabase/client'
import {
  isSupabaseServerConfigured,
  isSupabaseServerId,
  SUPABASE_SERVER_IDS,
} from '@/lib/supabase/config'
import { ChevronDown } from 'lucide-react'
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
            <div className="relative">
              <select
                id="server"
                value={selectedServer}
                onChange={event => {
                  const nextServer = event.target.value
                  if (!isSupabaseServerId(nextServer) || !isSupabaseServerConfigured(nextServer)) return
                  selectSupabaseServer(nextServer)
                }}
                className="w-full appearance-none px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SUPABASE_SERVER_IDS.map(serverId => {
                  const configured = isSupabaseServerConfigured(serverId)
                  const label = configured
                    ? `Server ${serverId} (Aktif)`
                    : `Server ${serverId} (Belum dikonfigurasi)`

                  return (
                    <option key={serverId} value={serverId} disabled={!configured}>
                      {translate(label)}
                    </option>
                  )
                })}
              </select>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
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