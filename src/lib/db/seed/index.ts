import { seedTrainingAreas } from './training-areas'
import { seedSystemConfig } from './system-config'
import { seedColombianHolidays2026 } from './colombian-holidays-2026'

async function main() {
  try {
    await seedTrainingAreas()
    await seedSystemConfig()
    await seedColombianHolidays2026()
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Seed failed: ${message}`)
  }
}

main()
