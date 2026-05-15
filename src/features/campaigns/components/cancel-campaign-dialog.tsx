'use client'

import { useState, useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getAssignedStaff } from '@/features/assignments/actions/assignment-actions'
import type { AssignedStaffMember } from '@/features/assignments/actions/assignment-actions'

const cancelReasonSchema = z.object({
  reason: z
    .string()
    .min(10, 'El motivo debe tener al menos 10 caracteres'),
})

type CancelReasonForm = z.infer<typeof cancelReasonSchema>

const PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriólogo',
  tecnico: 'Técnico',
  medico: 'Médico',
  auxiliar: 'Auxiliar',
}

interface CancelCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignCode: string
  campaignId: string
  onConfirm: (reason: string) => Promise<void>
  isLoading?: boolean
}

export function CancelCampaignDialog({
  open,
  onOpenChange,
  campaignCode,
  campaignId,
  onConfirm,
  isLoading = false,
}: CancelCampaignDialogProps) {
  const [affectedStaff, setAffectedStaff] = useState<AssignedStaffMember[]>([])
  const [loadingStaff, startLoadingStaff] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelReasonForm>({
    resolver: zodResolver(cancelReasonSchema),
  })

  useEffect(() => {
    if (!open || !campaignId) return
    startLoadingStaff(async () => {
      try {
        const staff = await getAssignedStaff(campaignId)
        setAffectedStaff(staff)
      } catch {
        setAffectedStaff([])
      }
    })
  }, [open, campaignId])

  async function handleConfirm(data: CancelReasonForm) {
    await onConfirm(data.reason)
    reset()
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancelar campaña {campaignCode}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleConfirm)} className="space-y-4">
          <AffectedStaffSection
            loading={loadingStaff}
            staff={affectedStaff}
          />

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Motivo de cancelación</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Describe el motivo de cancelación (mínimo 10 caracteres)..."
              disabled={isLoading}
              aria-invalid={!!errors.reason}
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Volver
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isLoading}
            >
              {isLoading ? 'Cancelando...' : 'Confirmar cancelación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---- Affected Staff Section ------------------------------------------------

interface AffectedStaffSectionProps {
  loading: boolean
  staff: AssignedStaffMember[]
}

function AffectedStaffSection({ loading, staff }: AffectedStaffSectionProps) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Cargando personal afectado...
      </p>
    )
  }

  if (staff.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay personal asignado a esta campaña.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        Personal que será liberado ({staff.length}{' '}
        {staff.length === 1 ? 'persona' : 'personas'}):
      </p>
      <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
        {staff.map((member) => (
          <li key={member.assignmentId}>
            {member.firstName} {member.lastName}
            {' — '}
            {PROFILE_LABELS[member.staffProfile] ?? member.staffProfile}
            {member.isCoordinator && ' [Coordinador]'}
          </li>
        ))}
      </ul>
    </div>
  )
}
