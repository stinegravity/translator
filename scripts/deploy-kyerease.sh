#!/bin/bash
# Deploy Kyerease (twi-translator) to ClubExpress droplet
# Usage: ./scripts/deploy-kyerease.sh
#
# Prerequisites:
# - keyerease user on 178.62.42.214 with SSH keys set up (run scripts/setup-keyerease-ssh.sh on server as root)
# - SSH key for keyerease (use clubexpress_droplet or add it to keyerease's authorized_keys)
# - pnpm build completed

set -e

HOST="178.62.42.214"
USER="keyerease"
REMOTE_DIR="/home/keyerease/kyerease-app"
SSH_KEY="${HOME}/.ssh/clubexpress_droplet"

echo "Building frontend..."
pnpm run build

echo "Deploying to ${USER}@${HOST}..."
rsync -avz -e "ssh -i ${SSH_KEY}" --delete dist/ "${USER}@${HOST}:${REMOTE_DIR}/dist/"
rsync -avz -e "ssh -i ${SSH_KEY}" server/ "${USER}@${HOST}:${REMOTE_DIR}/server/"
rsync -avz -e "ssh -i ${SSH_KEY}" prisma/ "${USER}@${HOST}:${REMOTE_DIR}/prisma/"
rsync -avz -e "ssh -i ${SSH_KEY}" package.json pnpm-lock.yaml package-lock.json prisma.config.ts ecosystem.config.cjs "${USER}@${HOST}:${REMOTE_DIR}/"

echo "Running migrations and restarting on server..."
ssh -i "${SSH_KEY}" "${USER}@${HOST}" "cd ${REMOTE_DIR} && pnpm install && npx prisma migrate deploy && (pm2 restart kyerease-app || pm2 start ecosystem.config.cjs)"

echo "Done. Check https://test.graviticreatives.com"
