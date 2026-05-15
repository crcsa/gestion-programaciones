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
  modality?: 'corporativa' | 'carpa' | 'unidad_movil' | 'municipal' | 'combinada'
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
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

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

    if (dateFrom) {
      filters.dateFrom = dateFrom
    }

    if (dateTo) {
      filters.dateTo = dateTo
    }

    onFiltersChange(filters)
  }, [debouncedSearch, status, size, modality, dateFrom, dateTo, onFiltersChange])

  const hasActiveFilters =
    search.trim() !== '' ||
    status !== 'todos' ||
    size !== 'todos' ||
    modality !== 'todos' ||
    dateFrom !== '' ||
    dateTo !== ''

  function handleClear() {
    setSearch('')
    setStatus('todos')
    setSize('todos')
    setModality('todos')
    setDateFrom('')
    setDateTo('')
  }

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
            <SelectItem value="corporativa">Corporativa</SelectItem>
            <SelectItem value="carpa">Carpa</SelectItem>
            <SelectItem value="unidad_movil">Unidad Móvil</SelectItem>
            <SelectItem value="municipal">Municipal</SelectItem>
            <SelectItem value="combinada">Combinada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-40">
        <Label htmlFor="campaign-date-from" className="mb-1.5">
          Desde
        </Label>
        <Input
          id="campaign-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          max={dateTo || undefined}
        />
      </div>

      <div className="w-full sm:w-40">
        <Label htmlFor="campaign-date-to" className="mb-1.5">
          Hasta
        </Label>
        <Input
          id="campaign-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          min={dateFrom || undefined}
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="h-9 self-end rounded-md border border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
