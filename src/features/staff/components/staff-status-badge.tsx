import { Badge } from '@/components/ui/badge'

interface StaffStatusBadgeProps {
  isActive: boolean
}

export function StaffStatusBadge({ isActive }: StaffStatusBadgeProps) {
  if (isActive) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
        Activo
      </Badge>
    )
  }

  return (
    <Badge className="bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700">
      Inactivo
    </Badge>
  )
}
