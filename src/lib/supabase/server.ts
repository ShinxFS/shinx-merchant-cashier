import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getSelectedSupabaseServerId,
  getSupabaseServerConfig,
  SUPABASE_SERVER_COOKIE,
} from './config'

export async function createClient() {
  const cookieStore = await cookies()
  const serverId = getSelectedSupabaseServerId(cookieStore.get(SUPABASE_SERVER_COOKIE)?.value)
  const config = getSupabaseServerConfig(serverId)

  if (!config) {
    throw new Error(`Supabase Server ${serverId} is not configured.`)
  }

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function getSelectedServerId() {
  const cookieStore = await cookies()
  return getSelectedSupabaseServerId(cookieStore.get(SUPABASE_SERVER_COOKIE)?.value)
}