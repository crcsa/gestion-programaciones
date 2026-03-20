'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { CampaignFilters } from './campaign-filters'
import { CampaignTable } from './campaign-table'
import { CampaignForm } from './campaign-form'
import { CancelCampaignDialog } from './cancel-campaign-dialog'
import { ExcelImportDialog } from './excel-import-dialog'
import { RoleGate } from '@/features/auth/components/role-gate'
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
} from '@/features/campaigns/actions/campaign-actions'
import type {
  CampaignListFilters as ActionFilters,
  CampaignListItem,
  CampaignListResult,
} from '@/features/campaigns/actions/campaign-actions'
import type { CreateCampaignInput } from '@/features/campaigns/schemas/campaign-schemas'
import type { Role } from '@/types/roles'

interface CampaignListClientProps {
  initialData: CampaignListResult
  currentRole: Role | null
}

export function CampaignListClient({ initialData, currentRole }: CampaignListClientProps) {
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

  const fetchData = useCallback(
    async (nextFilters: ActionFilters, nextPage: number) => {
      setIsLoading(true)
      try {
        const result = await getCampaignsList({ ...nextFilters, page: nextPage, limit: PAGE_LIMIT })
        setError(null)
        setData(result.data)
        setTotal(result.total)
      } catch {
        setError('Error al cargar las campañas. Intente de nuevo.')
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

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
        startTime: full.startTime ?? undefined,
        endTime: full.endTime ?? undefined,
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

        <RoleGate allowedRoles={['admin', 'banco_sangre', 'comercial']} currentRole={currentRole}>
          <div className="flex items-center gap-2">
            <ExcelImportDialog onSuccess={() => fetchData(filters, page)} />
            <Button onClick={handleNuevo}>
              Nueva campaña
            </Button>
          </div>
        </RoleGate>
      </div>

      <CampaignFilters onFiltersChange={handleFiltersChange} />

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
          onEdit={handleEdit}
          onConfirm={isConfirming ? undefined : handleConfirm}
          onCancel={handleCancelClick}
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
        onConfirm={handleCancelConfirm}
        isLoading={isCancelLoading}
      />
    </div>
  )
}
