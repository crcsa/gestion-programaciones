'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STAFF_PROFILE_LABELS } from '@/features/staff/lib/constants'
import type { AvailableStaffMember } from '../actions/assignment-actions'

interface StaffSelectorProps {
  available: AvailableStaffMember[]
  onAssign: (staffIds: string[]) => Promise<void>
  isLoading?: boolean
}

const PROFILE_FILTER_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'bacteriologo', label: 'Bacteriólogo' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'medico', label: 'Médico' },
  { value: 'auxiliar', label: 'Auxiliar' },
] as const

export function StaffSelector({
  available,
  onAssign,
  isLoading = false,
}: StaffSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [profileFilter, setProfileFilter] = useState('')

  const filtered = profileFilter
    ? available.filter((s) => s.staffProfile === profileFilter)
    : available

  const handleToggle = useCallback((staffId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(staffId)) {
        next.delete(staffId)
      } else {
        next.add(staffId)
      }
      return next
    })
  }, [])

  const handleAssign = async () => {
    if (selected.size === 0) return
    await onAssign(Array.from(selected))
    setSelected(new Set())
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No hay personal disponible para asignar.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {PROFILE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          disabled={selected.size === 0 || isLoading}
          onClick={handleAssign}
        >
          Asignar seleccionados ({selected.size})
        </Button>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border border-border">
        {filtered.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => handleToggle(s.id)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">
              {s.firstName} {s.lastName}
            </span>
            <Badge variant="outline">
              {STAFF_PROFILE_LABELS[s.staffProfile] ?? s.staffProfile}
            </Badge>
          </label>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay personal con este perfil.
          </p>
        )}
      </div>
    </div>
  )
}
