'use client'

import type { ReactNode } from 'react'
import { useSession } from '@/lib/auth/client'
import type { UserRole } from '@/types/roles'

interface RoleGateProps {
  allowedRoles: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({
  allowedRoles,
  children,
  fallback = null,
}: RoleGateProps) {
  const { data: session } = useSession()

  if (!session?.user) return fallback

  const userWithRole = session.user as typeof session.user & { role?: string }
  if (!userWithRole.role || !allowedRoles.includes(userWithRole.role as UserRole)) {
    return fallback
  }

  return <>{children}</>
}
