'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCampaignSchema,
  type CampaignDaySchedule,
  type CreateCampaignInput,
} from '@/features/campaigns/schemas/campaign-schemas'
import { CompanySelector } from './company-selector'
import { ColombiaLocationSelector } from '@/components/colombia-location-selector'
import { getDepartmentForMunicipality } from '@/lib/data/colombia-locations'

const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function expandDates(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${WEEKDAY_LABELS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface CampaignFormProps {
  defaultValues?: Partial<CreateCampaignInput>
  defaultCompanyName?: string
  onSubmit: (data: CreateCampaignInput) => Promise<void>
  isLoading?: boolean
}

export function CampaignForm({
  defaultValues,
  defaultCompanyName,
  onSubmit,
  isLoading = false,
}: CampaignFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCampaignInput>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      startTime: '07:00',
      endTime: '17:00',
      ...defaultValues,
    },
  })

  const size = watch('size')
  const modality = watch('modality')
  const companyId = watch('companyId')
  const municipality = watch('municipality')
  const campaignDate = watch('campaignDate')
  const endDate = watch('endDate')
  const startTime = watch('startTime')
  const endTime = watch('endTime')
  const dailySchedules = watch('dailySchedules')

  const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>(defaultCompanyName)
  const [department, setDepartment] = useState<string>(
    () => getDepartmentForMunicipality(defaultValues?.municipality ?? '')
  )

  const isMultiDay = !!campaignDate && !!endDate && endDate > campaignDate
  const rangeDates = useMemo(
    () => (isMultiDay && campaignDate && endDate ? expandDates(campaignDate, endDate) : []),
    [isMultiDay, campaignDate, endDate],
  )

  // Cuando cambia el rango, inicializa o ajusta los horarios por día.
  useEffect(() => {
    if (!isMultiDay) {
      // Mono-día: limpia los daily schedules
      if (dailySchedules !== undefined) {
        setValue('dailySchedules', undefined, { shouldValidate: false })
      }
      return
    }
    const baseStart = startTime ?? '07:00'
    const baseEnd = endTime ?? '17:00'
    const existing = dailySchedules ?? []
    const next: CampaignDaySchedule[] = rangeDates.map((dayDate, idx) => {
      const found = existing.find((s) => s.dayDate === dayDate)
      const isLast = idx === rangeDates.length - 1
      return (
        found ?? {
          dayDate,
          startTime: baseStart,
          endTime: baseEnd,
          isOvernight: !isLast,
        }
      )
    })
    setValue('dailySchedules', next, { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiDay, campaignDate, endDate])

  function updateDaySchedule(dayDate: string, patch: Partial<CampaignDaySchedule>) {
    const list = (dailySchedules ?? []).map((s) =>
      s.dayDate === dayDate ? { ...s, ...patch } : s,
    )
    setValue('dailySchedules', list, { shouldValidate: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            {...register('code')}
            aria-invalid={!!errors.code}
            placeholder="Ej: CMP-2026-001"
          />
          {errors.code && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Empresa</Label>
          <CompanySelector
            value={companyId}
            selectedName={selectedCompanyName}
            onChange={(id, name) => {
              setValue('companyId', id, { shouldValidate: true })
              setSelectedCompanyName(name)
            }}
            error={errors.companyId?.message}
          />
        </div>

        <ColombiaLocationSelector
          idPrefix="campaign-"
          department={department}
          municipality={municipality ?? ''}
          onDepartmentChange={(dep) => {
            setDepartment(dep)
            setValue('municipality', '', { shouldValidate: false })
          }}
          onMunicipalityChange={(mun) =>
            setValue('municipality', mun, { shouldValidate: true })
          }
          municipalityError={errors.municipality?.message}
          municipalityRequired
        />

        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección (opcional)</Label>
          <Input
            id="address"
            placeholder="Ej: Calle 73 # 51d - 14"
            {...register('address')}
            aria-invalid={!!errors.address}
          />
          <p className="text-xs text-muted-foreground">
            Si la ingresas, la campaña se ubicará en el mapa según la dirección y el municipio.
          </p>
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaignDate">Fecha de inicio</Label>
          <Input
            id="campaignDate"
            type="date"
            {...register('campaignDate')}
            aria-invalid={!!errors.campaignDate}
          />
          {errors.campaignDate && (
            <p className="text-sm text-destructive">
              {errors.campaignDate.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endDate">
            Fecha de fin <span className="text-muted-foreground text-xs">(opcional)</span>
          </Label>
          <Input
            id="endDate"
            type="date"
            min={campaignDate || undefined}
            {...register('endDate')}
            aria-invalid={!!errors.endDate}
          />
          <p className="text-xs text-muted-foreground">
            Si es mayor a la fecha de inicio, se programa por día con pernocta entre días intermedios.
          </p>
          {errors.endDate && (
            <p className="text-sm text-destructive">{errors.endDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expectedDonations">Donaciones esperadas</Label>
          <Input
            id="expectedDonations"
            type="number"
            min={1}
            {...register('expectedDonations', { valueAsNumber: true })}
            aria-invalid={!!errors.expectedDonations}
            placeholder="Ej: 50"
          />
          {errors.expectedDonations && (
            <p className="text-sm text-destructive">
              {errors.expectedDonations.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startTime">Hora de inicio</Label>
          <Input
            id="startTime"
            type="time"
            {...register('startTime')}
            aria-invalid={!!errors.startTime}
          />
          {errors.startTime && (
            <p className="text-sm text-destructive">
              {errors.startTime.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endTime">Hora de fin</Label>
          <Input
            id="endTime"
            type="time"
            {...register('endTime')}
            aria-invalid={!!errors.endTime}
          />
          {errors.endTime && (
            <p className="text-sm text-destructive">{errors.endTime.message}</p>
          )}
        </div>

        {isMultiDay && rangeDates.length > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-border p-3 space-y-2">
            <div>
              <p className="text-sm font-medium">Horarios por día ({rangeDates.length} días)</p>
              <p className="text-xs text-muted-foreground">
                Ajusta inicio/fin de cada día y marca pernocta si el equipo se queda en el sitio
                esa noche. Por defecto los días intermedios quedan con pernocta y el último sin.
              </p>
            </div>
            <div className="space-y-2">
              {rangeDates.map((dayDate) => {
                const day = (dailySchedules ?? []).find((d) => d.dayDate === dayDate)
                return (
                  <div
                    key={dayDate}
                    className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 p-2"
                  >
                    <div className="min-w-[120px] flex-1">
                      <Label className="text-xs">{formatDayLabel(dayDate)}</Label>
                      <p className="text-[10px] text-muted-foreground font-mono">{dayDate}</p>
                    </div>
                    <div>
                      <Label className="text-xs">Inicio</Label>
                      <Input
                        type="time"
                        value={day?.startTime ?? ''}
                        onChange={(e) => updateDaySchedule(dayDate, { startTime: e.target.value })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Fin</Label>
                      <Input
                        type="time"
                        value={day?.endTime ?? ''}
                        onChange={(e) => updateDaySchedule(dayDate, { endTime: e.target.value })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id={`overnight-${dayDate}`}
                        checked={day?.isOvernight ?? false}
                        onChange={(e) =>
                          updateDaySchedule(dayDate, { isOvernight: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                      <Label htmlFor={`overnight-${dayDate}`} className="text-xs cursor-pointer">
                        Pernocta esta noche
                      </Label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="size">Tamaño</Label>
          <Select
            value={size ?? ''}
            onValueChange={(v) =>
              setValue('size', v as CreateCampaignInput['size'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger
              id="size"
              aria-invalid={!!errors.size}
              className="w-full"
            >
              <SelectValue placeholder="Seleccionar tamaño" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">S</SelectItem>
              <SelectItem value="S_plus">S+</SelectItem>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="L">L</SelectItem>
            </SelectContent>
          </Select>
          {errors.size && (
            <p className="text-sm text-destructive">{errors.size.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="modality">Modalidad</Label>
          <Select
            value={modality ?? ''}
            onValueChange={(v) =>
              setValue('modality', v as CreateCampaignInput['modality'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger
              id="modality"
              aria-invalid={!!errors.modality}
              className="w-full"
            >
              <SelectValue placeholder="Seleccionar modalidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="corporativa">Corporativa</SelectItem>
              <SelectItem value="carpa">Carpa</SelectItem>
              <SelectItem value="unidad_movil">Unidad Móvil</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
              <SelectItem value="combinada">Combinada</SelectItem>
            </SelectContent>
          </Select>
          {errors.modality && (
            <p className="text-sm text-destructive">{errors.modality.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="observations">Observaciones</Label>
          <Textarea
            id="observations"
            {...register('observations')}
            placeholder="Observaciones adicionales..."
            aria-invalid={!!errors.observations}
          />
          {errors.observations && (
            <p className="text-sm text-destructive">
              {errors.observations.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hexabankCode">Codigo Hexabank (opcional)</Label>
          <Input
            id="hexabankCode"
            {...register('hexabankCode')}
            aria-invalid={!!errors.hexabankCode}
            placeholder="Ej: HXB-001"
          />
          {errors.hexabankCode && (
            <p className="text-sm text-destructive">
              {errors.hexabankCode.message}
            </p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar campaña'}
        </Button>
      </div>
    </form>
  )
}
