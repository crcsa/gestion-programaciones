'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CompanyTable } from '@/features/companies/components/company-table'
import { CompanyForm } from '@/features/companies/components/company-form'
import { ContactsImportDialog } from '@/features/companies/components/contacts-import-dialog'
import { getCompaniesList } from '@/features/companies/actions/company-actions'
import type { Company } from '@/lib/db/schema/companies'

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<'todos' | 'activo' | 'inactivo'>('activo')
  const debouncedSearch = useDebounce(search, 300)
  const [showForm, setShowForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | undefined>()

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const isActive =
        estado === 'todos' ? undefined : estado === 'activo' ? true : false
      const result = await getCompaniesList({
        search: debouncedSearch || undefined,
        isActive,
      })
      setCompanies(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empresas')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, estado])

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
        <div className="flex gap-2">
          <ContactsImportDialog onSuccess={fetchCompanies} />
          <Button onClick={() => setShowForm(true)}>+ Nueva empresa</Button>
        </div>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0 sm:max-w-xs">
          <Label htmlFor="company-search" className="mb-1.5">
            Buscar
          </Label>
          <Input
            id="company-search"
            placeholder="Buscar por nombre o NIT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="company-estado" className="mb-1.5">
            Estado
          </Label>
          <Select value={estado} onValueChange={(v) => setEstado((v ?? 'activo') as typeof estado)}>
            <SelectTrigger id="company-estado" className="w-full">
              <SelectValue placeholder="Activo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
