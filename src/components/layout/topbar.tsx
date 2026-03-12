'use client'

import { useRouter } from 'next/navigation'
import { signOut, useSession } from '@/lib/auth/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS, type UserRole } from '@/types/roles'
import { LogOut, User } from 'lucide-react'
import { MobileNav } from './mobile-nav'

export function Topbar() {
  const { data: session } = useSession()
  const router = useRouter()

  const user = session?.user
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  const userRole = (user as typeof user & { role?: string })?.role as
    | UserRole
    | undefined

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <MobileNav />
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium">{user?.name ?? 'Usuario'}</p>
            {userRole && (
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[userRole]}
              </p>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
