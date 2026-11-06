module.exports = {
  apps: [
    {
      name: "clavis-agent",
      script: "agent/src/index.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      cwd: "/opt/clavis",
      env_file: "agent/.env",
      env: {
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: "/opt/clavis/agent/.env",
        DOTENV_CONFIG_OVERRIDE: "true",
      },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "300M",
      autorestart: true,
      watch: false,
      log_file: "/var/log/clavis/agent.log",
      error_file: "/var/log/clavis/agent-error.log",
      time: true,
    },
  ],
};
