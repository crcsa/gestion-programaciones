'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WEEKLY_HOURS_CONTRACT } from '@/features/assignments/lib/validation-constants'
import { setMyAvailability } from '../actions/my-agenda-actions'
import type { MyAgendaData } from '../actions/my-agenda-actions'
import type { Role } from '@/types/roles'

// ---- Helpers --------------------------------------------------------------

function getCurrentMondayFormatted(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Sin horario'
  return `${start} - ${end}`
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  diurno_completo: 'Diurno completo',
  noche: 'Noche',
  posturno: 'Posturno',
}

const STATUS_LABELS: Record<string, string> = {
  tentativa: 'Tentativa',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  ejecutada: 'Ejecutada',
}

const AVAILABILITY_OPTIONS = [
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'incapacidad', label: 'Incapacidad' },
  { value: 'licencia', label: 'Licencia' },
  { value: 'disponible', label: 'Disponible' },
] as const

// ---- Props ----------------------------------------------------------------

interface MyAgendaClientProps {
  data: MyAgendaData
  currentRole: Role | null
}

// ---- Stat Card ------------------------------------------------------------

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string
  value: string
  subtitle?: string
  color: 'green' | 'yellow' | 'red' | 'blue'
}) {
  const colorClasses = {
    green: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-80">{label}</p>
      {subtitle && <p className="text-xs mt-0.5 opacity-60">{subtitle}</p>}
    </div>
  )
}

// ---- Balance badge --------------------------------------------------------

function BalanceBadge({ state }: { state: string }) {
  if (state === 'cumplio') {
    return <Badge variant="default">Al dia</Badge>
  }
  if (state === 'horas_extras') {
    return <Badge variant="secondary">Horas extras</Badge>
  }
  return <Badge variant="destructive">Debe horas</Badge>
}

// ---- Sede Shifts Section --------------------------------------------------

function SedeShiftsSection({ shifts }: { shifts: MyAgendaData['sedeShiftsThisWeek'] }) {
  if (shifts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mis turnos esta semana</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Sin turnos en sede esta semana</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis turnos esta semana</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead className="text-right">Horas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>{formatDate(shift.shiftDate)}</TableCell>
                <TableCell>
                  {SHIFT_TYPE_LABELS[shift.shiftType] ?? shift.shiftType}
                  {shift.isOvernight && (
                    <Badge variant="outline" className="ml-2">Pernocta</Badge>
                  )}
                </TableCell>
                <TableCell>{shift.startTime}</TableCell>
                <TableCell>{shift.endTime}</TableCell>
                <TableCell className="text-right font-medium">{shift.totalHours}h</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---- Campaigns Section ----------------------------------------------------

function CampaignsSection({
  campaigns,
  coordinatorIds,
}: {
  campaigns: MyAgendaData['upcomingCampaigns']
  coordinatorIds: string[]
}) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mis campanas proximas (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Sin campanas asignadas proximamente</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis campanas proximas (30 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Municipio</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Rol</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => {
              const isCoordLink = coordinatorIds.includes(campaign.campaignId)
              return (
                <TableRow key={campaign.assignmentId}>
                  <TableCell>{formatDate(campaign.campaignDate)}</TableCell>
                  <TableCell>
                    {isCoordLink ? (
                      <Link
                        href={`/campanas/${campaign.campaignId}`}
                        className="text-primary underline-offset-4 hover:underline font-medium"
                      >
                        {campaign.code}
                      </Link>
                    ) : (
                      campaign.code
                    )}
                  </TableCell>
                  <TableCell>{campaign.municipality}</TableCell>
                  <TableCell>{formatTimeRange(campaign.startTime, campaign.endTime)}</TableCell>
                  <TableCell>{STATUS_LABELS[campaign.status] ?? campaign.status}</TableCell>
                  <TableCell>
                    {campaign.isCoordinator ? (
                      <Badge variant="default">Coordinador</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Miembro</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---- Availability Form ----------------------------------------------------

function AvailabilityForm() {
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<string>('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!date || !status) {
      toast.error('Seleccione fecha y motivo')
      return
    }

    startTransition(async () => {
      try {
        await setMyAvailability({
          availabilityDate: date,
          status: status as 'vacaciones' | 'incapacidad' | 'licencia' | 'disponible',
          notes: notes || undefined,
        })
        toast.success('Disponibilidad registrada correctamente')
        setDate('')
        setStatus('')
        setNotes('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al registrar'
        toast.error(message)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marcar disponibilidad</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="availability-date">Fecha</Label>
            <Input
              id="availability-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? '')} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability-notes">Notas (opcional)</Label>
            <Textarea
              id="availability-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle adicional..."
              rows={1}
            />
          </div>

          <div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ---- Main Component -------------------------------------------------------

export function MyAgendaClient({ data, currentRole }: MyAgendaClientProps) {
  const workedHours = data.weeklyBalance?.workedHours ?? 0
  const extraHours = data.weeklyBalance?.extraHours ?? 0
  const balanceState = data.weeklyBalance?.balanceState ?? 'debe_horas'

  const hoursColor = balanceState === 'cumplio'
    ? 'green' as const
    : balanceState === 'horas_extras'
      ? 'yellow' as const
      : 'red' as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {data.firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Semana del {getCurrentMondayFormatted()}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Horas trabajadas esta semana"
          value={`${workedHours}h / ${WEEKLY_HOURS_CONTRACT}h`}
          subtitle={balanceState !== 'debe_horas' ? undefined : `Faltan ${WEEKLY_HOURS_CONTRACT - workedHours}h`}
          color={hoursColor}
        />
        <StatCard
          label="Horas extras"
          value={`${extraHours}h`}
          color={extraHours > 0 ? 'yellow' : 'blue'}
        />
        <StatCard
          label="Domingos este mes"
          value={`${data.monthlyCounters.sundayCount}/2`}
          color={data.monthlyCounters.sundayCount >= 2 ? 'red' : 'green'}
        />
        <StatCard
          label="Pernoctas este mes"
          value={`${data.monthlyCounters.overnightCount}/1`}
          color={data.monthlyCounters.overnightCount >= 1 ? 'red' : 'green'}
        />
      </div>

      {/* Balance badge */}
      {data.weeklyBalance && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Estado semanal:</span>
          <BalanceBadge state={balanceState} />
        </div>
      )}

      {/* Sede shifts */}
      <SedeShiftsSection shifts={data.sedeShiftsThisWeek} />

      {/* Upcoming campaigns */}
      <CampaignsSection
        campaigns={data.upcomingCampaigns}
        coordinatorIds={data.coordinatorCampaignIds}
      />

      {/* Availability form */}
      <AvailabilityForm />
    </div>
  )
}
