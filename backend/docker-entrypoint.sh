#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "development" ]; then
  echo "Running database migrations..."
  npm run migrate || echo "Migration step skipped/failed — continuing"

  echo "Seeding database..."
  npm run seed || echo "Seed step skipped/failed — continuing"
fi

exec "$@"