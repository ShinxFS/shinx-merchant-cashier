import { NextResponse, type NextRequest } from 'next/server'
import {
  createServiceClient,
  isValidTableNumber,
  resolveTableQrToken,
} from '@/lib/table-qr/server'
import { isSupabaseServerId } from '@/lib/supabase/config'

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

  const [{ data: profile, error: profileError }, { data: products, error: productsError }] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('business_name, qris_image_url, customer_sound_url, customer_tone, currency_code, language_code')
      .eq('id', userId)
      .single(),
    serviceClient
      .from('products')
      .select('id, name, price, stock, image_url, sku, category:categories!category_id(name, color), category2:categories!category_id_2(name, color)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name'),
  ])

  if (profileError || productsError) {
    console.error('Unable to load public table menu:', profileError ?? productsError)
    return NextResponse.json({ error: 'Unable to load the table menu.' }, { status: 500 })
  }

  return NextResponse.json(
    { profile, products: products ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
