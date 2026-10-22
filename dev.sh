#!/bin/bash
# Dev server with automatic Stripe webhook forwarding
# Captures the webhook signing secret and injects it into the env
# Usage: ./dev.sh [port]

set -euo pipefail

if ! command -v stripe >/dev/null 2>&1; then
  echo "Stripe CLI is required for pnpm dev:stripe. Use pnpm dev for normal development." >&2
  exit 1
fi

PORT="${1:-3000}"
STRIPE_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$STRIPE_PID" ]; then
    kill "$STRIPE_PID" 2>/dev/null || true
    echo "  Stopped Stripe webhook listener"
  fi
}

trap 'exit 130' SIGINT
trap 'exit 143' SIGTERM
trap cleanup EXIT

# Start Stripe webhook forwarding in background
echo "Starting Stripe webhook forwarding to localhost:${PORT}..."
stripe listen --forward-to "localhost:${PORT}/api/webhooks/stripe" > >(sed -E 's/whsec_[[:alnum:]_]+/[redacted]/g') 2>&1 &
STRIPE_PID=$!

# Capture the webhook signing secret (stripe prints it on startup)
sleep 2
CAPTURED_SECRET=$(stripe listen --print-secret 2>/dev/null || true)
if [ -n "$CAPTURED_SECRET" ] && [[ "$CAPTURED_SECRET" == whsec_* ]]; then
  export STRIPE_WEBHOOK_SECRET="$CAPTURED_SECRET"
  echo "  Webhook secret loaded into this process."
else
  echo "  Using STRIPE_WEBHOOK_SECRET from .env"
fi

# Start Next.js dev server
echo ""
echo "Starting Next.js on port ${PORT}..."
pnpm next dev --port "$PORT"
