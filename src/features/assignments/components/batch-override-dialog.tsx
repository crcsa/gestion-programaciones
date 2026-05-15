'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { BatchAssignWarning } from '../actions/smart-assignment-actions'

interface BatchOverrideDialogProps {
  open: boolean
  warningsByStaff: BatchAssignWarning[]
  totalSelected: number
  isAssigning: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BatchOverrideDialog({
  open,
  warningsByStaff,
  totalSelected,
  isAssigning,
  onConfirm,
  onCancel,
}: BatchOverrideDialogProps) {
  const clean = totalSelected - warningsByStaff.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isAssigning && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar asignación con advertencias</DialogTitle>
          <DialogDescription>
            {warningsByStaff.length} de {totalSelected} colaborador
            {totalSelected === 1 ? '' : 'es'} tiene
            {warningsByStaff.length === 1 ? '' : 'n'} advertencias.
            {clean > 0 && ` Los demás (${clean}) se asignarán sin problemas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {warningsByStaff.map((entry) => (
            <div
              key={entry.staffId}
              className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2"
            >
              <p className="text-sm font-medium text-foreground">{entry.staffName}</p>
              <ul className="mt-1 space-y-1 text-xs text-yellow-700 dark:text-yellow-400">
                {entry.warnings.map((w) => (
                  <li key={w.code} className="flex items-start gap-1.5">
                    <span aria-hidden>⚠</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isAssigning}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isAssigning}>
            {isAssigning ? 'Asignando...' : `Asignar ${totalSelected} de todas formas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
