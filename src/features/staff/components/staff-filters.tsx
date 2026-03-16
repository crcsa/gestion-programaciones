'use client'

import { useState } from 'react'
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
import type { StaffListFilters } from '@/features/staff/actions/staff-actions'
import { useEffect } from 'react'

type StaffFilters = StaffListFilters

interface StaffFiltersProps {
  onFiltersChange: (filters: StaffFilters) => void
}

export function StaffFilters({ onFiltersChange }: StaffFiltersProps) {
  const [search, setSearch] = useState('')
  const [perfil, setPerfil] = useState<string>('todos')
  const [estado, setEstado] = useState<string>('todos')

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    const filters: StaffFilters = {}

    if (debouncedSearch.trim()) {
      filters.search = debouncedSearch.trim()
    }

    if (perfil !== 'todos') {
      filters.perfil = perfil as StaffListFilters['perfil']
    }

    if (estado !== 'todos') {
      filters.estado = estado as StaffListFilters['estado']
    }

    onFiltersChange(filters)
  }, [debouncedSearch, perfil, estado, onFiltersChange])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 min-w-0">
        <Label htmlFor="staff-search" className="mb-1.5">
          Buscar
        </Label>
        <Input
          id="staff-search"
          type="text"
          placeholder="Buscar por nombre o cédula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="w-full sm:w-48">
        <Label htmlFor="staff-perfil" className="mb-1.5">
          Perfil
        </Label>
        <Select value={perfil} onValueChange={(v) => setPerfil(v ?? 'todos')}>
          <SelectTrigger id="staff-perfil" className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="bacteriologo">Bacteriólogo</SelectItem>
            <SelectItem value="tecnico">Técnico</SelectItem>
            <SelectItem value="medico">Médico</SelectItem>
            <SelectItem value="auxiliar">Auxiliar</SelectItem>
            <SelectItem value="coordinador">Coordinador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-40">
        <Label htmlFor="staff-estado" className="mb-1.5">
          Estado
        </Label>
        <Select value={estado} onValueChange={(v) => setEstado(v ?? 'todos')}>
          <SelectTrigger id="staff-estado" className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
