import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

/**
 * Cliente postgres-js como singleton via `globalThis`.
 *
 * REQUISITO CRÍTICO: `DATABASE_URL` debe apuntar al SESSION pooler de Supabase
 * (puerto 5432 del host `*.pooler.supabase.com`), NO al transaction pooler
 * (6543). El app es un server persistente que dispara queries concurrentes
 * (layout + page + topbar renderizan en paralelo); postgres-js contra el
 * transaction pooler de Supavisor desincroniza el protocolo bajo concurrencia
 * y una de las queries del batch queda colgada para siempre
 * (`state=active`/`ClientRead` en `pg_stat_activity`). Síntoma: login pegado en
 * "Ingresando..." y dashboard que no carga. El session pooler asigna un backend
 * dedicado por conexión — sin multiplexing por transacción, sin esa carrera.
 *
 * El singleton via `globalThis` evita además que el HMR de Next 16 acumule
 * pools sin cerrar en dev.
 *
 * Config del pool:
 * - `max: 5` — suficiente para el server dev y deja margen en el plan de
 *   Supabase.
 * - `idle_timeout: 20` — devuelve conexiones inactivas tras 20s.
 * - `max_lifetime: 60 * 30` — recicla conexiones cada 30 min.
 * - `connect_timeout: 10` — falla rápido si el handshake tarda más de 10s.
 * - `keep_alive: 30` — TCP keepalive: detecta sockets half-open.
 * - `prepare: false` — inofensivo en session mode; lo dejamos por si se vuelve
 *   a un pooler en transaction mode.
 * - `connection.statement_timeout` — defensa en profundidad: Postgres aborta
 *   cualquier query que pase de 20s en vez de colgar el render. En session mode
 *   estos parámetros de arranque SÍ se aplican (el transaction pooler los
 *   ignoraba).
 * - `connection.idle_in_transaction_session_timeout` — cierra transacciones que
 *   queden idle.
 */
type GlobalWithDb = typeof globalThis & {
  __postgresClient?: ReturnType<typeof postgres>
}
const g = globalThis as GlobalWithDb

const client =
  g.__postgresClient ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    keep_alive: 30,
    connection: {
      statement_timeout: 20_000,
      idle_in_transaction_session_timeout: 30_000,
      application_name: 'gestion-programaciones',
    },
  })

if (process.env.NODE_ENV !== 'production') {
  g.__postgresClient = client
}

export const db = drizzle(client, { schema })
