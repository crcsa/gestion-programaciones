# Tests E2E (Playwright)

Cobertura de los 7 flujos descritos en §9 del documento de validación funcional.

## Requisitos

1. Instalar Playwright y navegadores:
   ```bash
   pnpm install
   pnpm exec playwright install --with-deps chromium
   ```

2. BD de E2E con datos de seed (puede ser una rama Supabase dedicada):
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

3. Crear usuarios de prueba en Supabase Auth (uno por rol):
   - admin@e2e.local, banco_sangre@e2e.local, comercial@e2e.local, operativo@e2e.local
   - Vincular cada uno con su perfil en `profiles` con el rol correspondiente.

4. Variables de entorno (`.env.test.local` o secretos de CI):
   ```
   E2E_BASE_URL=http://localhost:3000
   E2E_ADMIN_EMAIL=admin@e2e.local
   E2E_ADMIN_PASSWORD=...
   E2E_BANCO_SANGRE_EMAIL=banco_sangre@e2e.local
   E2E_BANCO_SANGRE_PASSWORD=...
   E2E_COMERCIAL_EMAIL=comercial@e2e.local
   E2E_COMERCIAL_PASSWORD=...
   E2E_OPERATIVO_EMAIL=operativo@e2e.local
   E2E_OPERATIVO_PASSWORD=...

   # Opcionales: UUIDs de campañas seed para tests específicos
   E2E_TENTATIVA_CAMPAIGN_ID=...
   E2E_CONFIRMADA_CAMPAIGN_ID=...
   E2E_TIMELINE_CAMPAIGN_ID=...
   ```

## Ejecutar

```bash
pnpm test:e2e          # headless
pnpm test:e2e:ui       # interfaz Playwright UI
```

## CI

El workflow `e2e` en `.github/workflows/deploy.yml` se activa cuando la variable
de repo `E2E_ENABLED` es `true`. Sube `playwright-report/` como artifact.

## Estructura

- `flows/01..07-*.spec.ts` — un archivo por flujo del documento
- `helpers/auth.ts` — login programático por rol
- `fixtures/seed-data.ts` — referencias y env vars requeridas
