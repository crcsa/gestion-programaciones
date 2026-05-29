import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { getCampaignById } from '@/features/campaigns/actions/campaign-actions'
import { getCampaignTimeline } from '@/features/hours/actions/hours-balance-actions'
import { CampaignStatusBadge } from '@/features/campaigns/components/campaign-status-badge'
import { CampaignSizeBadge } from '@/features/campaigns/components/campaign-size-badge'
import { AssignmentPanel } from '@/features/assignments/components/assignment-panel'
import { CommercialAssignmentPanel } from '@/features/assignments/components/commercial-assignment-panel'
import { LogisticsAssignmentPanel } from '@/features/logistics/components/logistics-assignment-panel'
import {
  getAssignedVehicles,
  getAvailableVehicles,
  getAvailableDrivers,
} from '@/features/logistics/actions/campaign-vehicle-actions'
import { getCurrentUserContext } from '@/features/auth/lib/user-context'
import { TimelineProgrammingForm } from '@/features/hours/components/timeline-programming-form'
import { TimelineExecutionForm } from '@/features/hours/components/timeline-execution-form'
import { TimelineReadOnlyView } from '@/features/hours/components/timeline-readonly-view'
import { CampaignCommercialView } from '@/features/campaigns/components/campaign-commercial-view'
import { CampaignLocationCard } from '@/features/campaigns/components/campaign-location-card'
import { CampaignBreadcrumbLabel } from '@/features/campaigns/components/campaign-breadcrumb-label'
import { Button } from '@/components/ui/button'
import {
  CAMPAIGN_MODALITY_LABELS,
} from '@/features/campaigns/lib/constants'
import {
  canAccessLogistics,
  canAccessCommercial,
  canAccessBancoSangre,
} from '@/lib/auth/area-gates'

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
}

