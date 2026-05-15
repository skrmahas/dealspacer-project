#!/usr/bin/env bash
# ── Upload timing harness ──────────────────────────────────────────────────
# Generates test files of varying sizes, uploads them via curl, and times
# the full round-trip. Also measures S3 save time via server logs.
#
# Usage:
#   bash scripts/diagnose-upload-timing.sh [base-url] [sizes...]
#
#   bash scripts/diagnose-upload-timing.sh http://localhost:3000 10MB 50MB 100MB
#
# Requires: curl, dd / fallocate

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
shift || true
SIZES=("${@:-10MB 50MB 100MB}")

TEMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

echo "=== Upload Timing Harness ==="
echo "  Server: $BASE_URL"
echo "  Sizes:  ${SIZES[*]}"
echo ""

for size in "${SIZES[@]}"; do
  size_lower=$(echo "$size" | tr '[:upper:]' '[:lower:]')
  case "$size_lower" in
    *mb) bytes=$(( ${size_lower%mb} * 1024 * 1024 )) ;;
    *kb) bytes=$(( ${size_lower%kb} * 1024 )) ;;
    *)   bytes="$size_lower" ;;
  esac

  TEST_FILE="$TEMP_DIR/test-${size}.pdf"
  echo "--- Generating $size test file ($bytes bytes) ---"
  # Create a dummy PDF of the requested size
  # Use /dev/urandom to simulate a binary file
  dd if=/dev/urandom of="$TEST_FILE" bs=1024 count=$(( bytes / 1024 )) 2>/dev/null

  # Add PDF header so it passes MIME check
  printf '%%PDF-1.4\n' | cat - "$TEST_FILE" > "$TEST_FILE.tmp" && mv "$TEST_FILE.tmp" "$TEST_FILE"

  echo "  File created: $(du -h "$TEST_FILE" | cut -f1)"

  # Warm-up request to check server is alive
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/jobs" 2>/dev/null || echo "000")
  if [ "$STATUS" = "000" ]; then
    echo "  ⚠ Server not reachable at $BASE_URL (got status $STATUS)"
    echo "  Start the dev server and re-run: npm run dev"
    continue
  fi

  echo "  Timed upload (curl -w timing)..."
  START_TS=$(date +%s%3N)

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/jobs" \
    -F "file=@$TEST_FILE;type=application/pdf" \
    -F "outputLanguage=en" \
    2>/dev/null || echo "000")

  END_TS=$(date +%s%3N)
  ELAPSED_MS=$(( END_TS - START_TS ))
  ELAPSED_SEC=$(echo "scale=2; $ELAPSED_MS / 1000" | bc -l 2>/dev/null || echo "$ELAPSED_MS ms")

  echo "  HTTP: $HTTP_CODE  Time: ${ELAPSED_MS}ms (${ELAPSED_SEC}s)"
  echo "  Throughput: $(echo "scale=1; $bytes / $ELAPSED_SEC / 1048576" | bc -l 2>/dev/null || echo "N/A") MB/s"
  echo ""
done

echo "=== Done ==="
echo "Check server logs for [DEBUG-upload-timing] output if instrumentation is active."
