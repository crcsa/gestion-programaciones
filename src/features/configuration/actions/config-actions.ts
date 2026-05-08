'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { systemConfig } from '@/lib/db/schema/system-config'
import { requireRole } from '@/features/auth/lib/require-role'
import { logAudit } from '@/lib/audit/log-audit'
import { CONFIG_PARAMETERS } from '../lib/config-keys'
import { invalidateRuntimeConfigCache } from '../lib/runtime-config'
import {
  updateConfigSchema,
  validateConfigValue,
  type UpdateConfigInput,
} from '../schemas/config-schemas'

export interface ConfigItem {
  key: string
  value: string
  defaultValue: string
  label: string
  description: string
  type: 'integer' | 'time' | 'text'
  min?: number
  max?: number
  isEditable: boolean
  updatedAt: Date | null
}

export async function getConfigItems(): Promise<ConfigItem[]> {
  await requireRole(['admin'])

  const rows = await db
    .select({
      key: systemConfig.key,
      value: systemConfig.value,
      isEditable: systemConfig.isEditable,
      updatedAt: systemConfig.updatedAt,
    })
    .from(systemConfig)

  const byKey = new Map(rows.map((r) => [r.key, r]))

  return CONFIG_PARAMETERS.map((def) => {
    const row = byKey.get(def.key)
    return {
      key: def.key,
      value: row?.value ?? def.defaultValue,
      defaultValue: def.defaultValue,
      label: def.label,
      description: def.description,
      type: def.type,
      min: def.min,
      max: def.max,
      isEditable: row?.isEditable ?? true,
      updatedAt: row?.updatedAt ?? null,
    }
  })
}

export async function updateConfig(input: UpdateConfigInput): Promise<{ updated: number }> {
  const { userId } = await requireRole(['admin'])

  const parsed = updateConfigSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const validated = parsed.data.entries.map((e) => ({
    key: e.key,
    value: validateConfigValue(e.key, e.value),
  }))

  const existing = await db
    .select({ key: systemConfig.key, value: systemConfig.value, id: systemConfig.id })
    .from(systemConfig)
  const existingByKey = new Map(existing.map((r) => [r.key, r]))

  let updated = 0
  for (const entry of validated) {
    const prev = existingByKey.get(entry.key)
    if (prev) {
      if (prev.value === entry.value) continue
      await db
        .update(systemConfig)
        .set({ value: entry.value, updatedAt: new Date() })
        .where(eq(systemConfig.id, prev.id))
      await logAudit({
        profileId: userId,
        action: 'update',
        tableName: 'system_config',
        recordId: prev.id,
        oldData: { key: entry.key, value: prev.value },
        newData: { key: entry.key, value: entry.value },
      })
    } else {
      const [created] = await db
        .insert(systemConfig)
        .values({ key: entry.key, value: entry.value })
        .returning({ id: systemConfig.id })
      if (created) {
        await logAudit({
          profileId: userId,
          action: 'create',
          tableName: 'system_config',
          recordId: created.id,
          newData: { key: entry.key, value: entry.value },
        })
      }
    }
    updated += 1
  }

  if (updated > 0) {
    invalidateRuntimeConfigCache()
    revalidatePath('/configuracion')
  }

  return { updated }
}
