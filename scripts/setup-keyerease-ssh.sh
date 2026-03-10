#!/bin/bash
# Run as root in Droplet Console. Sets up SSH for keyerease so we can deploy.
# Copy each block and run separately if paste causes issues.

mkdir -p /home/keyerease/.ssh
printf '%s\n' \
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHKD7sBAyayZ9kgpVr1SiOIfyxjfl5D4bZcFyfcDVqgn clubexpress-droplet-20251201" \
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFw+bA1AkcjIDlXaIuRC6zHksZbBgPH9fAIsDLD3gv7i gravitidev@clubexpress-test-server-20251201" \
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHZxMn2I0Ijh1jQVbyf94WSFzWtY08YyaxenAyLKMLDi biney.augustine01@gmail.com" \
  > /home/keyerease/.ssh/authorized_keys
chmod 700 /home/keyerease/.ssh
chmod 600 /home/keyerease/.ssh/authorized_keys
chown -R keyerease:keyerease /home/keyerease
mkdir -p /home/keyerease/kyerease-app
chown keyerease:keyerease /home/keyerease/kyerease-app
echo done
