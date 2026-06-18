'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRole() {
  const [role, setRole] = useState<'owner' | 'staff' | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('role, owner_id')
        .eq('id', user.id)
        .single()

      setRole(data?.role as 'owner' | 'staff' ?? 'owner')
      setOwnerId(data?.owner_id ?? null)
      setLoading(false)
    }
    load()
  }, [])

  const isOwner = role === 'owner'
  const isStaff = role === 'staff'

  return { role, ownerId, isOwner, isStaff, loading }
}