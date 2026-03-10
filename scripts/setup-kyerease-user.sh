#!/bin/bash
# Run this script on the ClubExpress droplet (178.62.42.214) as root or with sudo.
# Usage: ssh clubexpress@178.62.42.214, then run with sudo (if clubexpress has sudo)
# Or: ssh root@178.62.42.214 (if root SSH is enabled)
#
# Creates kyerease user, home dir, and base directories for twi-translator/kyerease app.

set -e

USER="kyerease"
HOME_DIR="/home/${USER}"
APP_DIR="${HOME_DIR}/kyerease-app"
DATA_DIR="${HOME_DIR}/data"

echo "Creating user: ${USER}"
if id "${USER}" &>/dev/null; then
  echo "User ${USER} already exists."
else
  useradd -m -s /bin/bash "${USER}"
  echo "User ${USER} created with home ${HOME_DIR}"
fi

echo "Creating app directories..."
mkdir -p "${APP_DIR}"
mkdir -p "${DATA_DIR}"

# Set ownership
chown -R "${USER}:${USER}" "${HOME_DIR}"

echo "Installing PostgreSQL and Redis (system packages, no Docker)..."
apt-get update -qq && apt-get install -y -qq postgresql postgresql-contrib redis-server
systemctl enable redis-server
systemctl start redis-server

echo "Creating PostgreSQL database and user..."
# Create user and DB (password will need to be set - run manually with your password)
sudo -u postgres psql -c "CREATE USER ${USER} WITH PASSWORD 'CHANGE_ME';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE twi_translator OWNER ${USER};" 2>/dev/null || true
# If DB exists, ensure user has access:
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE twi_translator TO ${USER};" 2>/dev/null || true

echo "Setting up SSH key access (optional)..."
# If you have a public key to add:
# mkdir -p "${HOME_DIR}/.ssh"
# echo "YOUR_PUBLIC_KEY" >> "${HOME_DIR}/.ssh/authorized_keys"
# chown -R "${USER}:${USER}" "${HOME_DIR}/.ssh"
# chmod 700 "${HOME_DIR}/.ssh"
# chmod 600 "${HOME_DIR}/.ssh/authorized_keys"

echo "Done. User ${USER} home: ${HOME_DIR}"
echo "App dir: ${APP_DIR}"
echo "Data dir: ${DATA_DIR}"
echo ""
echo "Next steps:"
echo "  1. Set PostgreSQL password: sudo -u postgres psql -c \"ALTER USER ${USER} PASSWORD 'your_secure_password';\""
echo "  2. Install Node 20+ and pnpm: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs && sudo corepack enable && sudo corepack prepare pnpm@latest --activate"
echo "  3. Copy your SSH key: ssh-copy-id ${USER}@178.62.42.214"
echo "  4. Deploy app with: ./scripts/deploy-kyerease.sh (server runs via PM2)"
