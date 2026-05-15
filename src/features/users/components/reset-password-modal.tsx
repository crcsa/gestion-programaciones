'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
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
import { resetUserPassword } from '../actions/user-actions'
import { PasswordGeneratorButton } from './password-generator-button'

interface ResetPasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  email: string
}

type Step =
  | { kind: 'form' }
  | { kind: 'success'; password: string }

export function ResetPasswordModal({
  open,
  onOpenChange,
  profileId,
  email,
}: ResetPasswordModalProps) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [revealed, setRevealed] = useState(true)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'both' | null>(null)

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset al cerrar para que la próxima apertura empiece limpia.
      setStep({ kind: 'form' })
      setNewPassword('')
      setError(null)
      setRevealed(true)
      setCopiedField(null)
      // Importante: refresh sólo cuando el flujo terminó (success ya fue
      // mostrado). Si el admin cancela sin guardar, no recargamos.
      if (step.kind === 'success') {
        router.refresh()
      }
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    setError(null)
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setBusy(true)
    try {
      await resetUserPassword({ profileId, newPassword })
      setStep({ kind: 'success', password: newPassword })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  async function copyTo(value: string, field: 'email' | 'password' | 'both') {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Ignorar errores de portapapeles (permisos en HTTP, etc.) — el admin
      // puede copiar manualmente del campo visible.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle>
            {step.kind === 'form' ? 'Cambiar contraseña' : 'Credenciales generadas'}
          </DialogTitle>
          <DialogDescription>Cuenta: {email}</DialogDescription>
        </DialogHeader>

        {step.kind === 'form' ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="flex-1 min-w-0"
                />
                <PasswordGeneratorButton onGenerate={setNewPassword} />
              </div>
              <p className="text-xs text-muted-foreground">
                Por seguridad, las contraseñas no se almacenan en texto plano. Esta
                pantalla genera una nueva y la muestra UNA sola vez para que la
                compartas por canal seguro con el usuario.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={busy}>
                {busy ? 'Guardando...' : 'Generar contraseña'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                <p className="font-medium text-amber-100">⚠ Guarda estas credenciales ahora.</p>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Esta contraseña no se podrá volver a mostrar — está cifrada en la
                  base de datos. Si la pierdes, deberás generar una nueva.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <div className="flex items-center gap-2">
                  <Input value={email} readOnly className="flex-1 min-w-0 font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyTo(email, 'email')}
                    aria-label="Copiar correo"
                    title="Copiar correo"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={revealed ? 'text' : 'password'}
                    value={step.password}
                    readOnly
                    className="flex-1 min-w-0 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealed((v) => !v)}
                    aria-label={revealed ? 'Ocultar' : 'Mostrar'}
                    title={revealed ? 'Ocultar' : 'Mostrar'}
                  >
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyTo(step.password, 'password')}
                    aria-label="Copiar contraseña"
                    title="Copiar contraseña"
                  >
                    {copiedField === 'password' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usa los botones de cada campo: copian SOLO ese valor (sin etiquetas
                  ni saltos de línea) para pegarlos directamente en el login.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  copyTo(`Correo: ${email}\nContraseña: ${step.password}`, 'both')
                }
                title="Copia ambos como bloque para chat/email"
              >
                {copiedField === 'both' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Bloque copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar bloque
                  </>
                )}
              </Button>
              <Button onClick={() => handleClose(false)}>Listo</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
