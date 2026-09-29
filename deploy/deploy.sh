#!/usr/bin/env bash
# Pull, build and reload. Run on the VPS from /var/www/dartler.
#
#   ./deploy.sh
#
# Deliberately fails loudly: a broken build must not take the running site
# down, so the reload only happens after the build succeeds.
set -euo pipefail

cd /var/www/dartler

echo "› Pulling"
git pull --ff-only

echo "› Installing production dependencies"
npm ci

echo "› Applying any new migrations"
npm run db:migrate

echo "› Building"
npm run build

echo "› Reloading"
pm2 reload dartler --update-env

echo
echo "Deployed. Watch it settle with:  pm2 logs dartler --lines 50"
