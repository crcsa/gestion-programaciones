'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/data-display/data-table'
import { staffColumns } from '@/features/staff/components/staff-columns'
import { StaffFilters } from '@/features/staff/components/staff-filters'
import { getStaffMembers } from '@/features/staff/actions/staff-actions'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function PersonalPage() {
  const [search, setSearch] = useState('')
  const [profileType, setProfileType] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['staff', debouncedSearch, profileType, status, page],
    queryFn: () =>
      getStaffMembers({
        search: debouncedSearch || undefined,
        profileType: profileType === 'all' ? undefined : profileType as any,
        isActive: status === 'all' ? undefined : status === 'active',
        page,
        limit: 20,
        sortBy: 'lastName',
        sortDirection: 'asc',
      }),
  })

  const staffData = data?.success ? data.data.data : []

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleProfileTypeChange = useCallback((value: string | null) => {
    setProfileType(value ?? 'all')
    setPage(1)
  }, [])

  const handleStatusChange = useCallback((value: string | null) => {
    setStatus(value ?? 'all')
    setPage(1)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal</h1>
          <p className="text-muted-foreground">
            Directorio del personal del Banco de Sangre
          </p>
        </div>
        <Link href="/personal/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Button>
        </Link>
      </div>

      <StaffFilters
        search={search}
        onSearchChange={handleSearchChange}
        profileType={profileType}
        onProfileTypeChange={handleProfileTypeChange}
        status={status}
        onStatusChange={handleStatusChange}
      />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Cargando personal...
        </div>
      ) : (
        <DataTable columns={staffColumns} data={staffData} />
      )}
    </div>
  )
}
