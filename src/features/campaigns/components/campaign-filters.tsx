'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'

export interface CampaignListFilters {
  search?: string
  status?: 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'
  size?: 'S' | 'S_plus' | 'M' | 'L'
  modality?: 'presencial' | 'virtual' | 'mixta' | 'movil' | 'institucional'
  dateFrom?: string
  dateTo?: string
}

interface CampaignFiltersProps {
  onFiltersChange: (filters: CampaignListFilters) => void
}

export function CampaignFilters({ onFiltersChange }: CampaignFiltersProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('todos')
  const [size, setSize] = useState<string>('todos')
  const [modality, setModality] = useState<string>('todos')

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    const filters: CampaignListFilters = {}

    if (debouncedSearch.trim()) {
      filters.search = debouncedSearch.trim()
    }

    if (status !== 'todos') {
      filters.status = status as CampaignListFilters['status']
    }

    if (size !== 'todos') {
      filters.size = size as CampaignListFilters['size']
    }

    if (modality !== 'todos') {
      filters.modality = modality as CampaignListFilters['modality']
    }

    onFiltersChange(filters)
  }, [debouncedSearch, status, size, modality, onFiltersChange])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex-1 min-w-0 sm:min-w-48">
        <Label htmlFor="campaign-search" className="mb-1.5">
          Buscar
        </Label>
        <Input
          id="campaign-search"
          type="text"
          placeholder="Buscar por código o municipio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="w-full sm:w-44">
        <Label htmlFor="campaign-status" className="mb-1.5">
          Estado
        </Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v ?? 'todos')}
        >
          <SelectTrigger id="campaign-status" className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="tentativa">Tentativa</SelectItem>
            <SelectItem value="confirmada">Confirmada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="ejecutada">Ejecutada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-32">
        <Label htmlFor="campaign-size" className="mb-1.5">
          Tamaño
        </Label>
        <Select
          value={size}
          onValueChange={(v) => setSize(v ?? 'todos')}
        >
          <SelectTrigger id="campaign-size" className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="S">S</SelectItem>
            <SelectItem value="S_plus">S+</SelectItem>
            <SelectItem value="M">M</SelectItem>
            <SelectItem value="L">L</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-44">
        <Label htmlFor="campaign-modality" className="mb-1.5">
          Modalidad
        </Label>
        <Select
          value={modality}
          onValueChange={(v) => setModality(v ?? 'todos')}
        >
          <SelectTrigger id="campaign-modality" className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="presencial">Presencial</SelectItem>
            <SelectItem value="virtual">Virtual</SelectItem>
            <SelectItem value="mixta">Mixta</SelectItem>
            <SelectItem value="movil">Móvil</SelectItem>
            <SelectItem value="institucional">Institucional</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
