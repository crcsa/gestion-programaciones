import { Badge } from '@/components/ui/badge'
import { CAMPAIGN_STATUS_LABELS } from '@/features/campaigns/lib/constants'
import type { Campaign } from '@/lib/db/schema/campaigns'

interface CampaignStatusBadgeProps {
  status: Campaign['status']
}

const STATUS_CLASSES: Record<Campaign['status'], string> = {
  tentativa:
    'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  confirmada:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  cancelada:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  ejecutada:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
}

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  return (
    <Badge className={STATUS_CLASSES[status]}>
      {CAMPAIGN_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
