'use client'

import { useState, useTransition } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { WeeklyBalanceTable } from '@/features/hours/components/weekly-balance-table'
import { CampaignsReportTable } from './campaigns-report-table'
import { PersonalReportTable } from './personal-report-table'
import { getHoursReport, getCampaignsReport, getPersonalReport } from '../actions/report-actions'
import { exportToExcel } from '@/lib/excel/export-utils'
import type { WeeklyBalanceRow } from '@/features/hours/actions/hours-actions'
import type { CampaignReportRow, PersonalReportRow } from '../actions/report-actions'

// ---- Helpers --------------------------------------------------------------

function getCurrentMonday(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

function getMonthRange(): { monthStart: string; monthEnd: string } {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)
  return { monthStart, monthEnd }
}

function offsetWeek(weekStart: string, offsetWeeks: number): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(`${weekStart}T00:00:00`)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  const year = end.getFullYear()
  return `${fmt(start)} - ${fmt(end)} ${year}`
}

function flattenHoursRows(rows: WeeklyBalanceRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    Funcionario: `${r.lastName}, ${r.firstName}`,
    Perfil: r.staffProfile,
    'Horas sede': r.sedeHours,
    'Horas campana': r.campaignHours,
    'Total trabajadas': r.workedHours,
    'Horas extras': r.extraHours,
    Domingos: r.sundayCount,
    Pernoctas: r.overnightCount,
    Estado: r.balanceState,
    'Saldo arrastre': r.carryOverHours,
  }))
}

// ---- Props ----------------------------------------------------------------

interface ReportsClientProps {
  initialCampaigns: CampaignReportRow[]
  initialHoursRows: WeeklyBalanceRow[]
}

// ---- Component ------------------------------------------------------------

export function ReportsClient({ initialCampaigns, initialHoursRows }: ReportsClientProps) {
  // Hours tab state
  const [weekStart, setWeekStart] = useState(getCurrentMonday)
  const [hoursRows, setHoursRows] = useState<WeeklyBalanceRow[]>(initialHoursRows)
  const [hoursLoading, startHoursTransition] = useTransition()

  // Campaigns tab state
  const { monthStart, monthEnd } = getMonthRange()
  const [campaignDateFrom, setCampaignDateFrom] = useState(monthStart)
  const [campaignDateTo, setCampaignDateTo] = useState(monthEnd)
  const [campaignStatus, setCampaignStatus] = useState('')
  const [campaignRows, setCampaignRows] = useState<CampaignReportRow[]>(initialCampaigns)
  const [campaignsLoading, startCampaignsTransition] = useTransition()

  // Personal tab state
  const [personalDateFrom, setPersonalDateFrom] = useState(monthStart)
  const [personalDateTo, setPersonalDateTo] = useState(monthEnd)
  const [personalRows, setPersonalRows] = useState<PersonalReportRow[]>([])
  const [personalLoading, startPersonalTransition] = useTransition()

  // ---- Handlers -----------------------------------------------------------

  const handleWeekChange = (newWeek: string) => {
    setWeekStart(newWeek)
    startHoursTransition(async () => {
      const rows = await getHoursReport(newWeek)
      setHoursRows(rows)
    })
  }

  const handleCampaignSearch = () => {
    startCampaignsTransition(async () => {
      const rows = await getCampaignsReport({
        dateFrom: campaignDateFrom || undefined,
        dateTo: campaignDateTo || undefined,
        status: campaignStatus || undefined,
      })
      setCampaignRows(rows)
    })
  }

  const handlePersonalGenerate = () => {
    startPersonalTransition(async () => {
      const rows = await getPersonalReport({
        dateFrom: personalDateFrom,
        dateTo: personalDateTo,
      })
      setPersonalRows(rows)
    })
  }

  const handleExportHours = () => {
    exportToExcel(flattenHoursRows(hoursRows), 'Horas', `reporte-horas-${weekStart}`)
  }

  // ---- Render -------------------------------------------------------------

  return (
    <Tabs defaultValue="horas">
      <TabsList>
        <TabsTrigger value="horas">Horas</TabsTrigger>
        <TabsTrigger value="campanas">Campanas</TabsTrigger>
        <TabsTrigger value="personal">Personal</TabsTrigger>
      </TabsList>

      {/* Hours Tab */}
      <TabsContent value="horas" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleWeekChange(offsetWeek(weekStart, -1))}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {formatWeekLabel(weekStart)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleWeekChange(offsetWeek(weekStart, 1))}
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportHours}
            disabled={hoursRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
        <WeeklyBalanceTable rows={hoursRows} isLoading={hoursLoading} />
      </TabsContent>

      {/* Campaigns Tab */}
      <TabsContent value="campanas" className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label htmlFor="campaign-date-from" className="text-sm font-medium">
              Desde
            </label>
            <Input
              id="campaign-date-from"
              type="date"
              value={campaignDateFrom}
              onChange={(e) => setCampaignDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="campaign-date-to" className="text-sm font-medium">
              Hasta
            </label>
            <Input
              id="campaign-date-to"
              type="date"
              value={campaignDateTo}
              onChange={(e) => setCampaignDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="campaign-status" className="text-sm font-medium">
              Estado
            </label>
            <select
              id="campaign-status"
              value={campaignStatus}
              onChange={(e) => setCampaignStatus(e.target.value)}
              className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              <option value="tentativa">Tentativa</option>
              <option value="confirmada">Confirmada</option>
              <option value="cancelada">Cancelada</option>
              <option value="ejecutada">Ejecutada</option>
            </select>
          </div>
          <Button onClick={handleCampaignSearch} disabled={campaignsLoading}>
            {campaignsLoading ? 'Cargando...' : 'Buscar'}
          </Button>
        </div>
        <CampaignsReportTable rows={campaignRows} />
      </TabsContent>

      {/* Personal Tab */}
      <TabsContent value="personal" className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label htmlFor="personal-date-from" className="text-sm font-medium">
              Desde
            </label>
            <Input
              id="personal-date-from"
              type="date"
              value={personalDateFrom}
              onChange={(e) => setPersonalDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="personal-date-to" className="text-sm font-medium">
              Hasta
            </label>
            <Input
              id="personal-date-to"
              type="date"
              value={personalDateTo}
              onChange={(e) => setPersonalDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handlePersonalGenerate} disabled={personalLoading}>
            {personalLoading ? 'Cargando...' : 'Generar'}
          </Button>
        </div>
        <PersonalReportTable rows={personalRows} />
      </TabsContent>
    </Tabs>
  )
}
