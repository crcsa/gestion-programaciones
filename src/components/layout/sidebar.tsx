'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, requirementFromNavItem } from '@/lib/navigation/nav-items'
import { canAccess } from '@/features/auth/lib/can-access'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

interface SidebarProps {
  role: Role | null
  area?: Area | null
}

export function Sidebar({ role, area = null }: SidebarProps) {
  const pathname = usePathname()

  // Filtrado vía `canAccess` con el mismo `AccessRequirement` que arma el
  // middleware → garantiza que sidebar y middleware nunca divergen.
  const visibleItems = role
    ? NAV_ITEMS.filter(
        (item) => canAccess({ role, area }, requirementFromNavItem(item)).allowed,
      )
    : []

  return (
    <TooltipProvider delay={0}>
      <aside
        className="group/sidebar flex h-screen w-16 flex-col overflow-hidden transition-all duration-300 ease-in-out hover:w-60"
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo area — badge blanco contenido alrededor del logo */}
        <div className="relative flex h-24 shrink-0 items-center justify-center px-1.5">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out group-hover/sidebar:h-20 group-hover/sidebar:w-56">
            {/* Icon: centered, fades out on expand */}
            <Image
              src="/logo-icon.svg"
              alt="CRCSA"
              width={28}
              height={28}
              priority
              className="h-7 w-7 object-contain opacity-100 transition-opacity duration-200 group-hover/sidebar:opacity-0"
            />
            {/* Full logo: centered absolute, fades in on expand */}
            <Image
              src="/logo-full.svg"
              alt="Cruz Roja Colombiana Seccional Antioquia"
              width={224}
              height={72}
              priority
              className="absolute h-16 w-52 object-contain opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100"
            />
          </div>
        </div>

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
                      // Sin prefetch: el sidebar tiene 13 links y Next.js
                      // prefetcha TODOS al hover/render, lo que dispara una
                      // ráfaga de Server Components con queries DB
                      // concurrentes. Cada ruta navega bien on-demand.
                      prefetch={false}
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
