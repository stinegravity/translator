#!/bin/bash
# Run this script in the Droplet Console (Access > Launch Droplet Console)
# Paste the entire script and run it.

set -e

USER="kyerease"
HOME_DIR="/home/${USER}"
APP_DIR="${HOME_DIR}/kyerease-app"
DATA_DIR="${HOME_DIR}/data"

# Your SSH public keys (from your Mac) - add all of them for flexibility
PUBLIC_KEYS=(
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHKD7sBAyayZ9kgpVr1SiOIfyxjfl5D4bZcFyfcDVqgn clubexpress-droplet-20251201"
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFw+bA1AkcjIDlXaIuRC6zHksZbBgPH9fAIsDLD3gv7i gravitidev@clubexpress-test-server-20251201"
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHZxMn2I0Ijh1jQVbyf94WSFzWtY08YyaxenAyLKMLDi biney.augustine01@gmail.com"
)

echo "=== Creating user: ${USER} ==="
if id "${USER}" &>/dev/null; then
  echo "User ${USER} already exists."
else
  useradd -m -s /bin/bash "${USER}"
  echo "User ${USER} created with home ${HOME_DIR}"
fi

echo "=== Creating directories ==="
mkdir -p "${APP_DIR}"
mkdir -p "${DATA_DIR}"
chown -R "${USER}:${USER}" "${HOME_DIR}"

echo "=== Setting up SSH for ${USER} ==="
mkdir -p "${HOME_DIR}/.ssh"
for key in "${PUBLIC_KEYS[@]}"; do
  echo "${key}" >> "${HOME_DIR}/.ssh/authorized_keys"
done
chown -R "${USER}:${USER}" "${HOME_DIR}/.ssh"
chmod 700 "${HOME_DIR}/.ssh"
chmod 600 "${HOME_DIR}/.ssh/authorized_keys"
echo "SSH keys added."

echo "=== Installing PostgreSQL and Redis ==="
apt-get update -qq && apt-get install -y -qq postgresql postgresql-contrib redis-server
systemctl enable redis-server
systemctl start redis-server

echo "=== Creating database ==="
sudo -u postgres psql -c "CREATE USER ${USER} WITH PASSWORD 'CHANGE_ME';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE twi_translator OWNER ${USER};" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE twi_translator TO ${USER};" 2>/dev/null || true

echo ""
echo "=== DONE ==="
echo "User: ${USER}"
echo "Home: ${HOME_DIR}"
echo "App dir: ${APP_DIR}"
echo ""
echo "Next (run these on the droplet):"
echo "  1. Set DB password: sudo -u postgres psql -c \"ALTER USER ${USER} PASSWORD 'your_secure_password';\""
echo "  2. Install Node 20+ and pnpm:"
echo "     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
echo "     sudo apt install -y nodejs"
echo "     sudo corepack enable && sudo corepack prepare pnpm@latest --activate"
echo ""
echo "Then from your Mac: ssh kyerease@178.62.42.214"
