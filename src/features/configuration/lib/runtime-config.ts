import { db } from '@/lib/db'
import { systemConfig } from '@/lib/db/schema/system-config'
import { CONFIG_KEYS, CONFIG_PARAMETERS } from './config-keys'

export interface ValidationRuntimeConfig {
  weeklyHours: number
  maxExtraHoursWeek: number
  maxShiftHours: number
  minRestHours: number
  maxSundaysMonth: number
  maxOvernightsMonth: number
  municipalCutoffTime: string
  sedeMunicipality: string
}

const TTL_MS = 60_000

let cache: { value: ValidationRuntimeConfig; expires: number } | null = null

function defaults(): ValidationRuntimeConfig {
  const get = (key: string) =>
    CONFIG_PARAMETERS.find((p) => p.key === key)?.defaultValue ?? ''
  return {
    weeklyHours: Number(get(CONFIG_KEYS.WEEKLY_HOURS)),
    maxExtraHoursWeek: Number(get(CONFIG_KEYS.MAX_EXTRA_HOURS_WEEK)),
    maxShiftHours: Number(get(CONFIG_KEYS.MAX_SHIFT_HOURS)),
    minRestHours: Number(get(CONFIG_KEYS.MIN_REST_HOURS)),
    maxSundaysMonth: Number(get(CONFIG_KEYS.MAX_SUNDAYS_MONTH)),
    maxOvernightsMonth: Number(get(CONFIG_KEYS.MAX_OVERNIGHTS_MONTH)),
    municipalCutoffTime: get(CONFIG_KEYS.MUNICIPAL_CUTOFF_TIME),
    sedeMunicipality: get(CONFIG_KEYS.SEDE_MUNICIPALITY),
  }
}

/**
 * Reads the live validation rules from system_config with a 60s in-process cache.
 * Falls back to compile-time defaults if a row is missing or DB is unreachable.
 */
export async function loadValidationRuntimeConfig(): Promise<ValidationRuntimeConfig> {
  const now = Date.now()
  if (cache && cache.expires > now) return cache.value

  const fallback = defaults()
  try {
    const rows = await db.select({
      key: systemConfig.key,
      value: systemConfig.value,
    }).from(systemConfig)

    const byKey = new Map(rows.map((r) => [r.key, r.value]))
    const numeric = (key: string, fb: number): number => {
      const raw = byKey.get(key)
      const n = Number(raw)
      return Number.isFinite(n) ? n : fb
    }

    const value: ValidationRuntimeConfig = {
      weeklyHours: numeric(CONFIG_KEYS.WEEKLY_HOURS, fallback.weeklyHours),
      maxExtraHoursWeek: numeric(CONFIG_KEYS.MAX_EXTRA_HOURS_WEEK, fallback.maxExtraHoursWeek),
      maxShiftHours: numeric(CONFIG_KEYS.MAX_SHIFT_HOURS, fallback.maxShiftHours),
      minRestHours: numeric(CONFIG_KEYS.MIN_REST_HOURS, fallback.minRestHours),
      maxSundaysMonth: numeric(CONFIG_KEYS.MAX_SUNDAYS_MONTH, fallback.maxSundaysMonth),
      maxOvernightsMonth: numeric(CONFIG_KEYS.MAX_OVERNIGHTS_MONTH, fallback.maxOvernightsMonth),
      municipalCutoffTime: byKey.get(CONFIG_KEYS.MUNICIPAL_CUTOFF_TIME) ?? fallback.municipalCutoffTime,
      sedeMunicipality: byKey.get(CONFIG_KEYS.SEDE_MUNICIPALITY) ?? fallback.sedeMunicipality,
    }

    cache = { value, expires: now + TTL_MS }
    return value
  } catch {
    return fallback
  }
}

export function invalidateRuntimeConfigCache(): void {
  cache = null
}
