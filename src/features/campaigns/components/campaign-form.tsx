'use client'

import { useState } from 'react'
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
  type CreateCampaignInput,
} from '@/features/campaigns/schemas/campaign-schemas'
import { CompanySelector } from './company-selector'

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
      ...defaultValues,
    },
  })

  const size = watch('size')
  const modality = watch('modality')
  const companyId = watch('companyId')
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>(defaultCompanyName)

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

        <div className="space-y-1.5">
          <Label htmlFor="municipality">Municipio</Label>
          <Input
            id="municipality"
            {...register('municipality')}
            aria-invalid={!!errors.municipality}
            placeholder="Ej: Bogotá"
          />
          {errors.municipality && (
            <p className="text-sm text-destructive">
              {errors.municipality.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaignDate">Fecha de campaña</Label>
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
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="virtual">Virtual</SelectItem>
              <SelectItem value="mixta">Mixta</SelectItem>
              <SelectItem value="movil">Móvil</SelectItem>
              <SelectItem value="institucional">Institucional</SelectItem>
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
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar campaña'}
        </Button>
      </div>
    </form>
  )
}
