'use client'

import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { generateSecurePassword } from '@/lib/security/password'

interface Props {
  onGenerate: (password: string) => void
  className?: string
}

export function PasswordGeneratorButton({ onGenerate, className }: Props) {
  async function handleClick() {
    const pwd = generateSecurePassword()
    onGenerate(pwd)
    try {
      await navigator.clipboard.writeText(pwd)
      toast.success('Contraseña copiada al portapapeles')
    } catch {
      toast.info('Contraseña generada (copia manualmente desde el campo)')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={`gap-1 ${className ?? ''}`}
      title="Generar contraseña segura y copiar al portapapeles"
    >
      <Sparkles className="size-3.5" />
      Generar
    </Button>
  )
}
