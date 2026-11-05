import { createBrowserClient } from '@supabase/ssr'
import {
  getSelectedSupabaseServerId,
  getSupabaseServerConfig,
  SUPABASE_SERVER_COOKIE,
  type SupabaseServerId,
} from './config'

const globalForSupabase = globalThis as typeof globalThis & {
  __shinxSupabaseBrowserClients?: Map<string, unknown>
}

const browserClients =
  globalForSupabase.__shinxSupabaseBrowserClients ??
  (globalForSupabase.__shinxSupabaseBrowserClients = new Map())

function getOrCreateBrowserClient<T>(storageKey: string, create: () => T): T {
  const existingClient = browserClients.get(storageKey)
  if (existingClient !== undefined) return existingClient as T

  const client = create()
  browserClients.set(storageKey, client)
  return client
}

export function getSelectedServerIdFromCookie(): SupabaseServerId {
  if (typeof document === 'undefined') return '0'
  const cookie = document.cookie
    .split('; ')
    .find(value => value.startsWith(`${SUPABASE_SERVER_COOKIE}=`))
  return getSelectedSupabaseServerId(cookie?.split('=').slice(1).join('='))
}

export function selectSupabaseServer(serverId: SupabaseServerId) {
  document.cookie = `${SUPABASE_SERVER_COOKIE}=${serverId}; Path=/; Max-Age=31536000; SameSite=Lax`
  window.dispatchEvent(new Event('shinx-supabase-server-change'))
}

export function subscribeToSupabaseServer(callback: () => void) {
  window.addEventListener('shinx-supabase-server-change', callback)
  return () => window.removeEventListener('shinx-supabase-server-change', callback)
}

export function createClient(serverId?: SupabaseServerId) {
  const selectedServerId = serverId ?? getSelectedServerIdFromCookie()
  const config = getSupabaseServerConfig(selectedServerId)

  if (!config) {
    throw new Error(`Supabase Server ${selectedServerId} is not configured.`)
  }

  if (typeof window === 'undefined') {
    return createBrowserClient(config.url, config.anonKey, { isSingleton: false })
  }

  // Supabase's auth storage key is based on the project ref, not the server selector.
  const projectRef = new URL(config.url).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`
  return getOrCreateBrowserClient(storageKey, () =>
    createBrowserClient(config.url, config.anonKey, { isSingleton: false })
  )
}