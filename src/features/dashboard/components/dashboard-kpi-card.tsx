import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Card } from '@/components/ui/card'

export type KpiAccent = 'blue' | 'green' | 'amber' | 'red'

const ACCENT_TOKENS: Record<KpiAccent, { base: string; soft: string }> = {
  blue: { base: '#0ea5e9', soft: 'rgba(14, 165, 233, 0.14)' },
  green: { base: '#10b981', soft: 'rgba(16, 185, 129, 0.14)' },
  amber: { base: '#f59e0b', soft: 'rgba(245, 158, 11, 0.16)' },
  red: { base: '#f43f5e', soft: 'rgba(244, 63, 94, 0.16)' },
}

interface DashboardKpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  accent: KpiAccent
  description?: string
  hint?: string
}

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  accent,
  description,
  hint,
}: DashboardKpiCardProps) {
  const tokens = ACCENT_TOKENS[accent]
  const cardStyle: CSSProperties = {
    borderColor: `${tokens.base}55`,
    boxShadow: `0 10px 30px -10px ${tokens.base}80, 0 4px 12px -4px ${tokens.base}55`,
  }
  const iconWrapStyle: CSSProperties = {
    backgroundColor: tokens.soft,
    color: tokens.base,
    boxShadow: `inset 0 0 0 1px ${tokens.base}66`,
  }

  return (
    <Card
      className="group relative border p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={cardStyle}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </span>
          <span className="text-3xl font-bold leading-none tabular-nums text-foreground">
            {value}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>

        <span
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={iconWrapStyle}
          aria-hidden="true"
        >
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
      </div>

      {description && (
        <p className="relative mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </Card>
  )
}
