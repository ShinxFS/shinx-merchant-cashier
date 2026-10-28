'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export const CURRENCY_OPTIONS = [
  { code: 'IDR', label: 'Rupiah Indonesia (IDR)' },
  { code: 'USD', label: 'Dolar Amerika Serikat (USD)' },
  { code: 'SGD', label: 'Dolar Singapura (SGD)' },
  { code: 'MYR', label: 'Ringgit Malaysia (MYR)' },
  { code: 'THB', label: 'Baht Thailand (THB)' },
  { code: 'PHP', label: 'Peso Filipina (PHP)' },
  { code: 'JPY', label: 'Yen Jepang (JPY)' },
  { code: 'CNY', label: 'Yuan China (CNY)' },
  { code: 'KRW', label: 'Won Korea Selatan (KRW)' },
  { code: 'VND', label: 'Dong Vietnam (VND)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'Pound Britania (GBP)' },
  { code: 'AUD', label: 'Dolar Australia (AUD)' },
  { code: 'CAD', label: 'Dolar Kanada (CAD)' },
  { code: 'KWD', label: 'Dinar Kuwait (KWD)' },
] as const

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code']

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
  formatCurrency: (amount: number) => string
  currencyError: string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCY_OPTIONS.some(option => option.code === value)
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'IDR') {
  const maximumFractionDigits = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(amount)
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [currency, setCurrency] = useState<CurrencyCode>('IDR')
  const [currencyError, setCurrencyError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadCurrency = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) return

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, owner_id, currency_code')
          .eq('id', user.id)
          .single()
        if (profileError) throw profileError

        let currencyProfile = profile
        if (profile.role === 'staff' && profile.owner_id) {
          const { data: ownerProfile, error: ownerError } = await supabase
            .from('profiles')
            .select('currency_code')
            .eq('id', profile.owner_id)
            .single()
          if (ownerError) throw ownerError
          currencyProfile = { ...profile, ...ownerProfile }
        }

        const currencyCode = currencyProfile.currency_code
        if (!isCurrencyCode(currencyCode)) {
          throw new Error('Kode mata uang toko tidak didukung.')
        }

        if (!cancelled) {
          setCurrency(currencyCode)
          setCurrencyError('')
        }
      } catch (error) {
        if (!cancelled) {
          setCurrencyError(error instanceof Error ? error.message : 'Gagal memuat mata uang toko.')
        }
      }
    }

    void loadCurrency()
    return () => { cancelled = true }
  }, [supabase])

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      formatCurrency: (amount: number) => formatCurrency(amount, currency),
      currencyError,
    }),
    [currency, currencyError],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency harus digunakan di dalam CurrencyProvider.')
  return context
}
