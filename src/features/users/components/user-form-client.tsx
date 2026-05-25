'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
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
import { createUserSchema, type CreateUserInput } from '../schemas/user-schemas'
import { createUser } from '../actions/user-actions'
import { getAllowedRolesForCaller } from '../lib/allowed-roles'
import { PasswordGeneratorButton } from './password-generator-button'
import { ROLE_LABELS, type Role } from '@/types/roles'
import { VALID_AREAS, AREA_LABELS, type Area } from '@/types/areas'
import type { StaffMember } from '@/lib/db/schema/staff-members'

interface UserFormClientProps {
  unlinkedStaff: StaffMember[]
  /** Rol del usuario que está creando: 'admin' (super) elige libre; 'admin_area' queda anclado a su área. */
  callerRole: Role
  /** Área del caller (null para super admin). */
  callerArea: Area | null
}

export function UserFormClient({ unlinkedStaff, callerRole, callerArea }: UserFormClientProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Super admin elige cualquier rol/área. Admin de área queda anclado
  // a roles admitidos por su scope (admin_area u operativo).
  const isCallerScoped = callerRole === 'admin_area'
  const allowedRoles = getAllowedRolesForCaller(callerRole, callerArea)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: (allowedRoles[0] ?? 'operativo') as Role,
      area: isCallerScoped ? callerArea : null,
      staffMemberId: null,
    },
  })

  const role = watch('role')
  const area = watch('area')
  const staffMemberId = watch('staffMemberId')

  const onSubmit = async (data: CreateUserInput) => {
    if (submitting) return // Guarda contra dobles clicks que escaparon al disabled.
    setSubmitError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        staffMemberId: data.role === 'admin' ? null : data.staffMemberId,
        area: data.role === 'admin' ? null : data.area,
      }
      await createUser(payload)
      router.push('/usuarios')
      router.refresh()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al crear el usuario')
      setSubmitting(false)
    }
    // En éxito NO reseteamos submitting: la navegación a /usuarios cierra la página.
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" {...register('fullName')} aria-invalid={!!errors.fullName} />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <div className="flex items-center gap-2">
            <Input
              id="password"
              type="text"
              autoComplete="new-password"
              {...register('password')}
              aria-invalid={!!errors.password}
              className="flex-1 min-w-0"
            />
            <PasswordGeneratorButton
              onGenerate={(p) => setValue('password', p, { shouldValidate: true })}
            />
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres. Comparte por canal seguro; el usuario debería cambiarla en su
            primer login.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Rol</Label>
          <Select
            value={role ?? ''}
            onValueChange={(v) => {
              setValue('role', v as Role, { shouldValidate: true })
              if (v === 'admin') {
                setValue('staffMemberId', null, { shouldValidate: true })
                setValue('area', null, { shouldValidate: true })
              }
            }}
          >
            <SelectTrigger id="role" aria-invalid={!!errors.role} className="w-full">
              <SelectValue placeholder="Seleccionar rol">
                {role ? ROLE_LABELS[role as Role] : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allowedRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
          <p className="text-xs text-muted-foreground">
            {isCallerScoped
              ? 'Como administrador de área puedes crear otros admins de tu área o dar credenciales a tu staff operativo.'
              : 'Administrador es super-admin global (cross-área). Los demás roles operan en un área específica.'}
          </p>
        </div>

        {role !== 'admin' && (
          <div className="space-y-1.5">
            <Label htmlFor="area">Área</Label>
            {isCallerScoped && callerArea ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                {AREA_LABELS[callerArea]} <span className="text-muted-foreground">(fija)</span>
              </div>
            ) : (
              <Select
                value={area ?? ''}
                onValueChange={(v) => setValue('area', v as Area, { shouldValidate: true })}
              >
                <SelectTrigger id="area" aria-invalid={!!errors.area} className="w-full">
                  <SelectValue placeholder="Seleccionar área">
                    {area ? AREA_LABELS[area as Area] : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VALID_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREA_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.area && (
              <p className="text-sm text-destructive">{errors.area.message}</p>
            )}
          </div>
        )}

        {role !== 'admin' && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="staffMemberId">Personal vinculado</Label>
            <Select
              value={staffMemberId ?? ''}
              onValueChange={(v) =>
                setValue('staffMemberId', v || null, { shouldValidate: true })
              }
            >
              <SelectTrigger
                id="staffMemberId"
                aria-invalid={!!errors.staffMemberId}
                className="w-full"
              >
                <SelectValue placeholder="Seleccionar colaborador sin acceso" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedStaff.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    No hay colaboradores sin credenciales. Crea un colaborador primero o asigna rol
                    admin.
                  </div>
                ) : (
                  unlinkedStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.lastName}, {s.firstName} — CC {s.cedula}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.staffMemberId && (
              <p className="text-sm text-destructive">{errors.staffMemberId.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Obligatorio para roles distintos de Administrador. El colaborador podrá ver sus
              turnos y campañas en Mi Agenda.
            </p>
          </div>
        )}
      </div>

      {submitError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear usuario'}
        </Button>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/usuarios" />}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
