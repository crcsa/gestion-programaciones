'use client'

import { useState } from 'react'
import { Pencil, Power, PowerOff } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { IconButton } from '@/components/ui/icon-button'
import { TooltipProvider } from '@/components/ui/tooltip'
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
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Dirección</th>
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
                <td className="px-4 py-2 text-muted-foreground">{company.address ?? '—'}</td>
                <td className="px-4 py-2 text-center">
                  <StatusBadge
                    isActive={company.isActive}
                    activeLabel="Activa"
                    inactiveLabel="Inactiva"
                  />
                </td>
                <td className="px-4 py-2">
                  <TooltipProvider>
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton label="Editar" onClick={() => onEdit(company)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label={company.isActive ? 'Desactivar' : 'Activar'}
                        disabled={actionId === company.id}
                        onClick={() => handleToggleActive(company)}
                        className={
                          company.isActive
                            ? 'hover:bg-destructive/10 hover:text-destructive'
                            : 'hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                        }
                      >
                        {company.isActive ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </IconButton>
                    </div>
                  </TooltipProvider>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
