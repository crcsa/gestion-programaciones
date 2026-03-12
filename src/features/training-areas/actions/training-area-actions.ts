'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { trainingAreas } from '@/lib/db/schema'
import type { ActionResult } from '@/types/api'
import { z } from 'zod'

const createTrainingAreaSchema = z.object({
  code: z
    .string()
    .min(2, { error: 'Código debe tener al menos 2 caracteres' })
    .max(20)
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .min(2, { error: 'Nombre debe tener al menos 2 caracteres' })
    .max(100),
  description: z.string().max(500).optional(),
})

const updateTrainingAreaSchema = createTrainingAreaSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
})

type TrainingArea = typeof trainingAreas.$inferSelect

export async function getTrainingAreas(): Promise<ActionResult<TrainingArea[]>> {
  try {
    const areas = await db.query.trainingAreas.findMany({
      orderBy: (table, { asc }) => asc(table.name),
    })
    return { success: true, data: areas }
  } catch (error) {
    console.error('Failed to fetch training areas:', error)
    return { success: false, error: 'Error al obtener áreas de formación' }
  }
}

export async function getActiveTrainingAreas(): Promise<ActionResult<TrainingArea[]>> {
  try {
    const areas = await db.query.trainingAreas.findMany({
      where: (table, { eq }) => eq(table.isActive, true),
      orderBy: (table, { asc }) => asc(table.name),
    })
    return { success: true, data: areas }
  } catch (error) {
    console.error('Failed to fetch active training areas:', error)
    return { success: false, error: 'Error al obtener áreas de formación activas' }
  }
}

export async function createTrainingArea(
  input: z.infer<typeof createTrainingAreaSchema>,
): Promise<ActionResult<TrainingArea>> {
  const parsed = createTrainingAreaSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  try {
    const existing = await db.query.trainingAreas.findFirst({
      where: (table, { eq }) => eq(table.code, parsed.data.code),
    })

    if (existing) {
      return { success: false, error: 'Ya existe un área con ese código' }
    }

    const [created] = await db
      .insert(trainingAreas)
      .values(parsed.data)
      .returning()

    return { success: true, data: created }
  } catch (error) {
    console.error('Failed to create training area:', error)
    return { success: false, error: 'Error al crear área de formación' }
  }
}

export async function updateTrainingArea(
  input: z.infer<typeof updateTrainingAreaSchema>,
): Promise<ActionResult<TrainingArea>> {
  const parsed = updateTrainingAreaSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { id, ...data } = parsed.data

  try {
    const existing = await db.query.trainingAreas.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    })

    if (!existing) {
      return { success: false, error: 'Área de formación no encontrada' }
    }

    const [updated] = await db
      .update(trainingAreas)
      .set(data)
      .where(eq(trainingAreas.id, id))
      .returning()

    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to update training area:', error)
    return { success: false, error: 'Error al actualizar área de formación' }
  }
}
