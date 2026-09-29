/**
 * PM2 process definition for the Dartler storefront.
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup      # survive a reboot
 *   pm2 logs dartler             # tail
 *   pm2 reload dartler           # zero-downtime restart after a deploy
 *
 * Runs Next's own server rather than `npm start`, so PM2 supervises the node
 * process directly instead of an npm wrapper it cannot signal cleanly.
 */
module.exports = {
  apps: [
    {
      name: 'dartler',
      cwd: '/var/www/dartler',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // A Next server that has wedged gets recycled rather than serving 502s.
      max_memory_restart: '700M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 2000,

      merge_logs: true,
      time: true,
      error_file: '/var/log/pm2/dartler-error.log',
      out_file: '/var/log/pm2/dartler-out.log',
    },
  ],
};
