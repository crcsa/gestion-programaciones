'use client'

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

const cancelReasonSchema = z.object({
  reason: z
    .string()
    .min(10, 'El motivo debe tener al menos 10 caracteres'),
})

type CancelReasonForm = z.infer<typeof cancelReasonSchema>

interface CancelCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignCode: string
  onConfirm: (reason: string) => Promise<void>
  isLoading?: boolean
}

export function CancelCampaignDialog({
  open,
  onOpenChange,
  campaignCode,
  onConfirm,
  isLoading = false,
}: CancelCampaignDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelReasonForm>({
    resolver: zodResolver(cancelReasonSchema),
  })

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
