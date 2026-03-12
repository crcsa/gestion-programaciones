'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PROFILE_TYPE_LABELS } from '@/lib/utils/constants'
import { Search } from 'lucide-react'

interface StaffFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  profileType: string
  onProfileTypeChange: (value: string | null) => void
  status: string
  onStatusChange: (value: string | null) => void
}

export function StaffFilters({
  search,
  onSearchChange,
  profileType,
  onProfileTypeChange,
  status,
  onStatusChange,
}: StaffFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o documento..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={profileType} onValueChange={onProfileTypeChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Todos los perfiles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los perfiles</SelectItem>
          {Object.entries(PROFILE_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
