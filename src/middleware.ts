import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ROUTE_PERMISSIONS } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/roles'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('better-auth.session_token')

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const sessionResponse = await fetch(
    new URL('/api/auth/get-session', request.url),
    {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
    },
  )

  if (!sessionResponse.ok) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await sessionResponse.json()

  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const userRole = session.user.role as UserRole

  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname.startsWith(route))

  if (matchedRoute) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedRoute]
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos|api/auth).*)'],
}
