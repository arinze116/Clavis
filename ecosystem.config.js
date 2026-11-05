// ESM mirror for tooling that expects the requested .js filename. PM2 should
// load ecosystem.config.cjs because this repository is an ESM package.
export default {
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
