#!/bin/bash
# One-time staging server setup: Kyerease DB, .env.staging, SSL
# Usage: ./scripts/setup-staging-server.sh
#
# Prerequisites: SSH key at ~/.ssh/clubexpress_droplet, root + keyerease access

set -e

HOST="178.62.42.214"
USER="keyerease"
REMOTE_DIR="/home/keyerease/kyerease-app"
SSH_KEY="${HOME}/.ssh/clubexpress_droplet"

echo "=== 1. Deploying docker-compose.kyerease-db.yml and starting Kyerease DB ==="
scp -i "${SSH_KEY}" docker-compose.kyerease-db.yml "root@${HOST}:/tmp/"
ssh -i "${SSH_KEY}" "root@${HOST}" "
  mkdir -p ${REMOTE_DIR}
  cp /tmp/docker-compose.kyerease-db.yml ${REMOTE_DIR}/
  cd ${REMOTE_DIR} && docker compose -f docker-compose.kyerease-db.yml up -d
  echo 'Waiting for Postgres...'
  sleep 5
"

echo "=== 2. Creating .env.staging on server ==="
scp -i "${SSH_KEY}" .env.staging.example "${USER}@${HOST}:${REMOTE_DIR}/.env.staging.example"
if [ -f .env ]; then
  echo "Using local .env as base (staging DB/Redis/URL)..."
  grep -v '^DATABASE_URL=' .env | grep -v '^REDIS_URL=' | grep -v '^BETTER_AUTH_URL=' | grep -v '^NODE_ENV=' > /tmp/.env.staging.local
  echo "NODE_ENV=staging" >> /tmp/.env.staging.local
  echo "DATABASE_URL=postgresql://kyerease:kyerease_db_password@127.0.0.1:5434/twi_translator" >> /tmp/.env.staging.local
  echo "REDIS_URL=redis://127.0.0.1:6380" >> /tmp/.env.staging.local
  echo "BETTER_AUTH_URL=https://test.graviticreatives.com" >> /tmp/.env.staging.local
  scp -i "${SSH_KEY}" /tmp/.env.staging.local "${USER}@${HOST}:${REMOTE_DIR}/.env.staging"
  rm -f /tmp/.env.staging.local
else
  ssh -i "${SSH_KEY}" "${USER}@${HOST}" "
    cd ${REMOTE_DIR} && cp .env.staging.example .env.staging
    echo 'Created .env.staging from example. ADD API KEYS: nano ${REMOTE_DIR}/.env.staging'
  "
fi

echo "=== 3. Running full deploy (build, rsync, migrations, PM2) ==="
./scripts/deploy-kyerease.sh

echo "=== 4. Applying SSL (certbot) ==="
./scripts/deploy-nginx-ssl.sh

echo ""
echo "=== Done. Verify: ==="
echo "  https://test.graviticreatives.com"
echo ""
echo "If .env.staging was just created, add API keys on server:"
echo "  ssh -i ~/.ssh/clubexpress_droplet keyerease@${HOST}"
echo "  nano ${REMOTE_DIR}/.env.staging"
echo "  pm2 restart kyerease-app"
