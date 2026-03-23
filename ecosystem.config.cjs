/** @type {import('pm2').StartOptions} */
/** Staging: test.graviticreatives.com — NODE_ENV=staging to avoid production confusion */
const path = require('path');
const fs = require('fs');

const envStaging = path.join(__dirname, '.env.staging');
if (fs.existsSync(envStaging)) {
  require('dotenv').config({ path: envStaging });
} else {
  console.warn('[ecosystem] .env.staging not found; using process env');
}

module.exports = {
  apps: [
    {
      name: 'kyerease-app',
      script: 'pnpm',
      args: 'run server',
      cwd: __dirname,
      interpreter: 'none',
      env: { NODE_ENV: 'staging' },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
