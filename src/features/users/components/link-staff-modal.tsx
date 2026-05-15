'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { linkUserToStaff } from '../actions/user-actions'
import type { StaffMember } from '@/lib/db/schema/staff-members'

interface LinkStaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  email: string
  unlinkedStaff: StaffMember[]
}

export function LinkStaffModal({
  open,
  onOpenChange,
  profileId,
  email,
  unlinkedStaff,
}: LinkStaffModalProps) {
  const router = useRouter()
  const [staffMemberId, setStaffMemberId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!staffMemberId) {
      setError('Selecciona un colaborador')
      return
    }
    setBusy(true)
    try {
      await linkUserToStaff({ profileId, staffMemberId })
      onOpenChange(false)
      setStaffMemberId('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vincular')
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
          <DialogTitle>Vincular personal</DialogTitle>
          <DialogDescription>
            Asocia la cuenta {email} a un colaborador existente sin credenciales para que pueda
            ver sus turnos y campañas en Mi Agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="link-staff">Colaborador</Label>
          <Select value={staffMemberId} onValueChange={(v) => setStaffMemberId(v ?? '')}>
            <SelectTrigger id="link-staff" className="w-full">
              <SelectValue placeholder="Seleccionar colaborador sin acceso" />
            </SelectTrigger>
            <SelectContent>
              {unlinkedStaff.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No hay colaboradores sin credenciales disponibles.
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
          <Button onClick={handleSubmit} disabled={busy || !staffMemberId}>
            {busy ? 'Vinculando...' : 'Vincular'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