async function isCoordinatorOfCampaign(
  campaignId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: campaignAssignments.id })
    .from(campaignAssignments)
    .innerJoin(staffMembers, eq(staffMembers.id, campaignAssignments.staffId))
    .where(
      and(
        eq(campaignAssignments.campaignId, campaignId),
        eq(campaignAssignments.isActive, true),
        eq(campaignAssignments.isCoordinator, true),
        eq(staffMembers.profileId, userId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params

  let campaign
  try {
    campaign = await getCampaignById(id)
  } catch {
    notFound()
  }

  if (!campaign) {
    notFound()
  }

  const isAssignable =
    campaign.status === 'confirmada' || campaign.status === 'ejecutada'

  const [timelineEvents, ctx, assignedVehicles] = await Promise.all([
    isAssignable ? getCampaignTimeline(id).catch(() => []) : Promise.resolve([]),
    getCurrentUserContext(),
    isAssignable ? getAssignedVehicles(id).catch(() => []) : Promise.resolve([]),
  ])
  const userId = ctx?.userId ?? null
  const currentRole = ctx?.role ?? null

  // Cada área edita SOLO su propio panel. Los demás (incluyendo otras áreas
  // admin) ven los paneles en read-only para coordinación. Predicates en
  // `area-gates` (única fuente de verdad consumida también por el server gate
  // de los actions correspondientes).
  const canEditLogistics = canAccessLogistics(ctx?.role, ctx?.area)
  const canEditCommercial = canAccessCommercial(ctx?.role, ctx?.area)
  const canEditBancoSangrePersonal = canAccessBancoSangre(ctx?.role, ctx?.area)

  // Solo cargamos pools cuando el caller puede editar — read-only no necesita.
  const [availableVehicles, availableDrivers] = await Promise.all([
    isAssignable && canEditLogistics
      ? getAvailableVehicles(id).catch(() => [])
      : Promise.resolve([]),
    isAssignable && canEditLogistics
      ? getAvailableDrivers(id).catch(() => [])
      : Promise.resolve([]),
  ])

  const isTentativa = campaign.status === 'tentativa'
  // Solo super-admin y comercial (role='comercial' o admin_area+comercial)
  // pueden editar la campaña en sí. Banco_sangre y logistica solo asignan
  // su personal/vehículos via los paneles.
  const canManageCampaigns = canEditCommercial
  const canEdit = isTentativa && canManageCampaigns
  // Multi-día: tenemos endDate posterior a campaignDate, o más de 1 row en campaign_days.
  const isMultiDay =
    (!!campaign.endDate && campaign.endDate > campaign.campaignDate) ||
    campaign.days.length > 1
  const totalDays = isMultiDay
    ? campaign.days.length || daysBetween(campaign.campaignDate, campaign.endDate ?? campaign.campaignDate)
    : 1
  const overnightCount = campaign.days.filter((d) => d.isOvernight).length
  // Solo admin global o admin_area de banco_sangre programan/editan la línea
  // de tiempo. Comercial y logística la ven en modo read-only.
  const canSchedule = canEditBancoSangrePersonal
  const isCoordinatorAssigned =
    currentRole === 'operativo' && userId
      ? await isCoordinatorOfCampaign(id, userId)
      : false
  const canRegisterActual = canSchedule || isCoordinatorAssigned
  // admin_area+comercial también ve la vista comercial (alineado con canEditCommercial).
  const isCommercial = canEditCommercial

  return (
    <div className="space-y-6">
      <CampaignBreadcrumbLabel id={campaign.id} code={campaign.code} />
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Campaña {campaign.code}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {campaign.companyName ?? 'Sin empresa asignada'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CampaignStatusBadge status={campaign.status} />
          {canEdit && (
            <Button variant="outline" nativeButton={false} render={<Link href={`/campanas/${id}/editar`} />}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Info grid — 3 columns on wide screens */}
      <div className="rounded-lg border border-border p-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        <DetailRow label="Código" value={campaign.code} />
        <DetailRow label="Empresa" value={campaign.companyName ?? '—'} />
        <DetailRow label="Municipio" value={campaign.municipality} />
        {isMultiDay ? (
          <>
            <DetailRow
              label="Fecha inicio"
              value={formatCampaignDate(campaign.campaignDate)}
            />
            <DetailRow
              label="Fecha fin"
              value={formatCampaignDate(campaign.endDate ?? campaign.campaignDate)}
            />
            <DetailRow
              label="Pernoctas"
              value={`${overnightCount} ${overnightCount === 1 ? 'noche' : 'noches'} (${totalDays} días)`}
            />
          </>
        ) : (
          <DetailRow label="Fecha" value={formatCampaignDate(campaign.campaignDate)} />
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tamaño</p>
          <div className="mt-1">
            <CampaignSizeBadge size={campaign.size} />
          </div>
        </div>
        <DetailRow
          label="Modalidad"
          value={CAMPAIGN_MODALITY_LABELS[campaign.modality] ?? campaign.modality}
        />
        <DetailRow
          label="Donaciones esperadas"
          value={campaign.expectedDonations != null ? String(campaign.expectedDonations) : '—'}
        />
        {campaign.startTime && <DetailRow label="Hora de inicio" value={campaign.startTime} />}
        {campaign.endTime && <DetailRow label="Hora de fin" value={campaign.endTime} />}
        {campaign.hexabankCode && <DetailRow label="Código Hexabank" value={campaign.hexabankCode} />}
        {campaign.observations && (
          <div className="col-span-2 sm:col-span-3">
            <DetailRow label="Observaciones" value={campaign.observations} />
          </div>
        )}
        {campaign.cancelReason && (
          <div className="col-span-2 sm:col-span-3">
            <DetailRow label="Motivo de cancelación" value={campaign.cancelReason} />
          </div>
        )}
      </div>

      {/* Ubicación — mapa OpenStreetMap (solo si la campaña tiene dirección) */}
      <CampaignLocationCard location={campaign.location} companyName={campaign.companyName} />

      {/* Logistics — vehículos y conductores */}
      {isAssignable && (
        <LogisticsAssignmentPanel
          campaignId={campaign.id}
          assigned={assignedVehicles}
          availableVehicles={availableVehicles}
          availableDrivers={availableDrivers}
          canEdit={canEditLogistics}
        />
      )}

      {/* Operativos comerciales — área comercial edita, las demás solo ven */}
      {isAssignable && (
        <section className="rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold mb-4">Operativos comerciales</h2>
          <CommercialAssignmentPanel
            campaignId={campaign.id}
            campaignStatus={campaign.status}
            canEdit={canEditCommercial}
          />
        </section>
      )}

      {/* Assignment + Timeline */}
      {isAssignable && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border p-5">
            <h2 className="text-base font-semibold mb-4">Personal asignado (banco de sangre)</h2>
            <AssignmentPanel
              campaignId={campaign.id}
              campaignSize={campaign.size}
              campaignStatus={campaign.status}
              canEdit={canEditBancoSangrePersonal}
            />
          </section>

          <div className="space-y-6">
            {canSchedule && (
              <section className="rounded-lg border border-border p-5">
                <TimelineProgrammingForm
                  campaignId={campaign.id}
                  campaignDate={campaign.campaignDate}
                  startTime={
                    campaign.days.find((d) => d.dayDate === campaign.campaignDate)?.startTime ??
                    campaign.startTime
                  }
                  endTime={
                    campaign.days.find((d) => d.dayDate === campaign.campaignDate)?.endTime ??
                    campaign.endTime
                  }
                  isOvernight={
                    campaign.days.find((d) => d.dayDate === campaign.campaignDate)?.isOvernight ??
                    false
                  }
                  existingEvents={timelineEvents}
                />
              </section>
            )}
            {canRegisterActual && (
              <section className="rounded-lg border border-border p-5 space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Registro de ejecución</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {canSchedule
                      ? 'Revisa las horas reales registradas en campo y finaliza para homologar las horas a todo el personal asignado.'
                      : 'Registra las horas reales cuando inicies la jornada de campo.'}
                  </p>
                </div>
                <TimelineExecutionForm
                  campaignId={campaign.id}
                  campaignDate={campaign.campaignDate}
                  existingEvents={timelineEvents}
                  canFinalize={canSchedule}
                  isFinalized={campaign.status === 'ejecutada'}
                />
              </section>
            )}
            {/*
              Comercial y logística (que NO programan ni registran la línea de
              tiempo) ven la vista de solo lectura para coordinar. Admin global
              y admin_area de banco_sangre ya tienen el form de edición arriba.
            */}
            {!canSchedule && !canRegisterActual && (
              <TimelineReadOnlyView
                events={timelineEvents}
                campaignStartTime={campaign.startTime}
                campaignEndTime={campaign.endTime}
              />
            )}
            {isCommercial && (
              <CampaignCommercialView campaignId={campaign.id} size={campaign.size} />
            )}
          </div>
        </div>
      )}

      <div>
        <Button variant="outline" nativeButton={false} render={<Link href="/campanas" />}>
          ← Campañas
        </Button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  )
}

function formatCampaignDate(dateStr: string): string {
  try {
    return format(new Date(`${dateStr}T00:00:00`), 'dd/MM/yyyy', { locale: es })
  } catch {
    return dateStr
  }
}

function daysBetween(startDate: string, endDate: string): number {
  try {
    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    const ms = end.getTime() - start.getTime()
    return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1)
  } catch {
    return 1
  }
}
