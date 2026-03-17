'use client'

import { CAMPAIGN_SIZE_COMPOSITION } from '@/features/campaigns/lib/constants'
import type { AssignedStaffMember } from '../actions/assignment-actions'

interface RequirementsMeterProps {
  size: 'S' | 'S_plus' | 'M' | 'L'
  assigned: AssignedStaffMember[]
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const isFull = current >= total

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2.5 w-6 rounded-sm ${
            i < current
              ? isFull
                ? 'bg-green-500'
                : 'bg-amber-500'
              : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}

export function RequirementsMeter({ size, assigned }: RequirementsMeterProps) {
  const required = CAMPAIGN_SIZE_COMPOSITION[size]

  const assignedBacterio = assigned.filter(
    (s) => s.staffProfile === 'bacteriologo',
  ).length
  const assignedTecnicos = assigned.filter(
    (s) => s.staffProfile === 'tecnico',
  ).length

  const missingBacterio = Math.max(0, required.bacteriologos - assignedBacterio)
  const missingTecnicos = Math.max(0, required.tecnicos - assignedTecnicos)
  const isComplete = missingBacterio === 0 && missingTecnicos === 0

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Composición requerida
      </h4>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm w-32">Bacteriólogos</span>
          <ProgressBar current={assignedBacterio} total={required.bacteriologos} />
          <span className="text-sm tabular-nums w-10 text-right">
            {assignedBacterio}/{required.bacteriologos}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm w-32">Técnicos</span>
          <ProgressBar current={assignedTecnicos} total={required.tecnicos} />
          <span className="text-sm tabular-nums w-10 text-right">
            {assignedTecnicos}/{required.tecnicos}
          </span>
        </div>
      </div>

      {isComplete && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1">
          <span>&#10003;</span> Equipo completo
        </p>
      )}

      {!isComplete && (
        <p className="text-sm text-amber-600">
          Faltan: {missingBacterio > 0 ? `${missingBacterio} bacteriólogo(s)` : ''}
          {missingBacterio > 0 && missingTecnicos > 0 ? ', ' : ''}
          {missingTecnicos > 0 ? `${missingTecnicos} técnico(s)` : ''}
        </p>
      )}
    </div>
  )
}
