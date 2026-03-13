import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    label: string
  }
}

export function StatCard({ title, value, icon: Icon, description, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <p
            className={`mt-1 text-xs ${trend.value >= 0 ? 'text-green-600' : 'text-destructive'}`}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
