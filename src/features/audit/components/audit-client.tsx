'use client'

import { useState, useCallback, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getAuditLog } from '@/features/audit/actions/audit-actions'
import type { AuditLogRow, AuditLogFilters } from '@/features/audit/actions/audit-actions'

// ---- Helpers ---------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  create: 'Crear',
  update: 'Actualizar',
  delete: 'Eliminar',
  login: 'Login',
  logout: 'Logout',
}

const ACTION_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  login: 'outline',
  logout: 'outline',
}

const TABLE_LABELS: Record<string, string> = {
  campaigns: 'Campanas',
  staff_members: 'Personal',
  companies: 'Empresas',
  campaign_assignments: 'Asignaciones',
}

function formatDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatJson(data: Record<string, unknown> | null): string {
  if (!data) return '--'
  return JSON.stringify(data, null, 2)
}

// ---- Constants -------------------------------------------------------------

const PAGE_LIMIT = 50

// ---- Component -------------------------------------------------------------

interface AuditClientProps {
  initialData: AuditLogRow[]
  initialTotal: number
}

export function AuditClient({ initialData, initialTotal }: AuditClientProps) {
  const [data, setData] = useState<AuditLogRow[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const [filterAction, setFilterAction] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  const fetchData = useCallback(
    async (filters: AuditLogFilters) => {
      setIsLoading(true)
      try {
        const result = await getAuditLog(filters)
        setData(result.data)
        setTotal(result.total)
      } catch {
        // silently fail — user sees stale data
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  function buildFilters(overridePage?: number): AuditLogFilters {
    const filters: AuditLogFilters = {
      page: overridePage ?? page,
      limit: PAGE_LIMIT,
    }
    if (filterAction) filters.action = filterAction
    if (filterTable) filters.tableName = filterTable
    if (filterDateFrom) filters.dateFrom = filterDateFrom
    if (filterDateTo) filters.dateTo = filterDateTo
    return filters
  }

  function handleSearch() {
    setPage(1)
    fetchData(buildFilters(1))
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    fetchData(buildFilters(newPage))
  }

  function handleExport() {
    const rows = data.map((r) => ({
      'Fecha y Hora': formatDateTime(r.createdAt),
      Usuario: r.userFullName ?? r.userEmail ?? '--',
      Accion: ACTION_LABELS[r.action] ?? r.action,
      Tabla: TABLE_LABELS[r.tableName ?? ''] ?? r.tableName ?? '--',
      'ID Registro': r.recordId ?? '--',
      'Datos Nuevos': r.newData ? JSON.stringify(r.newData) : '',
      'Datos Anteriores': r.oldData ? JSON.stringify(r.oldData) : '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria')
    XLSX.writeFile(wb, `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function toggleExpand(id: string) {
    setExpandedRow((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-muted-foreground text-sm">
            Registro de todas las acciones realizadas en el sistema
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="filter-action" className="text-xs font-medium text-muted-foreground">
            Accion
          </label>
          <select
            id="filter-action"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="create">Crear</option>
            <option value="update">Actualizar</option>
            <option value="delete">Eliminar</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="filter-table" className="text-xs font-medium text-muted-foreground">
            Tabla
          </label>
          <Input
            id="filter-table"
            className="h-9 w-40"
            placeholder="ej. campaigns"
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground">
            Desde
          </label>
          <Input
            id="filter-from"
            type="date"
            className="h-9 w-40"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground">
            Hasta
          </label>
          <Input
            id="filter-to"
            type="date"
            className="h-9 w-40"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        <Button onClick={handleSearch} disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          Buscar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {['Fecha y Hora', 'Usuario', 'Accion', 'Tabla', 'ID Registro', 'Ver cambios'].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No se encontraron registros de auditoria.
                </td>
              </tr>
            )}
            {data.map((row) => {
              const isExpanded = expandedRow === row.id
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-border hover:bg-muted/50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {row.userFullName ?? row.userEmail ?? '--'}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={ACTION_VARIANTS[row.action] ?? 'outline'}>
                        {ACTION_LABELS[row.action] ?? row.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {TABLE_LABELS[row.tableName ?? ''] ?? row.tableName ?? '--'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.recordId ? row.recordId.slice(0, 8) : '--'}
                    </td>
                    <td className="px-4 py-2">
                      {(row.oldData || row.newData) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(row.id)}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-medium mb-1">Datos anteriores</p>
                            <pre className="whitespace-pre-wrap rounded bg-muted p-2 max-h-40 overflow-auto">
                              {formatJson(row.oldData as Record<string, unknown> | null)}
                            </pre>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Datos nuevos</p>
                            <pre className="whitespace-pre-wrap rounded bg-muted p-2 max-h-40 overflow-auto">
                              {formatJson(row.newData as Record<string, unknown> | null)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} registro(s) en total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => handlePageChange(page + 1)}
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
