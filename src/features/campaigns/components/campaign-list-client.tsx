'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { CampaignFilters } from './campaign-filters'
import { CampaignTable } from './campaign-table'
import { CampaignForm } from './campaign-form'
import { CancelCampaignDialog } from './cancel-campaign-dialog'
import { DeleteCampaignDialog } from './delete-campaign-dialog'
import { ExcelImportDialog } from './excel-import-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PAGE_LIMIT } from '@/features/campaigns/lib/constants'
import {
  getCampaignsList,
  getCampaignById,
  createCampaign,
  updateCampaign,
  confirmCampaign,
  cancelCampaign,
  deleteCampaign,
  bulkConfirmCampaigns,
  bulkCancelCampaigns,
} from '@/features/campaigns/actions/campaign-actions'
import type {
  CampaignListFilters as ActionFilters,
  CampaignListItem,
  CampaignListResult,
} from '@/features/campaigns/actions/campaign-actions'
import type { CreateCampaignInput } from '@/features/campaigns/schemas/campaign-schemas'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

interface CampaignListClientProps {
  initialData: CampaignListResult
  currentRole: Role | null
  currentArea?: Area | null
}

export function CampaignListClient({
  initialData,
  currentRole,
  currentArea = null,
}: CampaignListClientProps) {
  // Solo super-admin y comercial (role='comercial' o admin_area+comercial)
  // pueden crear/editar/confirmar/cancelar/eliminar/importar campañas.
  const canManageCampaigns =
    currentRole === 'admin' ||
    currentRole === 'comercial' ||
    (currentRole === 'admin_area' && currentArea === 'comercial')
  const [data, setData] = useState<CampaignListItem[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ActionFilters>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignListItem | null>(null)
  const [editDefaultValues, setEditDefaultValues] = useState<Partial<CreateCampaignInput> | undefined>(undefined)
  const [editDefaultCompanyName, setEditDefaultCompanyName] = useState<string | undefined>(undefined)

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelingCampaign, setCancelingCampaign] = useState<CampaignListItem | null>(null)
  const [isCancelLoading, setIsCancelLoading] = useState(false)

  const [isConfirming, setIsConfirming] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCampaign, setDeletingCampaign] = useState<CampaignListItem | null>(null)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  // Selección múltiple (solo campañas tentativa).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const fetchData = useCallback(
    async (nextFilters: ActionFilters, nextPage: number) => {
      setIsLoading(true)
      try {
        const result = await getCampaignsList({ ...nextFilters, page: nextPage, limit: PAGE_LIMIT })
        setError(null)
        setData(result.data)
        setTotal(result.total)
        setSelectedIds(new Set()) // la selección no cruza recargas/páginas
      } catch {
        setError('Error al cargar las campañas. Intente de nuevo.')
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      }
      return new Set([...prev, ...ids])
    })
  }, [])

  const handleBulkConfirm = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setIsBulkLoading(true)
    try {
      const r = await bulkConfirmCampaigns(ids)
      toast.success(
        `${r.ok} campaña(s) confirmada(s)` +
          (r.skipped ? ` · ${r.skipped} omitida(s)` : '') +
          (r.errors.length ? ` · ${r.errors.length} con error` : ''),
      )
      await fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al confirmar en lote')
    } finally {
      setIsBulkLoading(false)
    }
  }, [selectedIds, fetchData, filters, page])

  const handleBulkCancelConfirm = useCallback(async (reason: string) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setIsBulkLoading(true)
    try {
      const r = await bulkCancelCampaigns(ids, reason)
      toast.success(
        `${r.ok} campaña(s) cancelada(s)` +
          (r.skipped ? ` · ${r.skipped} omitida(s)` : '') +
          (r.errors.length ? ` · ${r.errors.length} con error` : ''),
      )
      setBulkCancelOpen(false)
      await fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar en lote')
    } finally {
      setIsBulkLoading(false)
    }
  }, [selectedIds, fetchData, filters, page])

  useEffect(() => {
    if (page === 1 && Object.keys(filters).length === 0) return
    fetchData(filters, page)
  }, [filters, page, fetchData])

  const handleFiltersChange = useCallback((newFilters: ActionFilters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleNuevo = useCallback(() => {
    setEditingCampaign(null)
    setEditDefaultValues(undefined)
    setEditDefaultCompanyName(undefined)
    setModalOpen(true)
  }, [])

  const handleEdit = useCallback(async (campaign: CampaignListItem) => {
    try {
      const full = await getCampaignById(campaign.id)
      setEditingCampaign(campaign)
      setEditDefaultCompanyName(full.companyName ?? undefined)
      setEditDefaultValues({
        code: full.code,
        companyId: full.companyId ?? undefined,
        locationId: full.locationId ?? undefined,
        campaignDate: full.campaignDate,
        endDate: full.endDate ?? undefined,
        startTime: full.startTime ?? undefined,
        endTime: full.endTime ?? undefined,
        dailySchedules:
          full.days && full.days.length > 0
            ? full.days.map((d) => ({
                dayDate: d.dayDate,
                startTime: d.startTime,
                endTime: d.endTime,
                isOvernight: d.isOvernight,
              }))
            : undefined,
        size: full.size,
        modality: full.modality,
        municipality: full.municipality,
        expectedDonations: full.expectedDonations ?? undefined,
        trainingAreaId: full.trainingAreaId ?? undefined,
        observations: full.observations ?? undefined,
      })
      setModalOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar la campaña')
    }
  }, [])

  const handleConfirm = useCallback(async (campaign: CampaignListItem) => {
    setIsConfirming(true)
    try {
      await confirmCampaign(campaign.id)
      toast.success('Campaña confirmada correctamente')
      await fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al confirmar la campaña')
    } finally {
      setIsConfirming(false)
    }
  }, [fetchData, filters, page])

  const handleCancelClick = useCallback((campaign: CampaignListItem) => {
    setCancelingCampaign(campaign)
    setCancelDialogOpen(true)
  }, [])

  const handleCancelConfirm = useCallback(async (reason: string) => {
    if (!cancelingCampaign) return
    setIsCancelLoading(true)
    try {
      await cancelCampaign(cancelingCampaign.id, reason)
      toast.success('Campaña cancelada correctamente')
      setCancelDialogOpen(false)
      setCancelingCampaign(null)
      await fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar la campaña')
    } finally {
      setIsCancelLoading(false)
    }
  }, [cancelingCampaign, fetchData, filters, page])

  const handleDeleteClick = useCallback((campaign: CampaignListItem) => {
    setDeletingCampaign(campaign)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingCampaign) return
    setIsDeleteLoading(true)
    try {
      await deleteCampaign(deletingCampaign.id)
      toast.success('Campaña eliminada correctamente')
      setDeleteDialogOpen(false)
      setDeletingCampaign(null)
      await fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar la campaña')
    } finally {
      setIsDeleteLoading(false)
    }
  }, [deletingCampaign, fetchData, filters, page])

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open)
    if (!open) {
      setEditingCampaign(null)
      setEditDefaultValues(undefined)
      setEditDefaultCompanyName(undefined)
    }
  }, [])

  const handleFormSubmit = useCallback(async (formData: CreateCampaignInput) => {
    setIsFormLoading(true)
    try {
      if (editingCampaign) {
        const { code: _code, ...rest } = formData
        await updateCampaign(editingCampaign.id, rest)
        toast.success('Campaña actualizada correctamente')
      } else {
        await createCampaign(formData)
        toast.success('Campaña creada correctamente')
      }
      setModalOpen(false)
      setEditingCampaign(null)
      setEditDefaultValues(undefined)
      setEditDefaultCompanyName(undefined)
      await fetchData(filters, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la campaña')
    } finally {
      setIsFormLoading(false)
    }
  }, [editingCampaign, fetchData, filters, page])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campañas</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de campañas de donación
          </p>
        </div>

        {canManageCampaigns && (
          <div className="flex items-center gap-2">
            <ExcelImportDialog onSuccess={() => fetchData(filters, page)} />
            <Button onClick={handleNuevo}>
              Nueva campaña
            </Button>
          </div>
        )}
      </div>

      <CampaignFilters onFiltersChange={handleFiltersChange} />

      {canManageCampaigns && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} campaña(s) tentativa(s) seleccionada(s)
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={handleBulkConfirm} disabled={isBulkLoading}>
              {isBulkLoading ? 'Procesando...' : 'Confirmar seleccionadas'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkCancelOpen(true)}
              disabled={isBulkLoading}
            >
              Cancelar seleccionadas
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} disabled={isBulkLoading}>
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {error !== null && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <CampaignTable
          data={data}
          total={total}
          page={page}
          onPageChange={handlePageChange}
          onEdit={canManageCampaigns ? handleEdit : undefined}
          onConfirm={canManageCampaigns && !isConfirming ? handleConfirm : undefined}
          onCancel={canManageCampaigns ? handleCancelClick : undefined}
          onDelete={canManageCampaigns ? handleDeleteClick : undefined}
          selectedIds={canManageCampaigns ? selectedIds : undefined}
          onToggleSelect={canManageCampaigns ? toggleSelect : undefined}
          onToggleSelectAll={canManageCampaigns ? toggleSelectAll : undefined}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="!max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Editar campaña' : 'Nueva campaña'}
            </DialogTitle>
          </DialogHeader>
          <CampaignForm
            defaultValues={editDefaultValues}
            defaultCompanyName={editDefaultCompanyName}
            onSubmit={handleFormSubmit}
            isLoading={isFormLoading}
          />
        </DialogContent>
      </Dialog>

      <CancelCampaignDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        campaignCode={cancelingCampaign?.code ?? ''}
        campaignId={cancelingCampaign?.id ?? ''}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelLoading}
      />

      <DeleteCampaignDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        campaignCode={deletingCampaign?.code ?? ''}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleteLoading}
      />

      <CancelCampaignDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        campaignCode=""
        campaignId=""
        title={`Cancelar ${selectedIds.size} campaña(s) seleccionada(s)`}
        onConfirm={handleBulkCancelConfirm}
        isLoading={isBulkLoading}
      />
    </div>
  )
}
