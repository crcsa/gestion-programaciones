'use client'

import { Crown, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STAFF_PROFILE_LABELS } from '@/features/staff/lib/constants'
import type { AssignedStaffMember } from '../actions/assignment-actions'

interface AssignedStaffListProps {
  assigned: AssignedStaffMember[]
  onRemove: (assignmentId: string) => Promise<void>
  onSetCoordinator: (staffId: string) => Promise<void>
  isEditable: boolean
}

export function AssignedStaffList({
  assigned,
  onRemove,
  onSetCoordinator,
  isEditable,
}: AssignedStaffListProps) {
  if (assigned.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No hay personal asignado a esta campaña.
      </p>
    )
  }

  const hasCoordinator = assigned.some((a) => a.isCoordinator)

  return (
    <div className="space-y-2">
      {isEditable && !hasCoordinator && assigned.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <Crown className="size-3.5" aria-hidden />
          Designa un coordinador para la campaña usando el botón
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-medium">Hacer coordinador</span>
          en uno de los asignados.
        </div>
      )}
      {assigned.map((a) => (
        <div
          key={a.assignmentId}
          className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
            a.isCoordinator ? 'border-amber-500/60 bg-amber-500/5' : 'border-border'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {a.isCoordinator && (
              <Crown className="size-4 text-amber-500" aria-label="Coordinador" />
            )}
            <span className="text-sm font-medium">
              {a.firstName} {a.lastName}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              C.C. {a.cedula}
            </span>
            <Badge variant="outline">
              {STAFF_PROFILE_LABELS[a.staffProfile] ?? a.staffProfile}
            </Badge>
            {a.isCoordinator && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Coordinador</Badge>
            )}
          </div>

          {isEditable && (
            <div className="flex gap-2">
              {!a.isCoordinator && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetCoordinator(a.staffId)}
                  className="gap-1.5"
                >
                  <Crown className="size-3.5" aria-hidden />
                  Hacer coordinador
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(a.assignmentId)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
              >
                <X className="size-3.5" aria-hidden />
                Remover
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
