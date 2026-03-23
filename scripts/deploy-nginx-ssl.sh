#!/bin/bash
# Deploy Nginx config for Kyerease and apply SSL via Let's Encrypt
# Usage: ./scripts/deploy-nginx-ssl.sh [--skip-certbot]
#
# Run once for initial SSL setup. Re-run when nginx config changes.
# --skip-certbot: deploy config only, don't run certbot (use if SSL already set up)

set -e

HOST="178.62.42.214"
SSH_KEY="${HOME}/.ssh/clubexpress_droplet"
NGINX_CONF="nginx/test.graviticreatives.com.conf"
DOMAIN="test.graviticreatives.com"

SKIP_CERTBOT=false
for arg in "$@"; do
  [[ "$arg" == "--skip-certbot" ]] && SKIP_CERTBOT=true
done

echo "Deploying nginx config to ${HOST}..."
scp -i "${SSH_KEY}" "${NGINX_CONF}" "root@${HOST}:/etc/nginx/sites-available/test.graviticreatives.com.conf"

echo "Enabling site and setting permissions..."
ssh -i "${SSH_KEY}" "root@${HOST}" "
  ln -sf /etc/nginx/sites-available/test.graviticreatives.com.conf /etc/nginx/sites-enabled/
  chmod o+x /home/keyerease /home/keyerease/kyerease-app /home/keyerease/kyerease-app/dist 2>/dev/null || true
  chmod -R o+rX /home/keyerease/kyerease-app/dist 2>/dev/null || true
"

echo "Testing nginx config..."
ssh -i "${SSH_KEY}" "root@${HOST}" "nginx -t"

if [[ "$SKIP_CERTBOT" == "true" ]]; then
  echo "Reloading nginx (--skip-certbot, not running certbot)..."
  ssh -i "${SSH_KEY}" "root@${HOST}" "systemctl reload nginx"
  echo "Done. SSL unchanged."
  exit 0
fi

echo "Checking if SSL already configured..."
SSL_CONFIGURED=$(ssh -i "${SSH_KEY}" "root@${HOST}" "grep -l 'listen 443' /etc/nginx/sites-enabled/*.conf 2>/dev/null | grep -c test.graviticreatives || true" || echo "0")

if [[ "$SSL_CONFIGURED" != "0" ]]; then
  echo "SSL already configured. Reloading nginx..."
  ssh -i "${SSH_KEY}" "root@${HOST}" "systemctl reload nginx"
  echo "Done. https://${DOMAIN}"
  exit 0
fi

echo "Running certbot for SSL (first-time setup)..."
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@graviticreatives.com}"
ssh -i "${SSH_KEY}" "root@${HOST}" " \
  if command -v certbot >/dev/null 2>&1; then \
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email ${CERTBOT_EMAIL} && systemctl reload nginx; \
  else \
    echo 'Certbot not installed. Run: apt install certbot python3-certbot-nginx -y'; \
    echo 'Then: certbot --nginx -d ${DOMAIN}'; \
    systemctl reload nginx; \
  fi \
"

echo "Done. https://${DOMAIN}"
