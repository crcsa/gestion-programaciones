'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { activateCompany, deactivateCompany } from '../actions/company-actions'
import type { Company } from '@/lib/db/schema/companies'

interface CompanyTableProps {
  companies: Company[]
  onEdit: (company: Company) => void
  onRefresh: () => void
}

export function CompanyTable({ companies, onEdit, onRefresh }: CompanyTableProps) {
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggleActive = async (company: Company) => {
    setActionId(company.id)
    setError(null)
    try {
      if (company.isActive) {
        await deactivateCompany(company.id)
      } else {
        await activateCompany(company.id)
      }
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado')
    } finally {
      setActionId(null)
    }
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No hay empresas registradas.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Empresa</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">NIT</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Contacto</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Municipio</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{company.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {company.nit ?? '—'}
                </td>
                <td className="px-4 py-2">
                  {company.contactName ? (
                    <div>
                      <div>{company.contactName}</div>
                      {company.contactPhone && (
                        <div className="text-xs text-muted-foreground">{company.contactPhone}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{company.municipality ?? '—'}</td>
                <td className="px-4 py-2 text-center">
                  <Badge variant={company.isActive ? 'default' : 'secondary'}>
                    {company.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(company)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === company.id}
                      onClick={() => handleToggleActive(company)}
                    >
                      {actionId === company.id
                        ? '...'
                        : company.isActive
                          ? 'Desactivar'
                          : 'Activar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
