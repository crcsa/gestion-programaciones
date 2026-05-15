import { z } from 'zod'
import { CONFIG_KEYS, CONFIG_PARAMETERS } from '../lib/config-keys'

const ALL_KEYS = Object.values(CONFIG_KEYS) as [string, ...string[]]

export const configEntrySchema = z.object({
  key: z.enum(ALL_KEYS, { error: 'Clave de configuracion no valida' }),
  value: z.string().min(1, 'El valor no puede estar vacio'),
})

export const updateConfigSchema = z.object({
  entries: z.array(configEntrySchema).min(1, 'Debe enviar al menos una entrada'),
})

export type ConfigEntry = z.infer<typeof configEntrySchema>
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>

export function validateConfigValue(key: string, raw: string): string {
  const def = CONFIG_PARAMETERS.find((p) => p.key === key)
  if (!def) throw new Error(`Clave desconocida: ${key}`)

  const trimmed = raw.trim()

  if (def.type === 'integer') {
    const n = Number(trimmed)
    if (!Number.isInteger(n)) throw new Error(`${def.label}: debe ser un entero`)
    if (def.min != null && n < def.min) throw new Error(`${def.label}: minimo ${def.min}`)
    if (def.max != null && n > def.max) throw new Error(`${def.label}: maximo ${def.max}`)
    return String(n)
  }

  if (def.type === 'time') {
    if (!/^\d{2}:\d{2}$/.test(trimmed)) throw new Error(`${def.label}: formato HH:MM`)
    const [h, m] = trimmed.split(':').map(Number)
    if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error(`${def.label}: hora invalida`)
    return trimmed
  }

  if (def.type === 'text') {
    if (trimmed.length < 2) throw new Error(`${def.label}: minimo 2 caracteres`)
    return trimmed
  }

  return trimmed
}
