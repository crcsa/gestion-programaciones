import { StatusBadge } from '@/components/ui/status-badge'

interface StaffStatusBadgeProps {
  isActive: boolean
}

export function StaffStatusBadge({ isActive }: StaffStatusBadgeProps) {
  return <StatusBadge isActive={isActive} />
}
