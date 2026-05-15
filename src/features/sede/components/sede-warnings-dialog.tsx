'use client'

import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ValidationResult } from '@/features/assignments/lib/validation-engine'

export interface StaffWarningGroup {
  staffName: string
  warnings: ValidationResult[]
}

interface SedeWarningsDialogProps {
  open: boolean
  groups: StaffWarningGroup[]
  /** Texto del título (e.g. "Confirmar turno con advertencias"). */
  title?: string
  /** Texto descriptivo. Opcional. */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function SedeWarningsDialog({
  open,
  groups,
  title = 'Confirmar turnos con advertencias',
  description,
  confirmLabel = 'Guardar de todos modos',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: SedeWarningsDialogProps) {
  const totalWarnings = groups.reduce((acc, g) => acc + g.warnings.length, 0)
  const defaultDescription =
    groups.length === 1
      ? `Hay ${totalWarnings} advertencia${totalWarnings === 1 ? '' : 's'} para ${groups[0].staffName}.`
      : `Hay ${totalWarnings} advertencia${totalWarnings === 1 ? '' : 's'} en ${groups.length} colaboradores.`

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(34rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description ?? defaultDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.staffName} className="space-y-1.5">
              {groups.length > 1 && (
                <p className="text-sm font-medium">{g.staffName}</p>
              )}
              <ul className="space-y-1.5 text-sm">
                {g.warnings.map((w, idx) => (
                  <li
                    key={`${w.code}-${idx}`}
                    className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-yellow-700 dark:text-yellow-400"
                  >
                    <span className="mt-0.5 text-yellow-500 shrink-0">⚠</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
