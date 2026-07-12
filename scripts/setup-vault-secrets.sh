#!/usr/bin/env bash
# setup-vault-secrets.sh — Register RSVP webhook URL and secret in Supabase Vault
#
# Reads SITE_URL and RSVP_WEBHOOK_SECRET from .env, then either:
#   • Runs the SQL directly via the Supabase CLI (if available and linked), or
#   • Prints a pre-filled snippet you can paste into the Supabase SQL Editor.
#
# Usage:
#   bash scripts/setup-vault-secrets.sh

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"

# ── Load .env ──────────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE" >&2
  echo "Copy .env.example to .env and fill in your values first." >&2
  exit 1
fi

SITE_URL=""
RSVP_WEBHOOK_SECRET=""

while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  # Strip surrounding quotes if present
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  case "$key" in
    SITE_URL)            SITE_URL="$value" ;;
    RSVP_WEBHOOK_SECRET) RSVP_WEBHOOK_SECRET="$value" ;;
  esac
done < "$ENV_FILE"

# ── Validate ───────────────────────────────────────────────────────────────────
if [[ -z "$SITE_URL" ]]; then
  echo "Error: SITE_URL is not set in .env" >&2
  echo "Add: SITE_URL=https://your-app.vercel.app" >&2
  exit 1
fi
if [[ -z "$RSVP_WEBHOOK_SECRET" ]]; then
  echo "Error: RSVP_WEBHOOK_SECRET is not set in .env" >&2
  echo "Add a random secret, e.g.: RSVP_WEBHOOK_SECRET=$(openssl rand -hex 32)" >&2
  exit 1
fi

# Strip trailing slash from SITE_URL
SITE_URL="${SITE_URL%/}"
WEBHOOK_URL="${SITE_URL}/api/send-rsvp-email"

SQL=$(cat <<SQL
select vault.create_secret(
  '${WEBHOOK_URL}',
  'rsvp_email_webhook_url'
);

select vault.create_secret(
  '${RSVP_WEBHOOK_SECRET}',
  'rsvp_email_webhook_secret'
);
SQL
)

echo ""
echo "Webhook URL : $WEBHOOK_URL"
echo "Secret      : (hidden — read from .env RSVP_WEBHOOK_SECRET)"
echo ""

# ── Try Supabase CLI ───────────────────────────────────────────────────────────
if command -v supabase &>/dev/null; then
  echo "Supabase CLI detected. Attempting to run SQL against linked project..."
  echo ""
  if supabase db execute --sql "$SQL" 2>/dev/null; then
    echo ""
    echo "Done. Both Vault secrets registered."
    echo "The RSVP webhook trigger is now active."
    exit 0
  else
    echo "CLI execute failed (project may not be linked or CLI not authenticated)."
    echo "Falling back to manual instructions."
    echo ""
  fi
fi

# ── Manual fallback ────────────────────────────────────────────────────────────
echo "Run the following SQL in the Supabase SQL Editor"
echo "(supabase.com → your project → SQL Editor):"
echo ""
echo "────────────────────────────────────────────────────"
echo "$SQL"
echo "────────────────────────────────────────────────────"
echo ""
echo "After running, the RSVP webhook trigger will be active."
echo "Guests can RSVP normally before this step — emails just won't send yet."
