import { Skeleton } from '@/components/ui/skeleton'

export function StaffTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Skeleton className="h-8 w-full sm:flex-1" />
        <Skeleton className="h-8 w-full sm:w-48" />
        <Skeleton className="h-8 w-full sm:w-40" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
