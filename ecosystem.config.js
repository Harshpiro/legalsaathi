// ============================================================
// LegalSaathi — PM2 Ecosystem Configuration
// ============================================================
// Usage (on EC2 server):
//   pm2 start ecosystem.config.js
//   pm2 status
//   pm2 logs
//   pm2 reload all    ← zero-downtime restart
//   pm2 startup       ← auto-start on server reboot
//   pm2 save          ← save current process list
// ============================================================

module.exports = {
  apps: [
    {
      name: 'legalsaathi-backend',
      cwd: '/home/ubuntu/legalsaathi/backend',
      script: '.venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000 --workers 2',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
      // Restart behavior
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Watch (disabled in prod — use CI/CD instead)
      watch: false,
      // Logging
      error_file: '/home/ubuntu/logs/backend-error.log',
      out_file: '/home/ubuntu/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Memory limit — restart if exceeds (safety net)
      max_memory_restart: '1G',
    },
    {
      name: 'legalsaathi-frontend',
      cwd: '/home/ubuntu/legalsaathi/frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      error_file: '/home/ubuntu/logs/frontend-error.log',
      out_file: '/home/ubuntu/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '512M',
    },
  ],
};
