'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ValidationResult } from '../lib/validation-engine'

interface OverrideConfirmationDialogProps {
  open: boolean
  warnings: ValidationResult[]
  staffName: string
  onConfirm: () => void
  onCancel: () => void
}

export function OverrideConfirmationDialog({
  open,
  warnings,
  staffName,
  onConfirm,
  onCancel,
}: OverrideConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar asignación con advertencias</DialogTitle>
          <DialogDescription>
            Se encontraron advertencias para <strong>{staffName}</strong>. ¿Desea asignar
            de todas formas?
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {warnings.map((w) => (
            <li
              key={w.code}
              className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-yellow-700 dark:text-yellow-400"
            >
              <span className="mt-0.5 text-yellow-500">⚠</span>
              <span>{w.message}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Asignar de todas formas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
