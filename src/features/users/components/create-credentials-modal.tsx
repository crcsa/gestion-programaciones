'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUser } from '../actions/user-actions'
import { getAllowedRolesForCaller } from '../lib/allowed-roles'
import { PasswordGeneratorButton } from './password-generator-button'
import { ROLE_LABELS, type Role } from '@/types/roles'
import type { Area } from '@/types/areas'
import type { StaffMember } from '@/lib/db/schema/staff-members'

interface CreateCredentialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffMember: StaffMember
  callerRole: Role
  callerArea: Area | null
}

export function CreateCredentialsModal({
  open,
  onOpenChange,
  staffMember,
  callerRole,
  callerArea,
}: CreateCredentialsModalProps) {
  const router = useRouter()
  const allowedRoles = getAllowedRolesForCaller(callerRole, callerArea)
  // Para credenciales a staff existente el default razonable es 'operativo';
  // si no está permitido (caller no-admin sin operativo), caemos al primero.
  const defaultRole: Role = allowedRoles.includes('operativo')
    ? 'operativo'
    : (allowedRoles[0] ?? 'operativo')
  const [email, setEmail] = useState(staffMember.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(defaultRole)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    if (busy) return
    setError(null)
    if (!email || password.length < 8) {
      setError('Correo válido y contraseña de al menos 8 caracteres son obligatorios')
      return
    }
    setBusy(true)
    try {
      await createUser({
        email,
        password,
        fullName: `${staffMember.firstName} ${staffMember.lastName}`,
        role,
        // El área del usuario se deriva del staff vinculado: si el rol no es
        // admin global, el área es la misma que la del colaborador físico.
        area: role === 'admin' ? null : staffMember.area,
        staffMemberId: role === 'admin' ? null : staffMember.id,
      })
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear credenciales')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle>Crear credenciales</DialogTitle>
          <DialogDescription>
            Generar acceso para {staffMember.firstName} {staffMember.lastName} (CC {staffMember.cedula}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cred-email">Correo electrónico</Label>
            <Input
              id="cred-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-password">Contraseña</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cred-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="flex-1 min-w-0"
              />
              <PasswordGeneratorButton onGenerate={setPassword} />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres. Comparte por canal seguro.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="cred-role" className="w-full">
                <SelectValue placeholder="Seleccionar rol">{ROLE_LABELS[role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role === 'admin' && (
              <p className="text-xs text-muted-foreground">
                Con rol admin, este usuario quedará sin vínculo a un colaborador.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? 'Creando...' : 'Crear credenciales'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
