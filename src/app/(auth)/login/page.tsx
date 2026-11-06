'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSelectedServerIdFromCookie, selectSupabaseServer, subscribeToSupabaseServer } from '@/lib/supabase/client'
import {
  isSupabaseServerConfigured,
  SUPABASE_SERVER_IDS,
  type SupabaseServerId,
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
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false)
  const [activeServerOption, setActiveServerOption] = useState<SupabaseServerId>(selectedServer)
  const serverDropdownRef = useRef<HTMLDivElement>(null)
  const configuredServerIds = SUPABASE_SERVER_IDS.filter(isSupabaseServerConfigured)

  useEffect(() => {
    if (!serverDropdownOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !serverDropdownRef.current?.contains(event.target)) {
        setServerDropdownOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [serverDropdownOpen])

  const selectServer = (serverId: SupabaseServerId) => {
    if (!isSupabaseServerConfigured(serverId)) return
    selectSupabaseServer(serverId)
    setActiveServerOption(serverId)
    setServerDropdownOpen(false)
  }

  const handleServerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (configuredServerIds.length === 0) return

    const currentIndex = configuredServerIds.indexOf(activeServerOption)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!serverDropdownOpen) {
        setActiveServerOption(selectedServer)
        setServerDropdownOpen(true)
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (Math.max(currentIndex, 0) + direction + configuredServerIds.length) % configuredServerIds.length
      setActiveServerOption(configuredServerIds[nextIndex])
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (!serverDropdownOpen) setServerDropdownOpen(true)
      const nextIndex = event.key === 'Home' ? 0 : configuredServerIds.length - 1
      setActiveServerOption(configuredServerIds[nextIndex])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (serverDropdownOpen) selectServer(activeServerOption)
      else {
        setActiveServerOption(selectedServer)
        setServerDropdownOpen(true)
      }
    } else if (event.key === 'Escape' && serverDropdownOpen) {
      event.preventDefault()
      setServerDropdownOpen(false)
    }
  }

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
            <div className="relative" ref={serverDropdownRef}>
              <button
                type="button"
                id="server"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={serverDropdownOpen}
                aria-controls="server-options"
                aria-activedescendant={serverDropdownOpen ? `server-option-${activeServerOption}` : undefined}
                onClick={() => {
                  setActiveServerOption(selectedServer)
                  setServerDropdownOpen(open => !open)
                }}
                onKeyDown={handleServerKeyDown}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {translate(isSupabaseServerConfigured(selectedServer)
                  ? `Server ${selectedServer} (Aktif)`
                  : `Server ${selectedServer} (Belum dikonfigurasi)`)}
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-transform ${serverDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                id="server-options"
                role="listbox"
                aria-label={translate('Pilih Server')}
                aria-hidden={!serverDropdownOpen}
                className={`absolute left-0 right-0 top-full z-20 mt-1 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg transition-[max-height,opacity,transform] duration-200 ease-out motion-reduce:transition-opacity motion-reduce:duration-100 ${
                  serverDropdownOpen
                    ? 'max-h-60 translate-y-0 opacity-100'
                    : 'pointer-events-none max-h-0 -translate-y-1 opacity-0'
                }`}
              >
                {SUPABASE_SERVER_IDS.map(serverId => {
                  const configured = isSupabaseServerConfigured(serverId)
                  const label = configured
                    ? `Server ${serverId} (Aktif)`
                    : `Server ${serverId} (Belum dikonfigurasi)`

                  return (
                    <div
                      key={serverId}
                      id={`server-option-${serverId}`}
                      role="option"
                      aria-selected={selectedServer === serverId}
                      aria-disabled={!configured}
                      onMouseEnter={() => configured && setActiveServerOption(serverId)}
                      onClick={() => configured && selectServer(serverId)}
                      className={`px-3 py-2 text-sm ${
                        !configured
                          ? 'cursor-not-allowed text-gray-400'
                          : activeServerOption === serverId
                            ? 'cursor-pointer bg-indigo-50 text-indigo-600'
                            : 'cursor-pointer text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {translate(label)}
                    </div>
                  )
                })}
              </div>
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
          {translate('Belum punya akun?')}{' '}
          <Link href="/register" className="text-indigo-600 font-medium hover:underline">
            {translate('Daftar sekarang')}
          </Link>
        </p>
      </div>
    </div>
  )
}