'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StaffFormClient } from './staff-form-client'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import type { TrainingArea } from '@/lib/db/schema/training-areas'
import type { Area } from '@/types/areas'

interface CommonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  areas: TrainingArea[]
  defaultWeeklyHours: number
  /** True si el caller es admin global (puede elegir área en el form). */
  canSelectArea?: boolean
  /** Área del caller (para fijarla cuando no puede elegir). */
  callerArea?: Area | null
  onSuccess: () => void
}

interface CreateModalProps extends CommonModalProps {
  mode: 'create'
}

interface EditModalProps extends CommonModalProps {
  mode: 'edit'
  staffId: string
  defaultValues: Partial<CreateStaffInput>
}

type StaffFormModalProps = CreateModalProps | EditModalProps

export function StaffFormModal(props: StaffFormModalProps) {
  const { open, onOpenChange, onSuccess } = props

  function handleSuccess() {
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'create' ? 'Nuevo Colaborador' : 'Editar Colaborador'}
          </DialogTitle>
        </DialogHeader>

        {props.mode === 'edit' ? (
          <StaffFormClient
            mode="edit"
            staffId={props.staffId}
            defaultValues={props.defaultValues}
            areas={props.areas}
            defaultWeeklyHours={props.defaultWeeklyHours}
            canSelectArea={props.canSelectArea}
            callerArea={props.callerArea}
            onSuccess={handleSuccess}
          />
        ) : (
          <StaffFormClient
            mode="create"
            areas={props.areas}
            defaultWeeklyHours={props.defaultWeeklyHours}
            canSelectArea={props.canSelectArea}
            callerArea={props.callerArea}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
