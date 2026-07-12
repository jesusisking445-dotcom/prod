#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "development" ]; then
  echo "Running database migrations..."
  npm run migrate || echo "Migration step skipped/failed — continuing"

  # NOTE: seeding is intentionally NOT run automatically here anymore.
  # seed.js used to wipe all users on every boot (User.deleteMany({})),
  # which deleted real registered accounts on every deploy/restart.
  # Run `npm run seed` manually (Render Shell tab) only when you
  # actually want to (re)create the demo accounts. It's now safe to
  # re-run any time — it only creates accounts that don't already exist.
fi

exec "$@"