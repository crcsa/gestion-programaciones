import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  isActive: boolean
  activeLabel?: string
  inactiveLabel?: string
  className?: string
}

const ACTIVE_CLASSES =
  'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
const INACTIVE_CLASSES =
  'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'

/**
 * Badge de estado activo/inactivo unificado para toda la app: verde = activo,
 * rojo = inactivo. Reemplaza los `Badge variant="default"` (que usaban el rojo
 * primario para "activo"). Los labels son configurables por género/dominio.
 */
export function StatusBadge({
  isActive,
  activeLabel = 'Activo',
  inactiveLabel = 'Inactivo',
  className,
}: StatusBadgeProps) {
  return (
    <Badge className={cn(isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES, className)}>
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  )
}
