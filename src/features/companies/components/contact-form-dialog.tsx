'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createContact,
  updateContact,
} from '../actions/contact-actions'
import type { CompanyContact } from '@/lib/db/schema/company-contacts'

interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  contact?: CompanyContact
  onSaved: () => void
}

interface FormState {
  fullName: string
  position: string
  email: string
  phone: string
  isPrimary: boolean
  notes: string
}

function buildInitialState(contact?: CompanyContact): FormState {
  return {
    fullName: contact?.fullName ?? '',
    position: contact?.position ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    isPrimary: contact?.isPrimary ?? false,
    notes: contact?.notes ?? '',
  }
}

export function ContactFormDialog({
  open,
  onOpenChange,
  companyId,
  contact,
  onSaved,
}: ContactFormDialogProps) {
  const [form, setForm] = useState<FormState>(buildInitialState(contact))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!contact

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isEditing) {
        await updateContact({
          id: contact.id,
          companyId,
          fullName: form.fullName,
          position: form.position || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          isPrimary: form.isPrimary,
          notes: form.notes || undefined,
        })
      } else {
        await createContact({
          companyId,
          fullName: form.fullName,
          position: form.position || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          isPrimary: form.isPrimary,
          notes: form.notes || undefined,
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar contacto' : 'Nuevo contacto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="fullName">Nombre completo *</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="position">Cargo</Label>
              <Input
                id="position"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={form.isPrimary}
              onChange={(e) =>
                setForm({ ...form, isPrimary: e.target.checked })
              }
            />
            <span>Contacto principal</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
