#!/usr/bin/env bash
# setup-vercel-env.sh
#
# Pushes server-only env vars from a local .env file to your Vercel project.
# Reads EMAIL_PROVIDER and only pushes the relevant email provider vars.
# Safe to re-run — existing vars are overwritten.
#
# Usage:
#   bash scripts/setup-vercel-env.sh             # push to production + preview + development
#   bash scripts/setup-vercel-env.sh --dry-run   # preview what would be pushed (no changes)
#
# Prerequisites:
#   - Vercel CLI installed: npm i -g vercel
#   - Project linked:       vercel link
#   - .env file present at repo root (copy from .env.example and fill in values)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

log()  { echo -e "${BLUE}→${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }
dim()  { echo -e "${DIM}$1${NC}"; }

# ── Args ─────────────────────────────────────────────────────────────────────
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) err "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Preflight checks ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Wedding Tracker — Vercel env setup${NC}"
echo "────────────────────────────────────"

if ! command -v vercel &>/dev/null; then
  err "Vercel CLI not found. Install it with: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  err ".env file not found at $ROOT_DIR/.env"
  dim "  Copy .env.example to .env and fill in your values, then re-run."
  exit 1
fi

if ! vercel whoami &>/dev/null; then
  err "Not logged in to Vercel. Run: vercel login"
  exit 1
fi

if [[ "$DRY_RUN" == true ]]; then
  warn "DRY RUN — no changes will be made to Vercel"
  echo ""
fi

# ── .env parser ──────────────────────────────────────────────────────────────
# Handles: KEY=VALUE  KEY = VALUE  KEY= "VALUE"  KEY="VALUE"  KEY='VALUE'
# Skips comment lines. Ignores inline comments.
env_get() {
  local key="$1"
  local line

  # Match the last occurrence (in case of duplicates)
  line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" 2>/dev/null | tail -1) || true

  [[ -z "$line" ]] && { echo ""; return; }

  # Strip "KEY =" prefix
  local value="${line#*=}"
  # Strip leading whitespace
  value="${value#"${value%%[![:space:]]*}"}"
  # Strip surrounding double quotes
  if [[ "$value" =~ ^\"(.*)\"$ ]]; then value="${BASH_REMATCH[1]}"; fi
  # Strip surrounding single quotes
  if [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi

  echo "$value"
}

# ── Push a var to Vercel ──────────────────────────────────────────────────────
# Value is passed via stdin to avoid it appearing in process list or shell history.
PUSHED=0
SKIPPED=0
MISSING=0

push_var() {
  local var="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    warn "Skipping ${var} — not set in .env"
    (( MISSING++ )) || true
    return
  fi

  if [[ "$DRY_RUN" == true ]]; then
    ok "${var} ${DIM}(dry run — would push to production, preview, development)${NC}"
    (( PUSHED++ )) || true
    return
  fi

  local failed=false
  for target_env in production preview development; do
    # Remove existing value silently (no-op if not set)
    vercel env rm "$var" "$target_env" --yes 2>/dev/null || true
    # Add new value — pipe via stdin so the secret never appears in logs
    if printf '%s' "$value" | vercel env add "$var" "$target_env" 2>/dev/null; then
      : # success
    else
      err "  Failed to push ${var} to ${target_env}"
      failed=true
    fi
  done

  if [[ "$failed" == false ]]; then
    ok "${var} → production, preview, development"
    (( PUSHED++ )) || true
  fi
}

# ── Determine which vars are required ────────────────────────────────────────
PROVIDER=$(env_get "EMAIL_PROVIDER")
PROVIDER="${PROVIDER:-resend}"

echo ""
log "Email provider: ${BOLD}${PROVIDER}${NC}"
echo ""

# Always-required server-only vars
REQUIRED_VARS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "EMAIL_PROVIDER"
  "RSVP_WEBHOOK_SECRET"
  "CRON_SECRET"
  "HOST_EMAIL"
  "SITE_URL"
)

# Optional server-only vars — only relevant if you use auto-translate, the AI
# "Custom" theme, the guest photowall (#138), or its opt-in originals archive
# (#142, PHOTO_ORIGINALS_PROVIDER + R2_ORIGINALS_BUCKET). Unset ones are skipped quietly
# (not counted as "Missing"), so configuring one provider (or none) doesn't
# produce spurious warnings.
OPTIONAL_VARS=(
  "DEEPL_API_KEY"
  "DEEPL_API_URL"
  "MYMEMORY_EMAIL"
  "THEME_AI_PROVIDER"
  "ANTHROPIC_API_KEY"
  "OPENAI_API_KEY"
  "NVIDIA_API_KEY"
  "THEME_AI_MODEL"
  "NVIDIA_MODEL"
  "COUPLE_EMAIL"
  "HELPER_EMAIL"
  "PHOTO_STORAGE_PROVIDER"
  "R2_ACCOUNT_ID"
  "R2_ACCESS_KEY_ID"
  "R2_SECRET_ACCESS_KEY"
  "R2_BUCKET"
  "R2_PUBLIC_BASE_URL"
  "BLOB_READ_WRITE_TOKEN"
  "PHOTO_ORIGINALS_PROVIDER"
  "R2_ORIGINALS_BUCKET"
)

# Provider-specific vars
if [[ "$PROVIDER" == "gmail" ]]; then
  REQUIRED_VARS+=("GMAIL_FROM" "GMAIL_APP_PASSWORD")
else
  REQUIRED_VARS+=("RESEND_API_KEY")
  # One of RESEND_FROM_EMAIL / RESEND_SENDING_DOMAIN is required (handled below).
fi

# ── Push required vars ────────────────────────────────────────────────────────
log "Pushing required vars..."
for var in "${REQUIRED_VARS[@]}"; do
  value=$(env_get "$var")
  push_var "$var" "$value"
done

# ── Push optional vars (skip-quietly when unset) ──────────────────────────────
echo ""
log "Pushing optional vars (auto-translate / AI theme / photowall storage)..."
for var in "${OPTIONAL_VARS[@]}"; do
  value=$(env_get "$var")
  if [[ -z "$value" ]]; then
    dim "  ${var} — not set, skipping"
    continue
  fi
  push_var "$var" "$value"
done

# ── Handle Resend from-address (either RESEND_FROM_EMAIL or RESEND_SENDING_DOMAIN) ──
if [[ "$PROVIDER" != "gmail" ]]; then
  from_email=$(env_get "RESEND_FROM_EMAIL")
  sending_domain=$(env_get "RESEND_SENDING_DOMAIN")

  if [[ -n "$from_email" ]]; then
    push_var "RESEND_FROM_EMAIL" "$from_email"
  elif [[ -n "$sending_domain" ]]; then
    push_var "RESEND_SENDING_DOMAIN" "$sending_domain"
  else
    warn "Skipping RESEND_FROM_EMAIL / RESEND_SENDING_DOMAIN — neither set in .env"
    warn "  Set one of these to configure the sending address."
    (( MISSING++ )) || true
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────"
echo -e "  ${GREEN}Pushed:${NC}  $PUSHED vars"
[[ $MISSING -gt 0 ]] && echo -e "  ${YELLOW}Missing:${NC} $MISSING vars (check warnings above)"
echo ""

if [[ $MISSING -gt 0 ]]; then
  warn "Some vars were skipped. Fill them in .env and re-run this script."
  echo ""
fi

if [[ "$DRY_RUN" == false && $PUSHED -gt 0 ]]; then
  log "Done. Redeploy your Vercel project for changes to take effect:"
  dim "  vercel --prod"
  echo ""
fi
