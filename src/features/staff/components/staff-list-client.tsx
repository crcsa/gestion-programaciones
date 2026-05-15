'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { StaffFilters } from './staff-filters'
import { StaffTable } from './staff-table'
import { StaffFormModal } from './staff-form-modal'
import { StaffImportDialog } from './staff-import-dialog'
import { getStaffList, deleteStaff } from '@/features/staff/actions/staff-actions'
import { RoleGate } from '@/features/auth/components/role-gate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PAGE_LIMIT } from '@/features/staff/lib/constants'
import type { StaffListFilters, StaffListResult, StaffListRow } from '@/features/staff/actions/staff-types'
import type { TrainingArea } from '@/lib/db/schema/training-areas'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

interface StaffListClientProps {
  initialData: StaffListResult
  areas: TrainingArea[]
  currentRole: Role | null
  /** Área del caller. NULL para admin global (puede elegir cualquier área). */
  currentArea: Area | null
  defaultWeeklyHours: number
}

export function StaffListClient({
  initialData,
  areas,
  currentRole,
  currentArea,
  defaultWeeklyHours,
}: StaffListClientProps) {
  // Admin global puede elegir el área en el form; admin de área queda anclado.
  const canSelectArea = currentRole === 'admin'
  const [data, setData] = useState<StaffListRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StaffListFilters>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffListRow | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingStaff, setDeletingStaff] = useState<StaffListRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Salta el primer render porque ya tenemos initialData; cualquier cambio
  // posterior (incluso limpiar todos los filtros) debe refetch para no quedarse
  // mostrando resultados filtrados rancios.
  const hasMountedRef = useRef(false)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    fetchData(filters, page)
  }, [filters, page, fetchData])

  const handleFiltersChange = useCallback((newFilters: StaffListFilters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleEdit = useCallback((staff: StaffListRow) => {
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

  const handleDeleteRequest = useCallback((staff: StaffListRow) => {
    setDeletingStaff(staff)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingStaff) return
    setIsDeleting(true)
    try {
      await deleteStaff(deletingStaff.id)
      toast.success(`${deletingStaff.firstName} ${deletingStaff.lastName} eliminado correctamente`)
      setDeleteDialogOpen(false)
      setDeletingStaff(null)
      fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el colaborador')
    } finally {
      setIsDeleting(false)
    }
  }, [deletingStaff, fetchData, filters, page])

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open)
    if (!open) setDeletingStaff(null)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de colaboradores del banco de sangre
          </p>
        </div>

        <RoleGate allowedRoles={['admin', 'admin_area']} currentRole={currentRole}>
          <div className="flex items-center gap-2">
            <StaffImportDialog onImported={handleSuccess} />
            <Button onClick={handleNuevo}>
              Nuevo
            </Button>
          </div>
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
          onDelete={handleDeleteRequest}
          isAdmin={currentRole === 'admin'}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent className="!max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar colaborador</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Está seguro que desea eliminar a{' '}
            <span className="font-medium text-foreground">
              {deletingStaff?.firstName} {deletingStaff?.lastName}
            </span>
            ? Esta acción eliminará también su acceso al sistema y no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => handleDeleteDialogChange(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            email: editingStaff.email ?? undefined,
            staffProfile:
              editingStaff.staffProfile === 'coordinador'
                ? undefined
                : (editingStaff.staffProfile as Exclude<
                    typeof editingStaff.staffProfile,
                    'coordinador'
                  >),
            weeklyHours: editingStaff.weeklyHours,
            trainingAreaIds: editingStaff.trainingAreaIds,
          }}
          areas={areas}
          defaultWeeklyHours={defaultWeeklyHours}
          canSelectArea={canSelectArea}
          callerArea={currentArea}
          onSuccess={handleSuccess}
        />
      ) : (
        <StaffFormModal
          mode="create"
          open={modalOpen}
          onOpenChange={handleModalOpenChange}
          areas={areas}
          defaultWeeklyHours={defaultWeeklyHours}
          canSelectArea={canSelectArea}
          callerArea={currentArea}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
