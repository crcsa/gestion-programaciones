'use client'

import type { Role } from '@/types/roles'

interface RoleGateProps {
  children: React.ReactNode
  allowedRoles: Role[]
  currentRole: Role | null
  fallback?: React.ReactNode
}

export function RoleGate({ children, allowedRoles, currentRole, fallback = null }: RoleGateProps) {
  if (!currentRole || !allowedRoles.includes(currentRole)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
