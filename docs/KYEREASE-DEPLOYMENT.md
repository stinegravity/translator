# Kyerease (twi-translator) Deployment to ClubExpress Droplet

Deploy Kyerease to the ClubExpress droplet at `178.62.42.214`, using user `kyerease` and nginx for `test.graviticreatives.com`.

---

## 1. Create kyerease User on Server

SSH to the droplet. You need root or sudo access to create users.

```bash
# Option A: If you have root access
ssh root@178.62.42.214

# Option B: If clubexpress has sudo
ssh clubexpress@178.62.42.214
sudo -s
```

Copy and run the setup script:

```bash
# From your local machine, copy the script
scp scripts/setup-kyerease-user.sh clubexpress@178.62.42.214:/tmp/

# On the server
ssh clubexpress@178.62.42.214
sudo bash /tmp/setup-kyerease-user.sh
```

This creates:
- User `kyerease` with home `/home/kyerease`
- App dir `/home/kyerease/kyerease-app`
- Installs PostgreSQL and Redis (system packages)
- Creates DB `twi_translator` and user `kyerease`

---

## 2. Set Up Database and Redis (system packages)

The app runs via PM2 (no Docker). Use system PostgreSQL and Redis:

```bash
# As root on the droplet
apt update && apt install -y postgresql postgresql-contrib redis-server

# Create DB and user for kyerease (replace YOUR_SECURE_PASSWORD)
sudo -u postgres psql -c "CREATE USER kyerease WITH PASSWORD 'YOUR_SECURE_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE twi_translator OWNER kyerease;"

# Ensure Redis is running
systemctl enable redis-server && systemctl start redis-server
```

---

## 3. Configure Nginx

```bash
# As root on the server
sudo cp /path/to/nginx/test.graviticreatives.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/test.graviticreatives.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**DNS:** Ensure `test.graviticreatives.com` points to `178.62.42.214`.

**SSL (after DNS works):**
```bash
sudo certbot --nginx -d test.graviticreatives.com
```

---

## 4. Deploy the App

### Build locally

```bash
pnpm run build
```

### Deploy backend + frontend

Use the deploy script (recommended):

```bash
./scripts/deploy-kyerease.sh
```

Or manually:

```bash
rsync -avz --delete dist/ kyerease@178.62.42.214:/home/kyerease/kyerease-app/dist/
rsync -avz server/ kyerease@178.62.42.214:/home/kyerease/kyerease-app/server/
rsync -avz prisma/ kyerease@178.62.42.214:/home/kyerease/kyerease-app/prisma/
rsync -avz package.json pnpm-lock.yaml prisma.config.ts ecosystem.config.cjs kyerease@178.62.42.214:/home/kyerease/kyerease-app/
```

### On the server

```bash
ssh kyerease@178.62.42.214
cd ~/kyerease-app
pnpm install
npx prisma migrate deploy
# Ensure .env exists with DATABASE_URL, REDIS_URL, OPENAI_API_KEY, GOOGLE_TRANSLATE_API_KEY, ALLOWED_ORIGINS
pm2 start pnpm --name kyerease-app -- run server
pm2 save
pm2 startup   # Enable PM2 on boot (run the command it prints)
```

---

## 5. Environment Variables

Create `/home/kyerease/kyerease-app/.env`:

```env
DATABASE_URL=postgresql://kyerease:PASSWORD@localhost:5432/twi_translator
REDIS_URL=redis://127.0.0.1:6379
OPENAI_API_KEY=sk-...
GOOGLE_TRANSLATE_API_KEY=...
ALLOWED_ORIGINS=https://test.graviticreatives.com
PORT=3001
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Server | `178.62.42.214` |
| User | `kyerease` |
| App path | `/home/kyerease/kyerease-app` |
| Frontend URL | https://test.graviticreatives.com |
| Backend port | 3001 (PM2, proxied via nginx `/api`) |
