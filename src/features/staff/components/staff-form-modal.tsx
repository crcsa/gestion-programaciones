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

interface CreateModalProps {
  mode: 'create'
  open: boolean
  onOpenChange: (open: boolean) => void
  areas: TrainingArea[]
  onSuccess: () => void
}

interface EditModalProps {
  mode: 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string
  defaultValues: Partial<CreateStaffInput>
  areas: TrainingArea[]
  onSuccess: () => void
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'create' ? 'Nuevo Funcionario' : 'Editar Funcionario'}
          </DialogTitle>
        </DialogHeader>

        {props.mode === 'edit' ? (
          <StaffFormClient
            mode="edit"
            staffId={props.staffId}
            defaultValues={props.defaultValues}
            areas={props.areas}
            onSuccess={handleSuccess}
          />
        ) : (
          <StaffFormClient
            mode="create"
            areas={props.areas}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
