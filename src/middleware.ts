import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { matchNavItem, requirementFromNavItem } from '@/lib/navigation/nav-items'
import { canAccess } from '@/features/auth/lib/can-access'
import { parseRole } from '@/types/roles'
import { parseArea } from '@/types/areas'

const PUBLIC_ROUTES = ['/login']

/**
 * Si un usuario autenticado no tiene acceso a la ruta solicitada, lo
 * redirigimos a este path. Centralizado para que sea fácil cambiar.
 */
function fallbackHomeFor(role: string): string {
  // Comercial es el único rol cuya home no es '/': el dashboard de comercial
  // está en /campanas (cuando intentan ir a /personal, por ejemplo).
  if (role === 'comercial') return '/campanas'
  return '/'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user, supabase } = await updateSession(request)

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, area, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false) {
    const url = new URL('/login', request.url)
    return NextResponse.redirect(url)
  }

  const role = parseRole(profile.role)
  const area = parseArea(profile.area)

  if (!role) {
    // Profile con rol inválido — redirigir a login.
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // El detalle de campaña (/campanas/<id>) se protege a nivel de página
  // (`getCampaignById` valida rol, asignación y área). Lo permitimos aquí para
  // que el operativo coordinador pueda entrar a su campaña asignada — la lista
  // (/campanas) y las rutas de crear/editar siguen gobernadas por NAV_ITEMS.
  const isCampaignDetail =
    /^\/campanas\/[^/]+$/.test(pathname) && pathname !== '/campanas/nueva'
  if (isCampaignDetail) {
    return supabaseResponse
  }

  // Match contra NAV_ITEMS para derivar los guards.
  const item = matchNavItem(pathname)
  if (!item) {
    // Ruta no listada en navegación (típicamente APIs internas / rutas
    // dinámicas de detalle). La auth ya pasó; permitimos.
    return supabaseResponse
  }

  const result = canAccess({ role, area }, requirementFromNavItem(item))

  if (!result.allowed) {
    return NextResponse.redirect(new URL(fallbackHomeFor(role), request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
