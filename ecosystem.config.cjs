module.exports = {
  apps: [
    {
      name: 'madenmore-server',
      script: 'server/api.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M'
    }
  ]
};
