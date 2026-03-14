#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/setup-gsc-secrets.sh \
    --client-email service-account@project.iam.gserviceaccount.com \
    --private-key-file /absolute/path/to/private-key.pem \
    --site-url sc-domain:example.com

Notes:
  - The private key file should contain the full RSA private key.
  - site-url should match your Search Console property exactly.
EOF
}

CLIENT_EMAIL=""
PRIVATE_KEY_FILE=""
SITE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --client-email)
      CLIENT_EMAIL="${2:-}"
      shift 2
      ;;
    --private-key-file)
      PRIVATE_KEY_FILE="${2:-}"
      shift 2
      ;;
    --site-url)
      SITE_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$CLIENT_EMAIL" || -z "$PRIVATE_KEY_FILE" || -z "$SITE_URL" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

if [[ ! -f "$PRIVATE_KEY_FILE" ]]; then
  echo "Private key file not found: $PRIVATE_KEY_FILE" >&2
  exit 1
fi

echo "Setting repository secrets..."
gh secret set GSC_CLIENT_EMAIL --body "$CLIENT_EMAIL"
gh secret set GSC_SITE_URL --body "$SITE_URL"
gh secret set GSC_PRIVATE_KEY < "$PRIVATE_KEY_FILE"

echo ""
echo "Configured secrets:"
gh secret list | rg '^GSC_' || true

echo ""
echo "Done. Next step:"
echo "  gh workflow run \"SEO Monitoring\""
