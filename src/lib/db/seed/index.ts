import { seedAdminUser } from './admin-user'
import { seedTrainingAreas } from './training-areas'
import { seedSystemConfig } from './system-config'
import { seedHolidays2026 } from './holidays-2026'

async function main() {
  console.log('Starting database seed...\n')

  try {
    await seedAdminUser()
    await seedTrainingAreas()
    await seedSystemConfig()
    await seedHolidays2026()

    console.log('\nSeed completed successfully.')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
