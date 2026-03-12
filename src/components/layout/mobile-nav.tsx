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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
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

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <LayoutDashboard className="h-5 w-5" />
        <span className="sr-only">Abrir menú</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-16 items-center border-b px-4">
            <Image
              src="/logos/logo-full.svg"
              alt="Cruz Roja Colombiana"
              width={140}
              height={40}
            />
          </div>
          <nav className="space-y-1 p-2">
            {navigation.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
