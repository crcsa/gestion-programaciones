'use client'

import { useEffect, useState, useCallback } from 'react'
import { Mail, Phone, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  listContacts,
  deleteContact,
} from '../actions/contact-actions'
import { ContactFormDialog } from './contact-form-dialog'
import type { CompanyContact } from '@/lib/db/schema/company-contacts'

interface ContactListProps {
  companyId: string
}

export function ContactList({ companyId }: ContactListProps) {
  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CompanyContact | undefined>()
  const [showForm, setShowForm] = useState(false)

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listContacts(companyId)
      setContacts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar contactos')
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este contacto?')) return
    try {
      await deleteContact(id)
      await fetchContacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  const handleNew = () => {
    setEditing(undefined)
    setShowForm(true)
  }

  const handleEdit = (contact: CompanyContact) => {
    setEditing(contact)
    setShowForm(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Contactos ({contacts.length})
        </h3>
        <Button size="sm" variant="outline" onClick={handleNew}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nuevo
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">Cargando...</p>
      ) : contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No hay contactos registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-border p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.fullName}</span>
                    {c.isPrimary && (
                      <Badge variant="secondary">Principal</Badge>
                    )}
                  </div>
                  {c.position && (
                    <p className="text-xs text-muted-foreground">
                      {c.position}
                    </p>
                  )}
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {c.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleEdit(c)}
                    aria-label="Editar contacto"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Eliminar contacto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <ContactFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          companyId={companyId}
          contact={editing}
          onSaved={fetchContacts}
        />
      )}
    </div>
  )
}
