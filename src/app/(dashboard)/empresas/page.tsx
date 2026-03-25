'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CompanyTable } from '@/features/companies/components/company-table'
import { CompanyForm } from '@/features/companies/components/company-form'
import { getCompaniesList } from '@/features/companies/actions/company-actions'
import type { Company } from '@/lib/db/schema/companies'

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showForm, setShowForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | undefined>()

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getCompaniesList({ search: debouncedSearch || undefined })
      setCompanies(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empresas')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setShowForm(true)
  }

  const handleFormSuccess = async () => {
    setShowForm(false)
    setEditingCompany(undefined)
    await fetchCompanies()
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingCompany(undefined)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <Button onClick={() => setShowForm(true)}>+ Nueva empresa</Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleFormCancel() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? 'Editar empresa' : 'Nueva empresa'}
            </DialogTitle>
          </DialogHeader>
          <CompanyForm
            key={editingCompany?.id ?? 'new'}
            company={editingCompany}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nombre o NIT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Cargando empresas...</div>
      ) : (
        <CompanyTable
          companies={companies}
          onEdit={handleEdit}
          onRefresh={fetchCompanies}
        />
      )}
    </div>
  )
}
