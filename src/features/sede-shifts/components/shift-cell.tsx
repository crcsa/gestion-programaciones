'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShiftTypeBadge } from './shift-type-badge'
import { ShiftForm } from './shift-form'
import type { SedeShift } from '@/lib/db/schema/sede-shifts'
import type { UpsertShiftInput } from '../schemas/shift-schemas'

interface ShiftCellProps {
  staffId: string
  shiftDate: string
  shift: SedeShift | undefined
  onSave: (data: UpsertShiftInput) => Promise<void>
  onDelete: (shiftId: string) => Promise<void>
  isEditable: boolean
}

export function ShiftCell({
  staffId,
  shiftDate,
  shift,
  onSave,
  onDelete,
  isEditable,
}: ShiftCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = useCallback(
    async (data: UpsertShiftInput) => {
      setIsLoading(true)
      try {
        await onSave(data)
        setIsEditing(false)
      } finally {
        setIsLoading(false)
      }
    },
    [onSave],
  )

  const handleDelete = useCallback(async () => {
    if (!shift) return
    setIsLoading(true)
    try {
      await onDelete(shift.id)
    } finally {
      setIsLoading(false)
    }
  }, [shift, onDelete])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  if (isEditing) {
    return (
      <div className="min-h-[80px] p-1">
        <ShiftForm
          staffId={staffId}
          shiftDate={shiftDate}
          defaultValues={
            shift
              ? {
                  shiftType: shift.shiftType,
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  totalHours: shift.totalHours,
                  isOvernight: shift.isOvernight,
                  notes: shift.notes ?? undefined,
                }
              : undefined
          }
          onSubmit={handleSave}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="flex min-h-[80px] items-center justify-center p-1">
        {isEditable && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            aria-label="Agregar turno"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[80px] flex-col gap-1 p-1">
      <ShiftTypeBadge shiftType={shift.shiftType} />
      <span className="text-xs text-muted-foreground">
        {shift.startTime} - {shift.endTime} ({shift.totalHours}h)
      </span>
      {shift.notes && (
        <span className="text-xs text-muted-foreground truncate" title={shift.notes}>
          {shift.notes}
        </span>
      )}
      {isEditable && (
        <div className="flex items-center gap-1 mt-auto">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsEditing(true)}
            aria-label="Editar turno"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            disabled={isLoading}
            aria-label="Eliminar turno"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  )
}
