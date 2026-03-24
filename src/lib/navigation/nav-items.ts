import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarDays,
  Settings,
  Clock,
  Grid3x3,
  Building2,
  BarChart3,
  ShieldCheck,
} from 'lucide-react'
import type { Role } from '@/types/roles'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  allowedRoles: readonly Role[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'banco_sangre', 'comercial', 'operativo'],
  },
  {
    label: 'Mi Agenda',
    href: '/mi-agenda',
    icon: CalendarDays,
    allowedRoles: ['operativo', 'banco_sangre', 'admin', 'comercial'],
  },
  {
    label: 'Personal',
    href: '/personal',
    icon: Users,
    allowedRoles: ['admin', 'banco_sangre'],
  },
  {
    label: 'Campañas',
    href: '/campanas',
    icon: Megaphone,
    allowedRoles: ['admin', 'banco_sangre', 'comercial'],
  },
  {
    label: 'Turnos',
    href: '/turnos',
    icon: CalendarDays,
    allowedRoles: ['admin', 'banco_sangre'],
  },
  {
    label: 'Horas',
    href: '/horas',
    icon: Clock,
    allowedRoles: ['admin', 'banco_sangre'],
  },
  {
    label: 'Disponibilidad',
    href: '/disponibilidad',
    icon: Grid3x3,
    allowedRoles: ['admin', 'banco_sangre'],
  },
  {
    label: 'Empresas',
    href: '/empresas',
    icon: Building2,
    allowedRoles: ['admin', 'comercial'],
  },
  {
    label: 'Reportes',
    href: '/reportes',
    icon: BarChart3,
    allowedRoles: ['admin', 'banco_sangre', 'comercial'],
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
