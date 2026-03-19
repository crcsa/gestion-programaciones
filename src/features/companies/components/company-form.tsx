'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCompany, updateCompany } from '../actions/company-actions'
import type { Company } from '@/lib/db/schema/companies'

interface CompanyFormProps {
  company?: Company
  onSuccess: () => void
  onCancel: () => void
}

interface FormState {
  name: string
  nit: string
  contactName: string
  contactPhone: string
  contactEmail: string
  address: string
  municipality: string
  department: string
}

function buildInitialState(company?: Company): FormState {
  return {
    name:         company?.name ?? '',
    nit:          company?.nit ?? '',
    contactName:  company?.contactName ?? '',
    contactPhone: company?.contactPhone ?? '',
    contactEmail: company?.contactEmail ?? '',
    address:      company?.address ?? '',
    municipality: company?.municipality ?? '',
    department:   company?.department ?? 'Antioquia',
  }
}

export function CompanyForm({ company, onSuccess, onCancel }: CompanyFormProps) {
  const [form, setForm] = useState<FormState>(buildInitialState(company))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!company

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const payload = {
      name:         form.name,
      nit:          form.nit || undefined,
      contactName:  form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      address:      form.address || undefined,
      municipality: form.municipality || undefined,
      department:   form.department,
    }

    try {
      if (isEditing) {
        await updateCompany({ id: company.id, ...payload })
      } else {
        await createCompany(payload)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="name">Nombre de la empresa *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={handleChange('name')}
            placeholder="Cruz Roja Colombiana"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="nit">NIT</Label>
          <Input
            id="nit"
            value={form.nit}
            onChange={handleChange('nit')}
            placeholder="123456789-0"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="contactName">Nombre del contacto</Label>
          <Input
            id="contactName"
            value={form.contactName}
            onChange={handleChange('contactName')}
            placeholder="Juan Pérez"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="contactPhone">Teléfono</Label>
          <Input
            id="contactPhone"
            value={form.contactPhone}
            onChange={handleChange('contactPhone')}
            placeholder="3001234567"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="contactEmail">Correo electrónico</Label>
          <Input
            id="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={handleChange('contactEmail')}
            placeholder="contacto@empresa.com"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={form.address}
            onChange={handleChange('address')}
            placeholder="Calle 10 # 43-45"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="municipality">Municipio</Label>
          <Input
            id="municipality"
            value={form.municipality}
            onChange={handleChange('municipality')}
            placeholder="Medellín"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="department">Departamento</Label>
          <Input
            id="department"
            value={form.department}
            onChange={handleChange('department')}
            placeholder="Antioquia"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear empresa'}
        </Button>
      </div>
    </form>
  )
}
