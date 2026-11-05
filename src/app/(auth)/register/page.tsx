'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { LanguageToggle, useLanguage, translateText } from '@/lib/language'

const REGISTRATION_AVAILABLE = false

function RegistrationForm() {
  const localizedLanguage = useLanguage().language

  const router = useRouter()
  const supabase = createClient()
  const { language, t: translate } = useLanguage()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { business_name: businessName }
      }
    })

    if (error) {
      setError(translate(error.message))
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ business_name: businessName, language_code: language })
        .eq('id', user.id)
      if (profileError) {
        setError(translate(`Akun berhasil dibuat, tetapi bahasa toko gagal disimpan: ${profileError.message}`))
        setLoading(false)
        return
      }
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

        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">{translate('Buat Akun Baru')}</h1>
          <p className="text-gray-500 text-sm mt-1">{translate('Daftarkan bisnis kamu')}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{translate('Nama Bisnis')}</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              required
              placeholder={translateText("Nama Toko Kamu", localizedLanguage)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
              minLength={6}
              placeholder={translate('Minimal 6 karakter')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? translate('Mendaftar...') : translate('Daftar')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {translate('Sudah punya akun?')}{" "}
          <Link href="/login" className="text-indigo-600 font-medium hover:underline">
            {translate('Masuk di sini')}
          </Link>
        </p>
      </div>
    </div>
  )
}

function RegistrationUnavailable() {
  const { t: translate } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="mb-5 flex justify-start">
          <LanguageToggle localOnly />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            <span className="uppercase">
              {translate('Pendaftaran sementara tidak tersedia.')}
            </span>
          </h1>
          <p className="mt-2 text-xs text-gray-500">
            {translate('DM for Information:')}{' '}
            <a
              href="mailto:shinxmerchant@gmail.com"
              className="text-indigo-600 hover:underline"
            >
              shinxmerchant@gmail.com
            </a>
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            {translate('Masuk di sini')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return REGISTRATION_AVAILABLE ? <RegistrationForm /> : <RegistrationUnavailable />
}
