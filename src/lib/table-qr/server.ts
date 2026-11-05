import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerConfig, type SupabaseServerId } from '@/lib/supabase/config'

function getServiceRoleKey(serverId: SupabaseServerId) {
  switch (serverId) {
    case '0':
      return process.env.SUPABASE_SERVICE_ROLE_KEY
    case '1':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_1
    case '2':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_2
    case '3':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_3
    case '4':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_4
    case '5':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_5
    case '6':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_6
    case '7':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_7
    case '8':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_8
    case '9':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_9
    case '10':
      return process.env.SUPABASE_SERVICE_ROLE_KEY_10
  }
}

function getQrSecret(serverId: SupabaseServerId) {
  switch (serverId) {
    case '0':
      return process.env.TABLE_QR_TOKEN_SECRET
    case '1':
      return process.env.TABLE_QR_TOKEN_SECRET_1
    case '2':
      return process.env.TABLE_QR_TOKEN_SECRET_2
    case '3':
      return process.env.TABLE_QR_TOKEN_SECRET_3
    case '4':
      return process.env.TABLE_QR_TOKEN_SECRET_4
    case '5':
      return process.env.TABLE_QR_TOKEN_SECRET_5
    case '6':
      return process.env.TABLE_QR_TOKEN_SECRET_6
    case '7':
      return process.env.TABLE_QR_TOKEN_SECRET_7
    case '8':
      return process.env.TABLE_QR_TOKEN_SECRET_8
    case '9':
      return process.env.TABLE_QR_TOKEN_SECRET_9
    case '10':
      return process.env.TABLE_QR_TOKEN_SECRET_10
  }
}

export function createServiceClient(serverId: SupabaseServerId = '0') {
  const config = getSupabaseServerConfig(serverId)
  const serviceRoleKey = getServiceRoleKey(serverId)

  if (!config || !serviceRoleKey) return null

  return createSupabaseClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getTableQrTokenSecret(serverId: SupabaseServerId = '0') {
  const secret = getQrSecret(serverId)
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null
  return secret
}

export function createTableQrToken(
  secret: string,
  userId: string,
  tableNumber: number,
  version: number
) {
  return createHmac('sha256', secret)
    .update(`${userId}:${tableNumber}:${version}`)
    .digest('base64url')
}

export function hashTableQrToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function isValidTableNumber(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 4
}

export async function resolveTableQrToken(
  serviceClient: NonNullable<ReturnType<typeof createServiceClient>>,
  token: string,
  tableNumber: number
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !isValidTableNumber(tableNumber)) {
    return { userId: null, error: null }
  }

  const { data, error } = await serviceClient
    .from('table_qr_tokens')
    .select('user_id')
    .eq('table_number', tableNumber)
    .eq('token_hash', hashTableQrToken(token))
    .maybeSingle()

  return { userId: data?.user_id ?? null, error }
}
