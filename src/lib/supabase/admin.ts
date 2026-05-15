import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente admin de Supabase con `SUPABASE_SERVICE_ROLE_KEY`. SOLO server-side.
 *
 * Memoización por proceso: el cliente se cachea en una variable de módulo.
 *
 * Supuestos:
 * - Entorno serverless (Vercel Functions): cada invocación tiene su propio
 *   módulo cargado; el singleton vive lo que dure la warm instance y se
 *   recrea en cada cold start.
 * - Dev local con HMR: el módulo puede recargarse pero la conexión sigue
 *   siendo válida (Supabase es stateless por request).
 *
 * NO usar en client components — el service role key nunca debe llegar al
 * bundle del navegador. Verificable porque este archivo no tiene 'use client'
 * y `process.env.SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo `NEXT_PUBLIC_`.
 */
let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Variables de entorno de Supabase no configuradas: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas'
    )
  }

  _client = createClient(url, serviceKey)
  return _client
}
