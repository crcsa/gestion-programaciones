'use client'

import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEPARTMENT_NAMES, getMunicipalities } from '@/lib/data/colombia-locations'

interface ColombiaLocationSelectorProps {
  department: string
  municipality: string
  onDepartmentChange: (value: string) => void
  onMunicipalityChange: (value: string) => void
  departmentError?: string
  municipalityError?: string
  /** Prefijos de id para evitar colisiones cuando hay múltiples instancias */
  idPrefix?: string
  municipalityRequired?: boolean
}

export function ColombiaLocationSelector({
  department,
  municipality,
  onDepartmentChange,
  onMunicipalityChange,
  departmentError,
  municipalityError,
  idPrefix = '',
  municipalityRequired = false,
}: ColombiaLocationSelectorProps) {
  const municipalities = getMunicipalities(department)

  // Limpiar municipio si ya no pertenece al departamento seleccionado
  useEffect(() => {
    if (department && municipality && !municipalities.includes(municipality)) {
      onMunicipalityChange('')
    }
  }, [department, municipality, municipalities, onMunicipalityChange])

  return (
    <>
      {/* Departamento */}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}department`}>Departamento</Label>
        <Select
          value={department}
          onValueChange={(v) => onDepartmentChange(v ?? '')}
        >
          <SelectTrigger
            id={`${idPrefix}department`}
            aria-invalid={!!departmentError}
            className="w-full"
          >
            <SelectValue placeholder="Seleccionar departamento">
              {department || undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {DEPARTMENT_NAMES.map((dep) => (
              <SelectItem key={dep} value={dep}>
                {dep}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {departmentError && (
          <p className="text-sm text-destructive">{departmentError}</p>
        )}
      </div>

      {/* Municipio */}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}municipality`}>
          Municipio{municipalityRequired ? ' *' : ''}
        </Label>
        <Select
          value={municipality}
          onValueChange={(v) => onMunicipalityChange(v ?? '')}
          disabled={!department}
        >
          <SelectTrigger
            id={`${idPrefix}municipality`}
            aria-invalid={!!municipalityError}
            className="w-full"
          >
            <SelectValue
              placeholder={department ? 'Seleccionar municipio' : 'Primero seleccione departamento'}
            >
              {municipality || undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {municipalities.map((mun) => (
              <SelectItem key={mun} value={mun}>
                {mun}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {municipalityError && (
          <p className="text-sm text-destructive">{municipalityError}</p>
        )}
      </div>
    </>
  )
}
