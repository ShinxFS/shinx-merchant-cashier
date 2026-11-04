import { NextResponse, type NextRequest } from 'next/server'
import {
  createServiceClient,
  hashTableQrToken,
  isValidTableNumber,
  resolveTableQrToken,
} from '@/lib/table-qr/server'
import { isSupabaseServerId } from '@/lib/supabase/config'

const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params
  const requestedServerId = request.nextUrl.searchParams.get('server') ?? '0'
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const tableNumber = Number(request.nextUrl.searchParams.get('table'))

  if (
    !isSupabaseServerId(requestedServerId) ||
    !orderIdPattern.test(orderId) ||
    !isValidTableNumber(tableNumber)
  ) {
    return NextResponse.json({ error: 'Invalid order request.' }, { status: 400 })
  }

  const serviceClient = createServiceClient(requestedServerId)
  if (!serviceClient) {
    return NextResponse.json({ error: 'Table QR API is not configured.' }, { status: 500 })
  }

  const { userId, error: tokenError } = await resolveTableQrToken(serviceClient, token, tableNumber)
  if (tokenError) {
    console.error('Unable to validate table QR token:', tokenError)
    return NextResponse.json({ error: 'Unable to validate this table QR code.' }, { status: 500 })
  }
  if (!userId) {
    return NextResponse.json({ error: 'This table QR code is invalid or has expired.' }, { status: 403 })
  }

  const { error } = await serviceClient.rpc('cancel_table_order_from_qr', {
    p_token_hash: hashTableQrToken(token),
    p_table_number: tableNumber,
    p_order_id: orderId,
  })

  if (error) {
    console.error('Unable to cancel QR table order:', error)
    const status = error.message.includes('ORDER_NOT_CANCELLABLE') ? 409
      : error.message.includes('INVALID_QR_TOKEN') ? 403
        : 500
    return NextResponse.json(
      { error: status === 409
        ? 'This order can no longer be cancelled.'
        : status === 403
          ? 'This table QR code is invalid or has expired.'
          : 'Unable to cancel the order.' },
      { status }
    )
  }

  return NextResponse.json({ success: true })
}
