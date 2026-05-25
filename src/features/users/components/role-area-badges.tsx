import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, type Role } from '@/types/roles'
import { AREA_LABELS, type Area } from '@/types/areas'

// Colores por rol/área para mejorar la lectura visual de la tabla de usuarios.
// Cada valor usa un hue distinto (relleno suave + texto, con variante dark),
// evitando verde (activo) y rojo puro (inactivo) que ya tienen semántica de estado.
const ROLE_CLASSES: Record<Role, string> = {
  admin:
    'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  admin_area:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  comercial:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  operativo:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
}

const AREA_CLASSES: Record<Area, string> = {
  banco_sangre:
    'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  comercial:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  logistica:
    'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
}

const AREA_GLOBAL_CLASSES =
  'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={ROLE_CLASSES[role]}>{ROLE_LABELS[role]}</Badge>
}

export function AreaBadge({ area }: { area: Area | null }) {
  if (!area) return <Badge className={AREA_GLOBAL_CLASSES}>Global</Badge>
  return <Badge className={AREA_CLASSES[area]}>{AREA_LABELS[area]}</Badge>
}
