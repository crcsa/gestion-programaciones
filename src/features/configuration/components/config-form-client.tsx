'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateConfig, type ConfigItem } from '../actions/config-actions'

interface ConfigFormClientProps {
  initialItems: ConfigItem[]
}

export function ConfigFormClient({ initialItems }: ConfigFormClientProps) {
  const [items, setItems] = useState<ConfigItem[]>(initialItems)
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(initialItems.map((i) => [i.key, i.value])),
  )
  const [pending, startTransition] = useTransition()

  const dirtyKeys = items
    .filter((i) => draft[i.key] !== i.value)
    .map((i) => i.key)

  function handleChange(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleReset(key: string) {
    const def = items.find((i) => i.key === key)
    if (def) setDraft((prev) => ({ ...prev, [key]: def.defaultValue }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (dirtyKeys.length === 0) {
      toast.info('No hay cambios para guardar')
      return
    }
    const entries = dirtyKeys.map((key) => ({ key, value: draft[key] }))

    startTransition(async () => {
      try {
        const result = await updateConfig({ entries })
        toast.success(`Se actualizaron ${result.updated} parametro(s)`)
        setItems((prev) =>
          prev.map((i) =>
            dirtyKeys.includes(i.key)
              ? { ...i, value: draft[i.key], updatedAt: new Date() }
              : i,
          ),
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Parametros laborales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.map((item) => {
            const isDirty = draft[item.key] !== item.value
            return (
              <div key={item.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
                <div className="space-y-0.5">
                  <Label htmlFor={`cfg-${item.key}`} className="text-sm font-medium">
                    {item.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  {item.updatedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Ultima actualizacion: {new Date(item.updatedAt).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Input
                    id={`cfg-${item.key}`}
                    type={item.type === 'integer' ? 'number' : item.type === 'time' ? 'time' : 'text'}
                    value={draft[item.key] ?? ''}
                    min={item.min}
                    max={item.max}
                    onChange={(e) => handleChange(item.key, e.target.value)}
                    disabled={!item.isEditable || pending}
                    aria-invalid={isDirty ? false : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || draft[item.key] === item.defaultValue}
                    onClick={() => handleReset(item.key)}
                    title={`Restablecer al valor por defecto (${item.defaultValue})`}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <p className="text-sm text-muted-foreground">
          {dirtyKeys.length > 0 ? `${dirtyKeys.length} cambio(s) sin guardar` : 'Sin cambios'}
        </p>
        <Button type="submit" disabled={pending || dirtyKeys.length === 0}>
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
