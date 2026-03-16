'use client'

import { useState, useCallback, useEffect } from 'react'
import { StaffFilters } from './staff-filters'
import { StaffTable } from './staff-table'
import { getStaffList } from '@/features/staff/actions/staff-actions'
import type { StaffListFilters, StaffListResult } from '@/features/staff/actions/staff-actions'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import { Skeleton } from '@/components/ui/skeleton'

interface StaffListClientProps {
  initialData: StaffListResult
}

export function StaffListClient({ initialData }: StaffListClientProps) {
  const [data, setData] = useState<StaffMember[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StaffListFilters>({})
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(
    async (nextFilters: StaffListFilters, nextPage: number) => {
      setIsLoading(true)
      try {
        const result = await getStaffList({ ...nextFilters, page: nextPage, limit: 20 })
        setData(result.data)
        setTotal(result.total)
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
