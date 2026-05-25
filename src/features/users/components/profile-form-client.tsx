'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { updateMyProfile, changeMyPassword } from '@/features/users/actions/profile-actions'
import {
  updateMyProfileSchema,
  changeMyPasswordSchema,
  type UpdateMyProfileInput,
  type ChangeMyPasswordInput,
} from '@/features/users/schemas/profile-schemas'
import { ROLE_LABELS, type Role } from '@/types/roles'
import { AREA_LABELS, type Area } from '@/types/areas'

interface ProfileFormClientProps {
  fullName: string
  email: string
  role: Role
  area: Area | null
}

export function ProfileFormClient({ fullName, email, role, area }: ProfileFormClientProps) {
  const router = useRouter()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const profileForm = useForm<UpdateMyProfileInput>({
    resolver: zodResolver(updateMyProfileSchema),
    defaultValues: { fullName, email },
  })

  const passwordForm = useForm<ChangeMyPasswordInput>({
    resolver: zodResolver(changeMyPasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSaveProfile = async (data: UpdateMyProfileInput) => {
    setSavingProfile(true)
    try {
      await updateMyProfile(data)
      toast.success('Perfil actualizado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async (data: ChangeMyPasswordInput) => {
    setSavingPassword(true)
    try {
      await changeMyPassword(data)
      toast.success('Contraseña actualizada')
      passwordForm.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Datos personales */}
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Tu nombre y correo de acceso.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" {...profileForm.register('fullName')} aria-invalid={!!profileForm.formState.errors.fullName} />
              {profileForm.formState.errors.fullName && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" {...profileForm.register('email')} aria-invalid={!!profileForm.formState.errors.email} />
              {profileForm.formState.errors.email && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rol:</span>
              <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
              <span className="ml-2 text-muted-foreground">Área:</span>
              <Badge variant="outline">{area ? AREA_LABELS[area] : 'Global'}</Badge>
              <span className="text-xs text-muted-foreground">(las gestiona un administrador)</span>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Contraseña */}
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>Ingresa tu contraseña actual y la nueva (mín. 8 caracteres, con letra y número).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} aria-invalid={!!passwordForm.formState.errors.currentPassword} />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} aria-invalid={!!passwordForm.formState.errors.newPassword} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} aria-invalid={!!passwordForm.formState.errors.confirmPassword} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
