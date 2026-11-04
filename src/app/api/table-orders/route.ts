import { NextResponse, type NextRequest } from 'next/server'
import {
  createServiceClient,
  hashTableQrToken,
  isValidTableNumber,
  resolveTableQrToken,
} from '@/lib/table-qr/server'
import { isSupabaseServerId } from '@/lib/supabase/config'

const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const requestedServerId = request.nextUrl.searchParams.get('server') ?? '0'
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const tableNumber = Number(request.nextUrl.searchParams.get('table'))

  if (!isSupabaseServerId(requestedServerId)) {
    return NextResponse.json({ error: 'Invalid server.' }, { status: 400 })
  }

  if (!isValidTableNumber(tableNumber)) {
    return NextResponse.json({ error: 'Invalid table number.' }, { status: 400 })
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

  const { data: orders, error } = await serviceClient
    .from('table_orders')
    .select('id, status, table_number, items, total, payment_method, note, updated_at, created_at')
    .eq('user_id', userId)
    .eq('table_number', tableNumber)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Unable to load table order status:', error)
    return NextResponse.json({ error: 'Unable to load order status.' }, { status: 500 })
  }

  const order = orders?.find(row => row.status !== 'done') ?? orders?.[0] ?? null
  return NextResponse.json({ order }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid order request.' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const requestedServerId = payload.serverId ?? '0'
  const token = typeof payload.token === 'string' ? payload.token : ''
  const tableNumber = Number(payload.tableNumber)
  const paymentMethod = payload.paymentMethod
  const note = typeof payload.note === 'string' ? payload.note.trim() : ''

  if (
    !isSupabaseServerId(requestedServerId) ||
    !isValidTableNumber(tableNumber) ||
    (paymentMethod !== 'cash' && paymentMethod !== 'qris') ||
    (payload.note !== undefined && typeof payload.note !== 'string') ||
    note.length > 500 ||
    !Array.isArray(payload.items) ||
    payload.items.length < 1 ||
    payload.items.length > 100
  ) {
    return NextResponse.json({ error: 'Invalid order details.' }, { status: 400 })
  }

  const items: Array<{ productId: string; quantity: number }> = []
  for (const value of payload.items) {
    if (!value || typeof value !== 'object') {
      return NextResponse.json({ error: 'Invalid order item.' }, { status: 400 })
    }

    const item = value as Record<string, unknown>
    if (
      typeof item.productId !== 'string' ||
      !productIdPattern.test(item.productId) ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1 ||
      Number(item.quantity) > 999
    ) {
      return NextResponse.json({ error: 'Invalid order item.' }, { status: 400 })
    }

    items.push({ productId: item.productId, quantity: Number(item.quantity) })
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

  const { data: orderId, error } = await serviceClient.rpc('create_table_order_from_qr', {
    p_token_hash: hashTableQrToken(token),
    p_table_number: tableNumber,
    p_items: items,
    p_customer_note: note,
    p_payment_method: paymentMethod,
  })

  if (error) {
    console.error('Unable to create QR table order:', error)
    const status = error.message.includes('INSUFFICIENT_STOCK') ? 409
      : error.message.includes('INVALID_QR_TOKEN') ? 403
        : error.message.includes('INVALID_ORDER') || error.message.includes('PRODUCT_UNAVAILABLE') ? 400
          : 500
    return NextResponse.json(
      { error: status === 409
        ? 'One or more products no longer have enough stock.'
        : status === 403
          ? 'This table QR code is invalid or has expired.'
          : status === 400
            ? 'Some products are unavailable. Reload the menu and try again.'
            : 'Unable to create the order.' },
      { status }
    )
  }

  return NextResponse.json({ id: orderId })
}
