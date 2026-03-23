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

echo "Building frontend and portal..."
pnpm run build
pnpm run build:portal

echo "Deploying to ${USER}@${HOST}..."
rsync -avz -e "ssh -i ${SSH_KEY}" --delete dist/ "${USER}@${HOST}:${REMOTE_DIR}/dist/"
rsync -avz -e "ssh -i ${SSH_KEY}" --delete dist-portal/ "${USER}@${HOST}:${REMOTE_DIR}/dist-portal/"
rsync -avz -e "ssh -i ${SSH_KEY}" server/ "${USER}@${HOST}:${REMOTE_DIR}/server/"
rsync -avz -e "ssh -i ${SSH_KEY}" prisma/ "${USER}@${HOST}:${REMOTE_DIR}/prisma/"
rsync -avz -e "ssh -i ${SSH_KEY}" package.json pnpm-lock.yaml package-lock.json prisma.config.ts ecosystem.config.cjs docker-compose.kyerease-db.yml "${USER}@${HOST}:${REMOTE_DIR}/"

echo "Running migrations and restarting on server..."
ssh -i "${SSH_KEY}" "${USER}@${HOST}" "cd ${REMOTE_DIR} && pnpm install && npx prisma generate && DOTENV_CONFIG_PATH=.env.staging npx prisma migrate deploy && (pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs)"

echo "Setting nginx-readable permissions on dist and dist-portal..."
ssh -i "${SSH_KEY}" "root@${HOST}" "chmod o+x /home/keyerease /home/keyerease/kyerease-app /home/keyerease/kyerease-app/dist /home/keyerease/kyerease-app/dist-portal 2>/dev/null; chmod -R o+rX /home/keyerease/kyerease-app/dist /home/keyerease/kyerease-app/dist-portal 2>/dev/null || true"

echo "Deploying nginx config..."
scp -i "${SSH_KEY}" nginx/test.graviticreatives.com.conf "root@${HOST}:/etc/nginx/sites-available/"
ssh -i "${SSH_KEY}" "root@${HOST}" "ln -sf /etc/nginx/sites-available/test.graviticreatives.com.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"

echo "Verifying deploy..."
sleep 5
RESTARTS=$(ssh -i "${SSH_KEY}" "${USER}@${HOST}" "pm2 describe kyerease-app 2>/dev/null | grep 'restarts' | head -1" || echo "")
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://test.graviticreatives.com/api/health 2>/dev/null || echo "000")
echo ""
echo "Done."
echo "  Main app: https://test.graviticreatives.com"
echo "  Portal:   https://test.graviticreatives.com/portal/"
echo "  API health: ${HEALTH}"
if [ -n "$RESTARTS" ]; then echo "  $RESTARTS"; fi
if [ "$HEALTH" != "200" ]; then echo "  ⚠️  API returned $HEALTH - check pm2 logs"; fi
echo "For initial SSL: ./scripts/deploy-nginx-ssl.sh"
