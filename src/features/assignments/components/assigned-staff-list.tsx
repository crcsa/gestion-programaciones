'use client'

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

  return (
    <div className="space-y-2">
      {assigned.map((a) => (
        <div
          key={a.assignmentId}
          className="flex items-center justify-between p-3 rounded-lg border border-border"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {a.firstName} {a.lastName}
            </span>
            <Badge variant="outline">
              {STAFF_PROFILE_LABELS[a.staffProfile] ?? a.staffProfile}
            </Badge>
            {a.isCoordinator && (
              <Badge variant="secondary">Coordinador</Badge>
            )}
          </div>

          {isEditable && (
            <div className="flex gap-2">
              {!a.isCoordinator && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onSetCoordinator(a.staffId)}
                >
                  Coordinador
                </Button>
              )}
              <Button
                variant="destructive"
                size="xs"
                onClick={() => onRemove(a.assignmentId)}
              >
                Remover
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
