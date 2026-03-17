import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CAMPAIGN_SIZE_LABELS,
  CAMPAIGN_SIZE_COMPOSITION,
} from '@/features/campaigns/lib/constants'
import type { Campaign } from '@/lib/db/schema/campaigns'

interface CampaignSizeBadgeProps {
  size: Campaign['size']
}

const SIZE_CLASSES: Record<Campaign['size'], string> = {
  S: 'bg-slate-100 text-slate-700 border-slate-200',
  S_plus: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  M: 'bg-violet-100 text-violet-700 border-violet-200',
  L: 'bg-orange-100 text-orange-700 border-orange-200',
}

function buildTooltipText(size: Campaign['size']): string {
  const { bacteriologos, tecnicos } = CAMPAIGN_SIZE_COMPOSITION[size]
  const label = CAMPAIGN_SIZE_LABELS[size]
  const bLabel = (bacteriologos as number) > 1 ? 'bacteriólogos' : 'bacteriólogo'
  const tLabel = 'técnicos'
  return `${label}: ${bacteriologos} ${bLabel} + ${tecnicos} ${tLabel}`
}

export function CampaignSizeBadge({ size }: CampaignSizeBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className={SIZE_CLASSES[size]}>
            {CAMPAIGN_SIZE_LABELS[size] ?? size}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{buildTooltipText(size)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
