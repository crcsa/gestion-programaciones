'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Building2,
  Calendar,
  BarChart3,
  BookUser,
  Settings,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Personal', href: '/personal', icon: Users },
  { name: 'Campañas', href: '/campanas', icon: Megaphone },
  { name: 'Sede', href: '/sede', icon: Building2 },
  { name: 'Programación', href: '/programacion', icon: Calendar },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
  { name: 'Directorio', href: '/directorio', icon: BookUser },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/">
            <Image
              src="/logos/logo-full.svg"
              alt="Cruz Roja Colombiana"
              width={140}
              height={40}
              priority
            />
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <Image
              src="/logos/logo-icon.svg"
              alt="Cruz Roja"
              width={32}
              height={32}
              priority
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', collapsed && 'hidden')}
          onClick={() => setCollapsed(true)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {collapsed && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto flex h-8 w-8"
            onClick={() => setCollapsed(false)}
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}
    </aside>
  )
}
