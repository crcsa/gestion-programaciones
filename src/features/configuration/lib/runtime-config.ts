import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { systemConfig } from '@/lib/db/schema/system-config'
import { systemConfigHistory } from '@/lib/db/schema/system-config-history'
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
  /**
   * Umbral (negativo o cero) del saldo mensual del banco de horas a partir
   * del cual se emite una alerta de déficit. Ej. -8 → alerta si saldo <= -8h.
   */
  hourBankDeficitThreshold: number
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
    hourBankDeficitThreshold: Number(get(CONFIG_KEYS.HOUR_BANK_DEFICIT_THRESHOLD)),
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
      hourBankDeficitThreshold: numeric(
        CONFIG_KEYS.HOUR_BANK_DEFICIT_THRESHOLD,
        fallback.hourBankDeficitThreshold,
      ),
    }

    cache = { value, expires: now + TTL_MS }
    return value
  } catch (err) {
    // Crítico: el motor de validación se cae a defaults compile-time.
    // Las reglas vigentes pueden estar desactualizadas y dejar pasar
    // asignaciones que deberían bloquearse. Log estructurado para que
    // monitoring lo capture.
    logRuntimeConfigFailure('loadValidationRuntimeConfig', err)
    return fallback
  }
}

function logRuntimeConfigFailure(action: string, err: unknown): void {
  const error =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { name: 'UnknownError', message: String(err) }
  console.error(
    JSON.stringify({
      errorId: 'RUNTIME_CONFIG_FALLBACK',
      action,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      reason: 'DB unavailable, validation engine falling back to compile-time defaults',
      error,
    }),
  )
}

export function invalidateRuntimeConfigCache(): void {
  cache = null
  historicalCache.clear()
}

// ---- Historical config ----------------------------------------------------

const historicalCache = new Map<string, { value: ValidationRuntimeConfig; expires: number }>()

function toRefDate(refDate: Date | string): Date {
  if (refDate instanceof Date) return refDate
  // Date-only ISO string ("YYYY-MM-DD") → end of that day to capture
  // changes that took effect any time during the date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(refDate)) {
    return new Date(`${refDate}T23:59:59.999Z`)
  }
  return new Date(refDate)
}

/**
 * Returns the validation config that was active at the given moment in time.
 * Used for historical recalculations so past programmings keep their original
 * rules. For the live "current" config, use `loadValidationRuntimeConfig()`.
 *
 * Falls back to the live config (and ultimately compile-time defaults) when no
 * history row exists for a key — covers the period before this table existed.
 */
export async function loadValidationRuntimeConfigAt(
  refDate: Date | string,
): Promise<ValidationRuntimeConfig> {
  const at = toRefDate(refDate)
  const atIso = at.toISOString()
  const cacheKey = atIso
  const now = Date.now()
  const cached = historicalCache.get(cacheKey)
  if (cached && cached.expires > now) return cached.value

  const fallback = await loadValidationRuntimeConfig()

  try {
    const rows = await db
      .select({
        key: systemConfigHistory.key,
        value: systemConfigHistory.value,
      })
      .from(systemConfigHistory)
      // postgres-js binds raw Date via `.toString()` dentro de templates `sql`,
      // lo cual rompe el parser de Postgres ("Mon May 18 2026..."). Forzamos
      // ISO 8601 con cast explícito a `timestamptz` para que sea inequívoco.
      .where(sql`${systemConfigHistory.effectiveFrom} <= ${atIso}::timestamptz`)
      .orderBy(sql`${systemConfigHistory.key}, ${systemConfigHistory.effectiveFrom} DESC`)

    // Pick the most-recent row per key (rows ordered by key, then DESC by effective_from).
    const byKey = new Map<string, string>()
    for (const r of rows) {
      if (!byKey.has(r.key)) byKey.set(r.key, r.value)
    }

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
      hourBankDeficitThreshold: numeric(
        CONFIG_KEYS.HOUR_BANK_DEFICIT_THRESHOLD,
        fallback.hourBankDeficitThreshold,
      ),
    }

    historicalCache.set(cacheKey, { value, expires: now + TTL_MS })
    return value
  } catch (err) {
    logRuntimeConfigFailure('loadValidationRuntimeConfigAt', err)
    return fallback
  }
}
