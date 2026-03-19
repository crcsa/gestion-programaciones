'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PROFILE_OPTIONS = [
  { value: '', label: 'Todos los perfiles' },
  { value: 'bacteriologo', label: 'Bacteriólogo' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'medico', label: 'Médico' },
  { value: 'auxiliar', label: 'Auxiliar' },
  { value: 'coordinador', label: 'Coordinador' },
]

interface AvailabilityFiltersProps {
  currentProfile?: string
}

export function AvailabilityFilters({ currentProfile = '' }: AvailabilityFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleProfileChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('perfil', value)
    } else {
      params.delete('perfil')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3">
      <Select value={currentProfile} onValueChange={handleProfileChange}>
        <SelectTrigger className="h-8 w-48 text-sm">
          <SelectValue placeholder="Filtrar por perfil" />
        </SelectTrigger>
        <SelectContent>
          {PROFILE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
