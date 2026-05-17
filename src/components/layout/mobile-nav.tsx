'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/navigation/nav-items'
import type { Role } from '@/types/roles'

interface MobileNavProps {
  role: Role | null
}

export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !role || item.allowedRoles.includes(role)
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        }
      />
      <SheetContent
        side="left"
        className="w-64 p-0"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        <SheetHeader className="p-4">
          <SheetTitle className="sr-only">Programaciones CRCSA</SheetTitle>
          <div className="relative flex h-14 w-48 items-center justify-center rounded-lg bg-white px-3 shadow-sm">
            <Image
              src="/logo-full.svg"
              alt="Cruz Roja Colombiana Seccional Antioquia"
              width={176}
              height={44}
              priority
              className="h-11 w-44 object-contain"
            />
          </div>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'
                )}
                style={{
                  backgroundColor: isActive ? 'rgba(200, 16, 46, 0.15)' : undefined,
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
