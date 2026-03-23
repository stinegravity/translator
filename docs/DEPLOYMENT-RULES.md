# Kyerease Deployment Rules (Source of Truth)

### Index (AI-friendly)

- **Core rules**
  - [95% Confidence Rule](#95-confidence-rule)
  - [Confidence Checklist](#confidence-checklist)
- **Environment topology**
  - [Host Topology (Staging Only)](#host-topology-staging-only)
  - [Kyerease Database (Authoritative)](#kyerease-database-authoritative)
- **SSH Access**
  - [SSH Users and Keys](#ssh-users-and-keys)
  - [Adding Keys for gravitidev](#adding-keys-for-gravitidev)
- **Staging (PM2)**
  - [Authoritative Paths](#staging-deployment-pm2--authoritative-paths)
  - [Staging Deploy Steps](#staging-deploy-steps-pm2)
- **Key Management**
  - [Backing Up Keys on Mac](#backing-up-keys-on-mac)
  - [No Exposed Keys](#no-exposed-keys)
- **Meta**
  - [Changelog](#changelog)

### Quick search keywords

- `test.graviticreatives.com`
- `178.62.42.214`
- `kyerease-app`
- `keyerease`
- `twi_translator`
- `docker-compose.kyerease-db.yml`

---

## 95% Confidence Rule

**Do not deploy until you have 95% confidence you know what to deploy and how.**

### Confidence Checklist

- [ ] **Database**: Kyerease uses `twi_translator` DB (see [Kyerease Database](#kyerease-database-authoritative))
- [ ] **Environment**: `test.graviticreatives.com` is **STAGING** only (not production)
- [ ] **API keys**: OPENAI_API_KEY, GOOGLE_TRANSLATE_API_KEY, BETTER_AUTH_SECRET set in server `.env` (never in repo)
- [ ] **SSH**: Correct key (`clubexpress_droplet` for root/keyerease, `gravitidev_key` for gravitidev)
- [ ] **Deploy target**: `/home/keyerease/kyerease-app/`
- [ ] **Build**: `pnpm run build` succeeds locally before deploy

---

## Host Topology (Staging Only)

**Single staging droplet:**

| Item | Value |
|------|-------|
| **IP** | `178.62.42.214` |
| **Hostname** | `devserver-intel-lon1-01` |
| **Environment** | **STAGING** (test.graviticreatives.com) |
| **Production** | Not yet defined |

**Verify on host:**

```bash
ssh -i ~/.ssh/clubexpress_droplet root@178.62.42.214 "hostname; pm2 list | grep kyerease; lsof -iTCP:3001 -sTCP:LISTEN -n -P | head -3"
```

---

## Kyerease Database (Authoritative)

**Rule:** Kyerease MUST use the dedicated Kyerease stack. **Do NOT use ClubExpress Postgres or Redis** — those belong to a different app.

Use `docker-compose.kyerease-db.yml` for Postgres + Redis:

```bash
# On droplet, as root
cd /path/to/twi-translator
docker compose -f docker-compose.kyerease-db.yml up -d
```

**Connection:**
- `DATABASE_URL=postgresql://kyerease:kyerease_db_password@127.0.0.1:5434/twi_translator` (port 5434)
- `REDIS_URL=redis://127.0.0.1:6380`

**Port:** 5434 (5433 often in use by system Postgres on shared hosts).

**Override password via env (production):** Create `.env.kyerease-db` (gitignored) with `POSTGRES_PASSWORD=...`, then:
```bash
docker compose -f docker-compose.kyerease-db.yml --env-file .env.kyerease-db up -d
```

---

## SSH Users and Keys

| User | Key file | Purpose |
|------|----------|---------|
| **root** | `~/.ssh/clubexpress_droplet` | Server admin, nginx, packages |
| **keyerease** | `~/.ssh/clubexpress_droplet` | Kyerease deploy target |
| **gravitidev** | `~/.ssh/gravitidev_key` | Gravitidev platform testing |

**SSH commands (Kyerease):**

```bash
ssh -i ~/.ssh/clubexpress_droplet root@178.62.42.214
ssh -i ~/.ssh/clubexpress_droplet keyerease@178.62.42.214
ssh -i ~/.ssh/gravitidev_key gravitidev@178.62.42.214
```

*ClubExpress user setup is in a separate doc (not in this repo).*

---

## Adding Keys for gravitidev

**gravitidev** can SSH in to test. They provide their public key.

**As root on droplet:**

```bash
mkdir -p /home/gravitidev/.ssh
echo "PASTE_GRAVITIDEV_PUBLIC_KEY" >> /home/gravitidev/.ssh/authorized_keys
chmod 700 /home/gravitidev/.ssh
chmod 600 /home/gravitidev/.ssh/authorized_keys
chown -R gravitidev:gravitidev /home/gravitidev/.ssh
```

**They get their public key with:** `cat ~/.ssh/their_key.pub`

---

## Staging Deployment (PM2) — Authoritative Paths

### Source of truth

- **PM2 name:** `kyerease-app`
- **PM2 cwd:** `/home/keyerease/kyerease-app`
- **Frontend:** `/home/keyerease/kyerease-app/dist`
- **Backend port:** `3001`

### Correct deploy target

```
/home/keyerease/kyerease-app/
├── dist/           ← Vite build output
├── server/         ← Express backend
├── prisma/
├── package.json
├── ecosystem.config.cjs
└── .env            ← Never committed; create on server
```

### Verification

```bash
ssh -i ~/.ssh/clubexpress_droplet keyerease@178.62.42.214 "pm2 info kyerease-app | grep -E 'cwd|script'"
# Expected: cwd /home/keyerease/kyerease-app
```

---

## Staging Deploy Steps (PM2)

```bash
# 1. Build locally
pnpm run build

# 2. Deploy
./scripts/deploy-kyerease.sh

# 3. Verify
curl -s http://178.62.42.214:3001/api/health
curl -s -H "Host: test.graviticreatives.com" http://178.62.42.214/ | head -5
```

**Nginx:** Config at `nginx/test.graviticreatives.com.conf`. Serves frontend from `/home/keyerease/kyerease-app/dist`, proxies `/api` to `http://127.0.0.1:3001`.

**Nginx + SSL:** `deploy-kyerease.sh` deploys the nginx config. For initial SSL:
```bash
./scripts/deploy-nginx-ssl.sh
# Or with custom email: CERTBOT_EMAIL=you@example.com ./scripts/deploy-nginx-ssl.sh
# Skip certbot (config only): ./scripts/deploy-nginx-ssl.sh --skip-certbot
```
**SSL prerequisite:** Ensure `test.graviticreatives.com` DNS points to `178.62.42.214`. Certbot will fail with 404 if the domain does not resolve to this server.

**After deploy, fix nginx permissions** (handled by deploy script):
```bash
ssh -i ~/.ssh/clubexpress_droplet root@178.62.42.214 "chmod o+x /home/keyerease /home/keyerease/kyerease-app /home/keyerease/kyerease-app/dist && chmod -R o+rX /home/keyerease/kyerease-app/dist"
```

---

## Backing Up Keys on Mac

**Private keys and API keys must be backed up securely. Never store them in the repo.**

### Where to save your root SSH key (after recovery)

1. **Primary location:** `~/.ssh/clubexpress_droplet` (private) and `~/.ssh/clubexpress_droplet.pub` (public)
2. **Add to macOS Keychain** so it persists across reboots: `ssh-add --apple-use-keychain ~/.ssh/clubexpress_droplet`
3. **Backup:** 1Password Secure Note, or encrypted USB/DMG — never in git

### SSH keys (`~/.ssh/`)

1. **Encrypted backup** – Copy `~/.ssh/` to an encrypted USB or encrypted DMG.
2. **1Password / Bitwarden** – Store as Secure Note; export with `cat ~/.ssh/clubexpress_droplet` (private key).
3. **iCloud Keychain** – Ensure SSH keys are in Keychain and that Keychain Access backs them up.
4. **Multiple machines** – Use a secure sync (e.g. 1Password) to keep keys in sync without putting them in git.

### API keys (OPENAI, GOOGLE_TRANSLATE, BETTER_AUTH_SECRET)

1. **Password manager** – Store as Secure Note.
2. **`.env` backup** – Keep a copy in an encrypted location (e.g. 1Password, USB); never commit.
3. **`.env.example`** – Commit only templates; no real values.

### Gitignore (already in place)

- `.env`
- `.env.production`
- `.env.kyerease-db`
- `*.pem`
- `secrets/`

---

## No Exposed Keys

- **Never commit** private SSH keys, API keys, or passwords.
- **Public SSH keys** may be shared (e.g. for onboarding) but this repo uses placeholders: `YOUR_PUBLIC_KEY`, `PASTE_CLUBEXPRESS_PUBLIC_KEY`, etc.
- **`scripts/run-in-droplet-console.txt`** – Use placeholders; paste your key from `cat ~/.ssh/clubexpress_droplet.pub`.
- **`docs/SSH-KEYS-REFERENCE.md`** – References key locations only; no actual key material.

---

## Changelog

- **2026-03-10**
  - Initial Kyerease deployment rules.
  - Staging host: 178.62.42.214, test.graviticreatives.com.
  - PM2 for API, Nginx for frontend.
  - Kyerease DB: `docker-compose.kyerease-db.yml` only (no shared ClubExpress DB—that is for another app).
  - SSH for root, keyerease, clubexpress, gravitidev.
  - Key backup guidance; no keys in repo.
