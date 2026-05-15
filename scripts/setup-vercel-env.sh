#!/usr/bin/env bash
# Sube los env vars de producción al proyecto Vercel linked.
# Lee CRON_SECRET desde /tmp/cron-secret.txt (generado previamente) y los demás
# desde .env.local. No imprime ningún secreto en stdout.
#
# Uso:
#   bash scripts/setup-vercel-env.sh

set -euo pipefail

REQUIRED=(DATABASE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY)
ENV_FILE=".env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE no existe" >&2
  exit 1
fi

if [[ ! -f /tmp/cron-secret.txt ]]; then
  echo "Generando CRON_SECRET en /tmp/cron-secret.txt..."
  openssl rand -base64 32 | tr -d '\n' | tr '/+=' 'aZ_' > /tmp/cron-secret.txt
fi

upload() {
  local name="$1"
  local value="$2"
  echo "→ Subiendo $name a producción..."
  printf '%s' "$value" | vercel env add "$name" production
}

# Subir Supabase + DB desde .env.local
for var in "${REQUIRED[@]}"; do
  value=$(grep -E "^${var}=" "$ENV_FILE" | head -1 | cut -d= -f2-)
  if [[ -z "$value" ]]; then
    echo "WARNING: $var no encontrado en $ENV_FILE — saltando" >&2
    continue
  fi
  # Strip optional surrounding quotes
  value="${value%\"}"
  value="${value#\"}"
  upload "$var" "$value"
done

# Subir CRON_SECRET
upload CRON_SECRET "$(cat /tmp/cron-secret.txt)"

echo ""
echo "✓ Listo. Verifica con: vercel env ls production"
echo "  Luego despliega preview con: vercel deploy"
echo "  Y producción con:           vercel deploy --prod"
echo ""
echo "Borra el secret temporal con: rm /tmp/cron-secret.txt"
