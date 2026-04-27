#!/usr/bin/env bash
set -euo pipefail

PYTHON=/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_FILE="$PROJECT_DIR/investment_doctor.db"

echo "Resetting database..."

if [ -f "$DB_FILE" ]; then
  rm "$DB_FILE"
  echo "  Deleted: $DB_FILE"
fi

cd "$PROJECT_DIR"
"$PYTHON" -m backend.db.seed
echo "  Seeded: $DB_FILE"
echo "Done."
