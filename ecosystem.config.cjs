/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: 'kyerease-app',
      script: 'pnpm',
      args: 'run server',
      cwd: __dirname,
      interpreter: 'none',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
