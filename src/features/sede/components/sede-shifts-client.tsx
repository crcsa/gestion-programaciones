'use client'

import { useState, useCallback, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { WeekSelector } from '@/features/availability/components/week-selector'
import { SedeShiftForm } from './sede-shift-form'
import { SedeShiftTable } from './sede-shift-table'
import {
  getWeeklySedeShifts,
  createSedeShift,
  updateSedeShift,
  deleteSedeShift,
} from '@/features/sede/actions/sede-shift-actions'
import type {
  SedeShiftRow,
  StaffListItem,
} from '@/features/sede/actions/sede-shift-actions'
import type { CreateSedeShiftInput } from '@/features/sede/schemas/sede-shift-schemas'
import type { Role } from '@/types/roles'

// ---- Props ----------------------------------------------------------------

interface SedeShiftsClientProps {
  initialData: SedeShiftRow[]
  initialWeekStart: string
  staffList: StaffListItem[]
  currentRole: Role | null
}

// ---- Component ------------------------------------------------------------

export function SedeShiftsClient({
  initialData,
  initialWeekStart,
  staffList,
  currentRole,
}: SedeShiftsClientProps) {
  const [rows, setRows] = useState<SedeShiftRow[]>(initialData)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SedeShiftRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const canManage = currentRole === 'admin' || currentRole === 'banco_sangre'

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const freshData = await getWeeklySedeShifts(initialWeekStart)
        setRows(freshData)
      } catch {
        toast.error('Error al refrescar los turnos')
      }
    })
  }, [initialWeekStart])

  const handleCreate = useCallback(async (data: CreateSedeShiftInput) => {
    try {
      await createSedeShift(data)
      toast.success('Turno creado exitosamente')
      setDialogOpen(false)
      refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al crear el turno'
      toast.error(message)
    }
  }, [refreshData])

  const handleUpdate = useCallback(async (data: CreateSedeShiftInput) => {
    if (!editingRow) return

    try {
      await updateSedeShift(editingRow.id, {
        shiftType: data.shiftType,
        startTime: data.startTime,
        endTime: data.endTime,
        isOvernight: data.isOvernight,
        notes: data.notes,
      })
      toast.success('Turno actualizado exitosamente')
      setDialogOpen(false)
      setEditingRow(null)
      refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar el turno'
      toast.error(message)
    }
  }, [editingRow, refreshData])

  const handleEdit = useCallback((row: SedeShiftRow) => {
    setEditingRow(row)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = window.confirm('¿Está seguro de eliminar este turno?')
    if (!confirmed) return

    try {
      await deleteSedeShift(id)
      toast.success('Turno eliminado exitosamente')
      refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar el turno'
      toast.error(message)
    }
  }, [refreshData])

  const handleOpenCreate = useCallback(() => {
    setEditingRow(null)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditingRow(null)
  }, [])

  const editDefaults = editingRow
    ? {
        staffId: editingRow.staffId,
        shiftDate: editingRow.shiftDate,
        shiftType: editingRow.shiftType,
        startTime: editingRow.startTime,
        endTime: editingRow.endTime,
        isOvernight: editingRow.isOvernight,
        notes: editingRow.notes ?? undefined,
      }
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Turnos en Sede</h1>
        <div className="flex items-center gap-4">
          <WeekSelector weekStart={initialWeekStart} paramName="semana" />
          {canManage && (
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Nuevo Turno
            </Button>
          )}
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <SedeShiftTable
          rows={rows}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) handleDialogClose()
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? 'Editar Turno' : 'Nuevo Turno'}
            </DialogTitle>
          </DialogHeader>
          <SedeShiftForm
            staffList={staffList}
            defaultValues={editDefaults}
            onSubmit={editingRow ? handleUpdate : handleCreate}
            isLoading={isPending}
            weekStart={initialWeekStart}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
