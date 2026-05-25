#!/usr/bin/env bash
# Copia las env vars de Production al scope Preview GLOBAL (todas las ramas,
# sin filtro de branch). Esto elimina el error recurrente "DATABASE_URL is not
# set" en cada feature branch nueva: una var Preview sin branch aplica a todas
# las ramas que no tengan un override específico.
#
# Pre-requisito: proyecto linkeado (.vercel/project.json) y logueado en la
# cuenta institucional (`vercel whoami`).
#
# Uso:
#   bash scripts/set-preview-env-global.sh
#
# Nota: el Vercel CLI puede rechazar el modo "todos los preview" en modo no
# interactivo (safety net). Si falla, corré este script vos mismo con el
# prefijo `!` en Claude Code, o agregá las vars desde el dashboard de Vercel.
set -euo pipefail

VARS=(
  DATABASE_URL
  DIRECT_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  CRON_SECRET
)

TMP_ENV=/tmp/.env.from-prod-global

echo "→ Pulling Production env vars (no se imprime contenido)..."
vercel env pull "$TMP_ENV" --environment=production --yes >/dev/null

if [[ ! -s "$TMP_ENV" ]]; then
  echo "ERROR: $TMP_ENV está vacío. ¿Estás logueado en la cuenta correcta?" >&2
  echo "       Verifica con: vercel whoami" >&2
  exit 1
fi

trap 'rm -f "$TMP_ENV"' EXIT

for var in "${VARS[@]}"; do
  value=$(grep -E "^${var}=" "$TMP_ENV" | head -1 | cut -d= -f2-)
  if [[ -z "$value" ]]; then
    echo "  · $var: no existe en Production, saltando"
    continue
  fi
  value="${value%\"}"
  value="${value#\"}"

  echo "→ Subiendo $var a Preview (global, todas las ramas)..."
  # Sin branch + --value + --yes = "todas las preview branches" (no interactivo).
  if vercel env add "$var" preview --value "$value" --yes 2>&1 | tail -3; then
    echo "  ✓ $var procesado"
  else
    echo "  ✗ $var falló"
  fi
done

echo ""
echo "✓ Listo. Verifica con: vercel env ls preview"
