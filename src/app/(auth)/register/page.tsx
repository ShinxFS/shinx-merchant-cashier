'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { LanguageToggle, useLanguage, LocalizedText, translateText } from '@/lib/language'
export default function RegisterPage() {
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

    // Update business name di profile
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
        <div className="mb-5 flex justify-end">
          <LanguageToggle localOnly />
        </div>

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl font-bold">{<LocalizedText text={"S"} />}</span>
          </div>
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