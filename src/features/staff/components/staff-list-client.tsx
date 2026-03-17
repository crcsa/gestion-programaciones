'use client'

import { useState, useCallback, useEffect } from 'react'
import { StaffFilters } from './staff-filters'
import { StaffTable } from './staff-table'
import { StaffFormModal } from './staff-form-modal'
import { getStaffList } from '@/features/staff/actions/staff-actions'
import { RoleGate } from '@/features/auth/components/role-gate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PAGE_LIMIT } from '@/features/staff/lib/constants'
import type { StaffListFilters, StaffListResult } from '@/features/staff/actions/staff-actions'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { TrainingArea } from '@/lib/db/schema/training-areas'
import type { Role } from '@/types/roles'

interface StaffListClientProps {
  initialData: StaffListResult
  areas: TrainingArea[]
  currentRole: Role | null
}

export function StaffListClient({ initialData, areas, currentRole }: StaffListClientProps) {
  const [data, setData] = useState<StaffMember[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StaffListFilters>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

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

  const handleEdit = useCallback((staff: StaffMember) => {
    setEditingStaff(staff)
    setModalOpen(true)
  }, [])

  const handleNuevo = useCallback(() => {
    setEditingStaff(null)
    setModalOpen(true)
  }, [])

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open)
    if (!open) setEditingStaff(null)
  }, [])

  const handleSuccess = useCallback(() => {
    fetchData(filters, page)
  }, [fetchData, filters, page])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de funcionarios del banco de sangre
          </p>
        </div>

        <RoleGate allowedRoles={['admin', 'banco_sangre']} currentRole={currentRole}>
          <Button onClick={handleNuevo}>
            Nuevo
          </Button>
        </RoleGate>
      </div>

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
          onEdit={handleEdit}
        />
      )}

      {editingStaff !== null ? (
        <StaffFormModal
          mode="edit"
          open={modalOpen}
          onOpenChange={handleModalOpenChange}
          staffId={editingStaff.id}
          defaultValues={{
            firstName: editingStaff.firstName,
            lastName: editingStaff.lastName,
            cedula: editingStaff.cedula,
            phone: editingStaff.phone ?? undefined,
            staffProfile: editingStaff.staffProfile,
            contractType: editingStaff.contractType,
            weeklyHours: editingStaff.weeklyHours,
            defaultShift: editingStaff.defaultShift,
          }}
          areas={areas}
          onSuccess={handleSuccess}
        />
      ) : (
        <StaffFormModal
          mode="create"
          open={modalOpen}
          onOpenChange={handleModalOpenChange}
          areas={areas}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
