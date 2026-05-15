'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  parseDashboardFilters,
  serializeDashboardFilters,
  PERIOD_LABELS,
  PROFILE_LABELS,
  DEFAULT_FILTERS,
  type DashboardFilters,
  type DashboardPeriod,
  type StaffProfile,
} from '../lib/filters'
import { AREA_LABELS, VALID_AREAS, type Area } from '@/types/areas'

interface DashboardToolbarProps {
  municipalities: string[]
  /**
   * Si true, muestra el selector de área. Reservado para admin global y
   * comercial (solo ellos pueden navegar entre áreas).
   */
  showAreaSelector?: boolean
}

export function DashboardToolbar({
  municipalities,
  showAreaSelector = false,
}: DashboardToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const filters = parseDashboardFilters(
    new URLSearchParams(searchParams?.toString() ?? ''),
  )

  const updateFilters = useCallback(
    (next: DashboardFilters) => {
      const qs = serializeDashboardFilters(next).toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      startTransition(() => {
        router.replace(url, { scroll: false })
      })
    },
    [pathname, router],
  )

  const onPeriod = (v: string | null) => {
    if (!v) return
    updateFilters({ ...filters, period: v as DashboardPeriod })
  }
  const onProfile = (v: string | null) => {
    if (!v) return
    updateFilters({
      ...filters,
      profile: v === 'todos' ? null : (v as StaffProfile),
    })
  }
  const onMunicipality = (v: string | null) => {
    if (!v) return
    updateFilters({
      ...filters,
      municipality: v === 'todas' ? null : v,
    })
  }
  const onArea = (v: string | null) => {
    if (!v) return
    updateFilters({
      ...filters,
      area: v === 'todas' ? null : (v as Area),
    })
  }

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const isFiltered =
    filters.period !== DEFAULT_FILTERS.period ||
    filters.profile !== null ||
    filters.municipality !== null ||
    filters.area !== null

  return (
    <header
      className="sticky top-0 z-30 -mx-6 -mt-6 mb-4 flex h-14 items-center gap-3 border-b border-border px-4"
      style={{ background: 'var(--background)', isolation: 'isolate' }}
    >
      <FilterField label="Periodo">
        <Select value={filters.period} onValueChange={onPeriod}>
          <SelectTrigger id="dashboard-period" className="h-8 w-36">
            <SelectValue>{PERIOD_LABELS[filters.period]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Perfil">
        <Select value={filters.profile ?? 'todos'} onValueChange={onProfile}>
          <SelectTrigger id="dashboard-profile" className="h-8 w-36">
            <SelectValue>
              {filters.profile ? PROFILE_LABELS[filters.profile] : 'Todos'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {(Object.keys(PROFILE_LABELS) as StaffProfile[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PROFILE_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Sede">
        <Select
          value={filters.municipality ?? 'todas'}
          onValueChange={onMunicipality}
        >
          <SelectTrigger id="dashboard-municipality" className="h-8 w-40">
            <SelectValue>{filters.municipality ?? 'Todas'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {municipalities.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {showAreaSelector && (
        <FilterField label="Área">
          <Select value={filters.area ?? 'todas'} onValueChange={onArea}>
            <SelectTrigger id="dashboard-area" className="h-8 w-36">
              <SelectValue>
                {filters.area ? AREA_LABELS[filters.area] : 'Todas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {VALID_AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {AREA_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      )}

      <div className="ml-auto flex items-center gap-2">
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => updateFilters(DEFAULT_FILTERS)}
          >
            Limpiar
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isPending}
        >
          <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>
    </header>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
