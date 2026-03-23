# SSH Keys Reference

**Never commit private keys or API keys.** This doc references where keys live and how to use them—no actual key material.

---

## Where keys are stored

### On your Mac (private + public)

| Key file | Purpose |
|----------|---------|
| `~/.ssh/clubexpress_droplet` | Private key – root, keyerease on 178.62.42.214 |
| `~/.ssh/clubexpress_droplet.pub` | Public key |
| `~/.ssh/gravitidev_key` | Private key – gravitidev on 178.62.42.214 |
| `~/.ssh/gravitidev_key.pub` | Public key |

**To print your public keys:**
```bash
cat ~/.ssh/clubexpress_droplet.pub
cat ~/.ssh/gravitidev_key.pub
```

---

## Adding keys for gravitidev

**gravitidev** can SSH in. Add their public key as root:

```bash
mkdir -p /home/gravitidev/.ssh
echo "THEIR_PUBLIC_KEY" >> /home/gravitidev/.ssh/authorized_keys
chmod 700 /home/gravitidev/.ssh
chmod 600 /home/gravitidev/.ssh/authorized_keys
chown -R gravitidev:gravitidev /home/gravitidev/.ssh
```

*ClubExpress user setup is in a separate doc (e.g. ~/Documents/CLUBEXPRESS-SSH-SETUP.md).*

---

## SSH commands (admin)

```bash
ssh -i ~/.ssh/clubexpress_droplet root@178.62.42.214
ssh -i ~/.ssh/clubexpress_droplet keyerease@178.62.42.214
ssh -i ~/.ssh/gravitidev_key gravitidev@178.62.42.214
```

---

## Backing up keys on Mac

Private keys are only in `~/.ssh/`. To avoid losing them:

1. **Encrypted backup** – Copy `~/.ssh/` to an encrypted volume (e.g. USB, encrypted DMG).
2. **iCloud Keychain** – SSH keys can be stored in Keychain; ensure Keychain Access backs them up.
3. **1Password / Bitwarden** – Store private keys as secure notes (export with `cat ~/.ssh/clubexpress_droplet`).
4. **Password manager** – Store API keys (OPENAI, GOOGLE_TRANSLATE, BETTER_AUTH_SECRET) in a password manager, not in the repo.

See `docs/DEPLOYMENT-RULES.md` for the full key-backup section.
