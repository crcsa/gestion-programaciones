import { db } from '@/lib/db'
import { trainingAreas } from '@/lib/db/schema'

const TRAINING_AREAS = [
  { code: 'FLEBOTOMIA', name: 'Flebotomía', description: 'Extracción de sangre y manejo de donantes' },
  { code: 'PROCESAMIENTO', name: 'Procesamiento', description: 'Procesamiento de componentes sanguíneos' },
  { code: 'SEROLOGIA', name: 'Serología', description: 'Pruebas serológicas y tamizaje' },
  { code: 'INMUNOHEMATOLOGIA', name: 'Inmunohematología', description: 'Pruebas de compatibilidad y tipificación' },
  { code: 'CONTROL_CALIDAD', name: 'Control de Calidad', description: 'Control de calidad de componentes y procesos' },
  { code: 'ATENCION_DONANTE', name: 'Atención al Donante', description: 'Valoración y atención integral del donante' },
  { code: 'LOGISTICA', name: 'Logística', description: 'Transporte y cadena de frío' },
  { code: 'PROMOCION', name: 'Promoción', description: 'Promoción de la donación voluntaria' },
] as const

export async function seedTrainingAreas() {
  for (const area of TRAINING_AREAS) {
    await db
      .insert(trainingAreas)
      .values(area)
      .onConflictDoNothing({ target: trainingAreas.code })
  }

  const allAreas = await db.query.trainingAreas.findMany()
  console.log(`Training areas seeded: ${allAreas.length} total`)
}
