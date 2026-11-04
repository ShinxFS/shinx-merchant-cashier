export const SUPABASE_SERVER_COOKIE = 'shinx_supabase_server'

export type SupabaseServerId = '0' | '1' | '2' | '3' | '4'

export interface SupabaseServerConfig {
  id: SupabaseServerId
  url: string
  anonKey: string
}

const serverConfigs: Record<SupabaseServerId, SupabaseServerConfig | null> = {
  '0': process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? {
        id: '0',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    : null,
  '1': process.env.NEXT_PUBLIC_SUPABASE_URL_1 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_1
    ? {
        id: '1',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_1,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_1,
      }
    : null,
  '2': process.env.NEXT_PUBLIC_SUPABASE_URL_2 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_2
    ? {
        id: '2',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_2,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_2,
      }
    : null,
  '3': process.env.NEXT_PUBLIC_SUPABASE_URL_3 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_3
    ? {
        id: '3',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_3,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_3,
      }
    : null,
  '4': process.env.NEXT_PUBLIC_SUPABASE_URL_4 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_4
    ? {
        id: '4',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_4,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_4,
      }
    : null,
}

export function isSupabaseServerId(value: unknown): value is SupabaseServerId {
  return value === '0' || value === '1' || value === '2' || value === '3' || value === '4'
}

export function getSupabaseServerConfig(serverId: SupabaseServerId) {
  return serverConfigs[serverId]
}

export function isSupabaseServerConfigured(serverId: SupabaseServerId) {
  return serverConfigs[serverId] !== null
}

export function getSelectedSupabaseServerId(value: unknown): SupabaseServerId {
  return isSupabaseServerId(value) && serverConfigs[value] ? value : '0'
}
