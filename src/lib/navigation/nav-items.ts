import {
  LayoutDashboard,
  Users,
  UserCog,
  Megaphone,
  CalendarDays,
  Settings,
  Clock,
  Grid3x3,
  Building2,
  BarChart3,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'
import type { AccessRequirement } from '@/features/auth/lib/can-access'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  allowedRoles: readonly Role[]
  /**
   * Áreas a las que se restringe el item. Si no se especifica, es agnóstico
   * al área. Admin global ve todos los items con allowedRoles=admin.
   */
  allowedAreas?: readonly Area[]
  /**
   * Si true, comercial puede leer cross-área (vistas read-only). Equivale
   * a pasar `allowCrossArea: true` al `canAccess` evaluado para este item.
   */
  allowCommercialCrossArea?: boolean
}

/**
 * Encuentra el item más específico que coincide con `pathname`. Usa
 * `startsWith` y prefiere la coincidencia más larga (p.ej. `/usuarios/nuevo`
 * matchea `/usuarios`).
 *
 * Retorna `null` si no hay match — el caller decide qué hacer (típicamente
 * permitir, ya que la auth básica ya pasó).
 */
/**
 * Convierte un `NavItem` en el `AccessRequirement` que consumen `canAccess`,
 * `requireAccess` y `<AreaGate>`. Centraliza la traducción entre la
 * declaración del nav y el predicate de auth para que middleware y sidebar
 * sigan exactamente la misma lógica.
 */
export function requirementFromNavItem(item: NavItem): AccessRequirement {
  return {
    roles: [...item.allowedRoles],
    ...(item.allowedAreas ? { areas: [...item.allowedAreas] } : {}),
    ...(item.allowCommercialCrossArea ? { allowCrossArea: true } : {}),
  }
}

export function matchNavItem(pathname: string): NavItem | null {
  let best: NavItem | null = null
  for (const item of NAV_ITEMS) {
    // El item "Dashboard" tiene href='/' que matchearía todo: lo limitamos
    // a un match exacto.
    if (item.href === '/') {
      if (pathname === '/') return item
      continue
    }
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) {
        best = item
      }
    }
  }
  return best
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'admin_area', 'comercial', 'operativo'],
  },
  {
    label: 'Mi Agenda',
    href: '/mi-agenda',
    icon: CalendarDays,
    allowedRoles: ['operativo', 'admin_area', 'admin', 'comercial'],
  },
  {
    label: 'Personal',
    href: '/personal',
    icon: Users,
    allowedRoles: ['admin', 'admin_area'],
  },
  {
    label: 'Campañas',
    href: '/campanas',
    icon: Megaphone,
    allowedRoles: ['admin', 'admin_area', 'comercial'],
  },
  {
    label: 'Turnos',
    href: '/turnos',
    icon: CalendarDays,
    allowedRoles: ['admin', 'admin_area'],
  },
  {
    label: 'Horas',
    href: '/horas',
    icon: Clock,
    // Comercial puede ver cross-área en read-only (mismo patrón que /reportes).
    allowedRoles: ['admin', 'admin_area', 'comercial'],
    allowCommercialCrossArea: true,
  },
  {
    label: 'Disponibilidad',
    href: '/disponibilidad',
    icon: Grid3x3,
    // Comercial necesita ver disponibilidad de los 3 áreas para planificar campañas.
    allowedRoles: ['admin', 'admin_area', 'comercial'],
    allowCommercialCrossArea: true,
  },
  {
    label: 'Empresas',
    href: '/empresas',
    icon: Building2,
    allowedRoles: ['admin', 'comercial'],
  },
  {
    label: 'Vehículos',
    href: '/vehiculos',
    icon: Truck,
    allowedRoles: ['admin', 'admin_area'],
    allowedAreas: ['logistica'],
  },
  {
    label: 'Reportes',
    href: '/reportes',
    icon: BarChart3,
    allowedRoles: ['admin', 'admin_area', 'comercial'],
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: UserCog,
    // admin_area también gestiona usuarios — pero solo de su misma área
    // (filtrado por scope en server actions).
    allowedRoles: ['admin', 'admin_area'],
  },
  {
    label: 'Auditoría',
    href: '/auditoria',
    icon: ShieldCheck,
    allowedRoles: ['admin'],
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    allowedRoles: ['admin'],
  },
]
