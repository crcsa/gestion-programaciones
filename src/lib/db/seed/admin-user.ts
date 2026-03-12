import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

const ADMIN_EMAIL = 'admin@crcsa.org.co'

export async function seedAdminUser() {
  const existing = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.email, ADMIN_EMAIL),
  })

  if (existing) {
    console.log('Admin user already exists, skipping.')
    return
  }

  const { createHash } = await import('crypto')
  const hash = createHash('sha256').update('CruzRoja2026!').digest('hex')

  await db.insert(users).values({
    email: ADMIN_EMAIL,
    name: 'Administrador CRCSA',
    hashedPassword: hash,
    role: 'admin',
    isActive: true,
  })

  console.log('Admin user created:', ADMIN_EMAIL)
}
