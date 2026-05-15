'use client'

import type { Area } from '@/types/areas'
import type { Role } from '@/types/roles'
import { canAccess } from '../lib/can-access'

interface AreaGateProps {
  children: React.ReactNode
  allowedAreas: Area[]
  currentArea: Area | null
  currentRole?: Role | null
  /**
   * Si true (default), admin global (role==='admin') con area=null pasa siempre.
   * Internamente `canAccess` ya respeta esta regla; este prop se mantiene por
   * compatibilidad si el caller necesita deshabilitar explícitamente el bypass.
   */
  allowAdminGlobal?: boolean
  /**
   * Si true y currentRole==='comercial', pasa aunque su área no esté en
   * allowedAreas. Útil para vistas de solo lectura cross-área.
   */
  allowCommercialCrossArea?: boolean
  fallback?: React.ReactNode
}

/**
 * Gate de UI por área. Delega la decisión a `canAccess` para que sidebar,
 * middleware y server actions usen el mismo predicate.
 */
export function AreaGate({
  children,
  allowedAreas,
  currentArea,
  currentRole = null,
  allowAdminGlobal = true,
  allowCommercialCrossArea = false,
  fallback = null,
}: AreaGateProps) {
  // Sin role no podemos evaluar — fallback (consistente con un usuario
  // anónimo: no muestra contenido protegido).
  if (!currentRole) return <>{fallback}</>

  // Si el caller deshabilita el bypass de admin global, lo simulamos
  // tratando admin como cualquier otro rol con área obligatoria.
  if (!allowAdminGlobal && currentRole === 'admin') {
    if (!currentArea || !allowedAreas.includes(currentArea)) {
      return <>{fallback}</>
    }
    return <>{children}</>
  }

  const result = canAccess(
    { role: currentRole, area: currentArea },
    {
      roles: [currentRole],
      areas: allowedAreas,
      allowCrossArea: allowCommercialCrossArea,
    },
  )

  return result.allowed ? <>{children}</> : <>{fallback}</>
}
