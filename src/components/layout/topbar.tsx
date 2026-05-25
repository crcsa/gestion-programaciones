'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sun, Moon, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Breadcrumbs } from './breadcrumbs'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import { signOut } from '@/features/auth/actions/auth-actions'
import type { Role } from '@/types/roles'
import { ROLE_LABELS } from '@/types/roles'

interface TopbarProps {
  userEmail?: string
  role: Role | null
}

function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-8 w-8"
      aria-label="Cambiar tema"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

export function Topbar({ userEmail, role }: TopbarProps) {
  const router = useRouter()
  const [signingOut, startTransition] = useTransition()
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'US'

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut()
      // Forzamos navegación dura: replace() + refresh() asegura que el
      // estado de React del dashboard se descarta antes de que el siguiente
      // login monte sus componentes. Sin esto los efectos del dashboard (p.ej.
      // NotificationBell) siguen ejecutándose con cookies vacías.
      router.replace('/login')
      router.refresh()
    })
  }

  return (
    <header className="flex h-14 items-center border-b border-border bg-background px-4 gap-4">
      <div className="flex-1">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {/*
              Base UI requiere que los parts (Label, Item, Separator) vivan
              dentro de un <Menu.Group>. Sin ello lanza "MenuGroupRootContext
              is missing". Un único Group envuelve todo el contenido del menú.
            */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  {role && (
                    <p className="text-xs font-medium text-primary">{ROLE_LABELS[role]}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => router.push('/mi-perfil')}
              >
                <User className="h-4 w-4" />
                Mi perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
                data-variant="destructive"
                disabled={signingOut}
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
