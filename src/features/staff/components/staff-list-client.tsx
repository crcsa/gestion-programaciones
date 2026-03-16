'use client'

import { useState, useCallback, useEffect } from 'react'
import { StaffFilters } from './staff-filters'
import { StaffTable } from './staff-table'
import { getStaffList } from '@/features/staff/actions/staff-actions'
import type { StaffListFilters, StaffListResult } from '@/features/staff/actions/staff-actions'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import { Skeleton } from '@/components/ui/skeleton'
import { PAGE_LIMIT } from '@/features/staff/lib/constants'

interface StaffListClientProps {
  initialData: StaffListResult
}

export function StaffListClient({ initialData }: StaffListClientProps) {
  const [data, setData] = useState<StaffMember[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StaffListFilters>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(
    async (nextFilters: StaffListFilters, nextPage: number) => {
      setIsLoading(true)
      try {
        const result = await getStaffList({ ...nextFilters, page: nextPage, limit: PAGE_LIMIT })
        setError(null)
        setData(result.data)
        setTotal(result.total)
      } catch {
        setError('Error al cargar el personal. Intente de nuevo.')
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (page === 1 && Object.keys(filters).length === 0) return
    fetchData(filters, page)
  }, [filters, page, fetchData])

  const handleFiltersChange = useCallback((newFilters: StaffListFilters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  return (
    <div className="space-y-4">
      <StaffFilters onFiltersChange={handleFiltersChange} />

      {error !== null && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <StaffTable
          data={data}
          total={total}
          page={page}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  )
}
