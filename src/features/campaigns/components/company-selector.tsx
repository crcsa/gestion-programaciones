'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getCompaniesList } from '@/features/companies/actions/company-actions'
import { createCompany } from '@/features/companies/actions/company-actions'
import type { Company } from '@/lib/db/schema/companies'

interface CompanySelectorProps {
  value: string | undefined         // companyId
  selectedName: string | undefined  // company name for display
  onChange: (companyId: string | undefined, companyName: string | undefined) => void
  error?: string
}

export function CompanySelector({ value, selectedName, onChange, error }: CompanySelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  // Load companies on first open
  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setLoadError(null)
    getCompaniesList({ isActive: true, limit: 200 })
      .then((r) => setCompanies(r.data))
      .catch(() => setLoadError('Error al cargar empresas'))
      .finally(() => setIsLoading(false))
  }, [open])

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filtered = search.trim()
    ? companies.filter((c) =>
        c.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : companies

  function handleSelect(company: Company) {
    onChange(company.id, company.name)
    setOpen(false)
    setSearch('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(undefined, undefined)
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) return
    setIsCreating(true)
    setCreateError(null)
    try {
      const created = await createCompany({ name: newCompanyName.trim(), department: 'Antioquia' })
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(created.id, created.name)
      setNewCompanyDialogOpen(false)
      setNewCompanyName('')
      setOpen(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear la empresa')
    } finally {
      setIsCreating(false)
    }
  }

  const displayName = selectedName ?? (value ? '...' : undefined)

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors
            ${error ? 'border-destructive' : 'border-input'}
            bg-transparent hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring`}
        >
          <span className={`flex items-center gap-2 truncate ${!displayName ? 'text-muted-foreground' : ''}`}>
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {displayName ?? 'Seleccionar empresa...'}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                aria-label="Quitar empresa"
                onClick={handleClear}
                className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md">
            <div className="p-2 border-b border-border">
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa..."
                className="h-8 text-sm"
              />
            </div>

            <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
              {isLoading && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Cargando...
                </li>
              )}

              {!isLoading && loadError && (
                <li className="px-3 py-4 text-center text-sm text-destructive">{loadError}</li>
              )}

              {!isLoading && !loadError && filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Sin resultados
                </li>
              )}

              {!isLoading && !loadError && filtered.map((company) => (
                <li
                  key={company.id}
                  role="option"
                  aria-selected={company.id === value}
                  onClick={() => handleSelect(company)}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  <Check
                    className={`h-4 w-4 shrink-0 ${company.id === value ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="truncate">{company.name}</span>
                </li>
              ))}
            </ul>

            {/* Add new company */}
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setNewCompanyName(search)
                  setNewCompanyDialogOpen(true)
                }}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-primary hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Agregar nueva empresa{search ? ` "${search}"` : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* New company dialog */}
      <Dialog open={newCompanyDialogOpen} onOpenChange={setNewCompanyDialogOpen}>
        <DialogContent className="!max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-company-name">Nombre de la empresa</Label>
              <Input
                id="new-company-name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCompany() } }}
                placeholder="Ej: Empresa S.A.S."
                autoFocus
              />
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setNewCompanyDialogOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCompany}
                disabled={!newCompanyName.trim() || isCreating}
              >
                {isCreating ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
