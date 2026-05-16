#!/usr/bin/env bash
# Copia las env vars de Production a Preview (scope: un branch específico).
#
# Por qué un branch específico: el Vercel CLI detecta que somos un agente y
# rechaza --value/--yes en modo "todos los preview" como safety net (ver
# action_required: git_branch_required). Pasar el branch explícito funciona.
#
# Pre-requisito: .vercel/project.json existe (proyecto linkeado) y estás
# logueado en la cuenta institucional (`vercel whoami` lo confirma).
#
# Uso:
#   bash scripts/copy-prod-env-to-preview.sh <git-branch>
#   bash scripts/copy-prod-env-to-preview.sh fix/serverless-pool-and-sidebar-prefetch
#
# Lo que hace:
#   1. Pull de las vars de Production a /tmp/.env.from-prod
#   2. Para cada var listada, la agrega al Preview del branch indicado
#   3. No toca Production
set -euo pipefail

BRANCH="${1:-}"
if [[ -z "$BRANCH" ]]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
fi
if [[ -z "$BRANCH" || "$BRANCH" == "main" ]]; then
  echo "ERROR: especificá un git branch (no puede ser 'main' — es production):" >&2
  echo "  bash scripts/copy-prod-env-to-preview.sh <branch>" >&2
  exit 1
fi
echo "Branch destino: $BRANCH"

VARS=(
  DATABASE_URL
  DIRECT_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  CRON_SECRET
)

TMP_ENV=/tmp/.env.from-prod

echo "→ Pulling Production env vars to $TMP_ENV (no se imprime contenido)..."
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
  # Strip optional surrounding quotes
  value="${value%\"}"
  value="${value#\"}"

  echo "→ Subiendo $var a Preview ($BRANCH)..."
  if vercel env add "$var" preview "$BRANCH" --value "$value" --yes 2>&1 | tail -3; then
    echo "  ✓ $var procesado"
  else
    echo "  ✗ $var falló"
  fi
done

echo ""
echo "✓ Listo. Verifica con:"
echo "    vercel env ls preview"
echo ""
echo "  Si el PR está abierto, fuerza re-deploy del preview con un push trivial:"
echo "    git commit --allow-empty -m 'chore: trigger preview redeploy' && git push"
