'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createStaffSchema, type CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import { TrainingAreaMultiSelect } from './training-area-multi-select'
import type { TrainingArea } from '@/lib/db/schema/training-areas'
import { AREA_LABELS, VALID_AREAS, type Area } from '@/types/areas'
import {
  ALLOWED_PROFILES_BY_AREA,
  STAFF_PROFILE_LABELS,
  isProfileAllowedForArea,
  type StaffProfile,
} from '@/features/staff/lib/constants'

interface StaffFormProps {
  defaultValues?: Partial<CreateStaffInput>
  onSubmit: (data: CreateStaffInput) => Promise<void>
  isLoading?: boolean
  areas: TrainingArea[]
  defaultWeeklyHours: number
  /**
   * Si true, permite al usuario elegir el área (admin global). Si false, el
   * campo área se oculta y se asume forzado a la del caller en el servidor.
   */
  canSelectArea?: boolean
  /**
   * Área del caller (banco_sangre/operativo). Se muestra como información
   * de contexto cuando no puede elegir.
   */
  callerArea?: Area | null
}

export function StaffForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  areas,
  defaultWeeklyHours,
  canSelectArea = false,
  callerArea = null,
}: StaffFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    resetField,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      weeklyHours: defaultWeeklyHours,
      trainingAreaIds: [],
      ...defaultValues,
    },
  })

  const staffProfile = watch('staffProfile')
  const selectedArea = watch('area')

  // Admin de área: hidrata `area` en el form con la del caller (read-only en
  // UI, pero el payload debe llevarla para que el zod refine cross-field y la
  // validación del server vean la combinación correcta). Si esa área admite
  // un único perfil (comercial → comercial, logistica → conductor), también
  // auto-selecciona el perfil para ahorrar un click.
  useEffect(() => {
    if (canSelectArea) return
    if (!callerArea) return
    if (selectedArea !== callerArea) {
      setValue('area', callerArea, { shouldValidate: false })
    }
    const allowed = ALLOWED_PROFILES_BY_AREA[callerArea]
    if (allowed.length === 1 && staffProfile !== allowed[0]) {
      setValue('staffProfile', allowed[0], { shouldValidate: false })
    }
  }, [canSelectArea, callerArea, selectedArea, staffProfile, setValue])

  // Si hay áreas definidas para el perfil, mostrar solo esas. Si el perfil no
  // tiene áreas asignadas (e.g. medico, auxiliar en el seed), mostrar todas
  // para que aún se puedan asignar manualmente.
  const filteredAreas = (() => {
    if (!staffProfile) return areas
    const scoped = areas.filter((a) => a.forProfiles.includes(staffProfile))
    return scoped.length > 0 ? scoped : areas
  })()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            {...register('firstName')}
            aria-invalid={!!errors.firstName}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            {...register('lastName')}
            aria-invalid={!!errors.lastName}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cedula">Cédula</Label>
          <Input
            id="cedula"
            {...register('cedula')}
            aria-invalid={!!errors.cedula}
          />
          {errors.cedula && (
            <p className="text-sm text-destructive">{errors.cedula.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
          />
        </div>
      </div>

      {/* Sección Área + Perfil: full-width y prominente. El área condiciona
          los perfiles disponibles, por eso aparece SIEMPRE antes y destacada. */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Asignación de área</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            El área determina qué perfiles puedes elegir y a qué dashboards
            tendrá acceso este colaborador.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {canSelectArea ? (
            <div className="space-y-1.5">
              <Label htmlFor="area">
                Área <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedArea ?? ''}
                onValueChange={(v) => {
                  const next = v as Area
                  setValue('area', next, { shouldValidate: true })
                  const allowed = ALLOWED_PROFILES_BY_AREA[next]
                  // Si el área solo admite un perfil (comercial → comercial,
                  // logistica → conductor), auto-selecciona ese perfil. Si admite
                  // varios (banco_sangre) y el actual ya no encaja, limpia.
                  if (allowed.length === 1) {
                    setValue('staffProfile', allowed[0], { shouldValidate: true })
                  } else if (staffProfile && !isProfileAllowedForArea(staffProfile, next)) {
                    resetField('staffProfile')
                  }
                  // El área no banco_sangre no usa trainingAreaIds.
                  if (next !== 'banco_sangre') {
                    setValue('trainingAreaIds', [], { shouldValidate: true })
                  }
                }}
              >
                <SelectTrigger id="area" aria-invalid={!!errors.area} className="w-full">
                  <SelectValue placeholder="Seleccionar área" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREA_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.area && (
                <p className="text-sm text-destructive">{errors.area.message}</p>
              )}
            </div>
          ) : (
            callerArea && (
              <div className="space-y-1.5">
                <Label>Área</Label>
                <p className="text-sm text-muted-foreground py-2">
                  {AREA_LABELS[callerArea]} (fijada según tu área)
                </p>
              </div>
            )
          )}

          <div className="space-y-1.5">
            <Label htmlFor="staffProfile">
              Perfil <span className="text-destructive">*</span>
            </Label>
            <Select
              value={staffProfile ?? ''}
              onValueChange={(v) => {
                const next = v as StaffProfile
                setValue('staffProfile', next, { shouldValidate: true })
                // Solo banco_sangre usa training areas; resto se limpia.
                if (next === 'comercial' || next === 'conductor') {
                  setValue('trainingAreaIds', [], { shouldValidate: true })
                }
              }}
            >
              <SelectTrigger id="staffProfile" aria-invalid={!!errors.staffProfile} className="w-full">
                <SelectValue placeholder={
                  canSelectArea && !selectedArea
                    ? 'Selecciona un área primero'
                    : 'Seleccionar perfil'
                } />
              </SelectTrigger>
              <SelectContent>
                {/*
                El dropdown deriva de ALLOWED_PROFILES_BY_AREA según el área
                efectiva: la seleccionada por admin global, o la del caller si
                el campo está bloqueado.
              */}
              {(() => {
                const effectiveArea: Area | null =
                  canSelectArea ? (selectedArea ?? null) : callerArea
                const allowed = effectiveArea
                  ? ALLOWED_PROFILES_BY_AREA[effectiveArea]
                  : []
                if (allowed.length === 0) {
                  return (
                    <SelectItem value="__placeholder" disabled>
                      Selecciona un área primero
                    </SelectItem>
                  )
                }
                return allowed.map((p) => (
                  <SelectItem key={p} value={p}>
                    {STAFF_PROFILE_LABELS[p]}
                  </SelectItem>
                ))
              })()}
            </SelectContent>
          </Select>
            {errors.staffProfile && (
              <p className="text-sm text-destructive">{errors.staffProfile.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="weeklyHours">Horas/semana</Label>
          <Input
            id="weeklyHours"
            type="number"
            min={20}
            max={48}
            {...register('weeklyHours', { valueAsNumber: true })}
            aria-invalid={!!errors.weeklyHours}
          />
          {errors.weeklyHours && (
            <p className="text-sm text-destructive">{errors.weeklyHours.message}</p>
          )}
        </div>

        {/*
          Áreas de entrenamiento son específicas del banco_sangre (formación
          en aféresis, inmunohematología, etc.). NO aplican a comercial ni a
          logística. Además, dentro de banco_sangre los perfiles 'comercial'
          y 'conductor' (que no deberían poder seleccionarse en esa área pero
          por defensa) ni 'administrador' (admin sin área de entrenamiento
          operativa) tampoco las usan.
        */}
        {(() => {
          const effectiveArea: Area | null =
            canSelectArea ? (selectedArea ?? null) : callerArea
          const isBancoSangre = effectiveArea === 'banco_sangre'
          const profileUsesTrainingArea =
            staffProfile === 'bacteriologo' ||
            staffProfile === 'tecnico' ||
            staffProfile === 'medico' ||
            staffProfile === 'auxiliar'
          if (!isBancoSangre || !profileUsesTrainingArea) return null
          return (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Áreas de Entrenamiento</Label>
              <Controller
                control={control}
                name="trainingAreaIds"
                render={({ field }) => (
                  <TrainingAreaMultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    areas={filteredAreas}
                  />
                )}
              />
            </div>
          )
        })()}

        <div className="space-y-1.5">
          <Label htmlFor="hireDate">Fecha de ingreso</Label>
          <Input
            id="hireDate"
            type="date"
            {...register('hireDate')}
          />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
