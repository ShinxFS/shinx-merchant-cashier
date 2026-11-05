export const SUPABASE_SERVER_COOKIE = 'shinx_supabase_server'

export const SUPABASE_SERVER_IDS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
] as const

export type SupabaseServerId = (typeof SUPABASE_SERVER_IDS)[number]

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
  '5': process.env.NEXT_PUBLIC_SUPABASE_URL_5 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_5
    ? {
        id: '5',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_5,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_5,
      }
    : null,
  '6': process.env.NEXT_PUBLIC_SUPABASE_URL_6 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_6
    ? {
        id: '6',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_6,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_6,
      }
    : null,
  '7': process.env.NEXT_PUBLIC_SUPABASE_URL_7 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_7
    ? {
        id: '7',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_7,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_7,
      }
    : null,
  '8': process.env.NEXT_PUBLIC_SUPABASE_URL_8 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_8
    ? {
        id: '8',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_8,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_8,
      }
    : null,
  '9': process.env.NEXT_PUBLIC_SUPABASE_URL_9 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_9
    ? {
        id: '9',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_9,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_9,
      }
    : null,
  '10': process.env.NEXT_PUBLIC_SUPABASE_URL_10 && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_10
    ? {
        id: '10',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL_10,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_10,
      }
    : null,
}

export function isSupabaseServerId(value: unknown): value is SupabaseServerId {
  return typeof value === 'string' && SUPABASE_SERVER_IDS.some(serverId => serverId === value)
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
