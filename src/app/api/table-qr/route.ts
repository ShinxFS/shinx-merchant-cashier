import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createServiceClient,
  createTableQrToken,
  getTableQrTokenSecret,
  hashTableQrToken,
} from '@/lib/table-qr/server'
import { getSelectedServerId } from '@/lib/supabase/server'

export async function POST() {
  const serverId = await getSelectedServerId()
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Unable to verify table QR owner profile:', profileError)
    return NextResponse.json({ error: 'Unable to verify account.' }, { status: 500 })
  }

  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Only store owners can manage table QR codes.' }, { status: 403 })
  }

  const serviceClient = createServiceClient(serverId)
  const secret = getTableQrTokenSecret(serverId)

  if (!serviceClient || !secret) {
    return NextResponse.json(
      { error: `Table QR API is not configured for Server ${serverId}.` },
      { status: 500 }
    )
  }

  const tableNumbers = [1, 2, 3, 4]
  const { data: existingTokens, error: readError } = await serviceClient
    .from('table_qr_tokens')
    .select('table_number, token_version')
    .eq('user_id', user.id)
    .in('table_number', tableNumbers)

  if (readError) {
    console.error('Unable to load table QR tokens:', readError)
    return NextResponse.json({ error: 'Unable to load table QR codes.' }, { status: 500 })
  }

  const tokens: Record<number, string> = {}

  for (const tableNumber of tableNumbers) {
    const existing = existingTokens?.find(row => row.table_number === tableNumber)
    const version = existing?.token_version ?? 1
    const token = createTableQrToken(secret, user.id, tableNumber, version)
    const { error: saveError } = await serviceClient
      .from('table_qr_tokens')
      .upsert(
        {
          user_id: user.id,
          table_number: tableNumber,
          token_version: version,
          token_hash: hashTableQrToken(token),
        },
        { onConflict: 'user_id,table_number' }
      )

    if (saveError) {
      console.error(`Unable to save table ${tableNumber} QR token:`, saveError)
      return NextResponse.json({ error: 'Unable to prepare table QR codes.' }, { status: 500 })
    }

    tokens[tableNumber] = token
  }

  return NextResponse.json({ tokens, serverId }, { headers: { 'Cache-Control': 'no-store' } })
}
