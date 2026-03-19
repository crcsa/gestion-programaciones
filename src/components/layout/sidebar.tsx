'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarDays,
  Settings,
  ChevronRight,
  Clock,
  Grid3x3,
  Building2,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/roles'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  allowedRoles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'banco_sangre', 'comercial', 'operativo'],
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
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    allowedRoles: ['admin'],
  },
]

interface SidebarProps {
  role: Role | null
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !role || item.allowedRoles.includes(role)
  )

  return (
    <TooltipProvider delay={0}>
      <aside
        className="group/sidebar flex h-screen w-16 flex-col overflow-hidden transition-all duration-300 ease-in-out hover:w-60"
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo area */}
        <div className="relative flex h-16 items-center justify-center">
          {/* Icon: centered, fades out on expand */}
          <img
            src="/logo-icon.svg"
            alt="CRCSA"
            className="h-9 w-9 object-contain opacity-100 transition-opacity duration-200 group-hover/sidebar:opacity-0"
          />
          {/* Full logo: centered absolute, fades in on expand */}
          <img
            src="/logo-full-dark.svg"
            alt="Cruz Roja Colombiana Seccional Antioquia"
            className="absolute h-16 w-60 object-contain opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100"
          />
        </div>

        {/* Divider */}
        <div className="mx-3 border-t" style={{ borderColor: 'var(--sidebar-border)' }} />

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-2 pt-3">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        'flex h-9 items-center rounded-md px-2.5 transition-colors',
                        isActive ? 'text-white' : 'hover:text-white'
                      )}
                      style={{
                        color: isActive ? 'var(--sidebar-fg-active)' : 'var(--sidebar-fg)',
                        backgroundColor: isActive ? 'var(--sidebar-item-active)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--sidebar-item-hover)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = ''
                        }
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="ml-3 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-all duration-300 group-hover/sidebar:opacity-100">
                        {item.label}
                      </span>
                      {isActive && (
                        <ChevronRight className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/sidebar:opacity-100" />
                      )}
                    </Link>
                  }
                />
                <TooltipContent side="right" className="group-hover/sidebar:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom spacer */}
        <div className="p-2">
          <div className="h-px w-full" style={{ backgroundColor: 'var(--sidebar-border)' }} />
        </div>
      </aside>
    </TooltipProvider>
  )
}
