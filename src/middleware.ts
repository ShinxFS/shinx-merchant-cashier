import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getSelectedSupabaseServerId,
  getSupabaseServerConfig,
  SUPABASE_SERVER_COOKIE,
} from '@/lib/supabase/config'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const serverId = getSelectedSupabaseServerId(request.cookies.get(SUPABASE_SERVER_COOKIE)?.value)
  const config = getSupabaseServerConfig(serverId)
  const isPublicRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/table') ||
    request.nextUrl.pathname.startsWith('/api/table-menu') ||
    request.nextUrl.pathname.startsWith('/api/table-orders') ||
    request.nextUrl.pathname.startsWith('/api/table-qr')

  let userExists = false
  if (config) {
    const supabase = createServerClient(config.url, config.anonKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    userExists = Boolean(user)
  }

  if (!userExists && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (userExists && (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}