#!/usr/bin/env bash
# Database backup script for KyereAse PostgreSQL
# Usage: ./scripts/backup-db.sh
# Schedule via cron: 0 */6 * * * /path/to/scripts/backup-db.sh
#
# Environment variables:
#   DATABASE_URL  - PostgreSQL connection string (required)
#   BACKUP_DIR   - Backup output directory (default: ./backups)
#   BACKUP_KEEP  - Number of backups to retain (default: 30)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
BACKUP_KEEP="${BACKUP_KEEP:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/kyerease_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Starting database backup: ${BACKUP_FILE}"

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Rotate old backups — keep the most recent $BACKUP_KEEP
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "kyerease_*.sql.gz" -type f | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$BACKUP_KEEP" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - BACKUP_KEEP))
  echo "Rotating: removing ${REMOVE_COUNT} old backup(s)"
  find "$BACKUP_DIR" -name "kyerease_*.sql.gz" -type f \
    | sort \
    | head -n "$REMOVE_COUNT" \
    | xargs rm -f
fi

echo "Backup rotation complete. ${BACKUP_KEEP} most recent backups retained."
