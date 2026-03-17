'use client'

import { Label } from '@/components/ui/label'
import type { TrainingArea } from '@/lib/db/schema/training-areas'

interface TrainingAreaMultiSelectProps {
  value: string[]
  onChange: (ids: string[]) => void
  areas: TrainingArea[]
}

export function TrainingAreaMultiSelect({
  value,
  onChange,
  areas,
}: TrainingAreaMultiSelectProps) {
  function handleToggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  if (areas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No hay áreas de entrenamiento disponibles.
      </p>
    )
  }

  return (
    <div className="overflow-y-auto max-h-40 rounded-lg border border-input p-2 space-y-1">
      {areas.map((area) => (
        <div key={area.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`area-${area.id}`}
            checked={value.includes(area.id)}
            onChange={() => handleToggle(area.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary accent-primary"
          />
          <Label htmlFor={`area-${area.id}`} className="cursor-pointer font-normal">
            {area.name}
          </Label>
        </div>
      ))}
    </div>
  )
}
