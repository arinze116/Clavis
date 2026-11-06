import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

interface EcosystemApplication {
  name: string;
  env: Record<string, string>;
}

interface EcosystemConfiguration {
  apps: EcosystemApplication[];
}

const require = createRequire(import.meta.url);
const ecosystem = require("../../ecosystem.config.cjs") as EcosystemConfiguration;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Clavis PM2 environment isolation", () => {
  it("makes the Clavis environment file override an inherited Telegram token", async () => {
    const application = ecosystem.apps.find(({ name }) => name === "clavis-agent");
    expect(application).toBeDefined();
    expect(application?.env.DOTENV_CONFIG_OVERRIDE).toBe("true");

    const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-environment-"));
    temporaryDirectories.push(directory);
    const environmentPath = path.join(directory, ".env");
    await writeFile(environmentPath, "TELEGRAM_BOT_TOKEN=clavis-test-token\n", {
      mode: 0o600,
    });

    const result = spawnSync(
      process.execPath,
      [
        "--require",
        "dotenv/config",
        "--eval",
        'process.stdout.write(process.env.TELEGRAM_BOT_TOKEN === "clavis-test-token" ? "ok" : "mismatch")',
      ],
      {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        env: {
          ...process.env,
          TELEGRAM_BOT_TOKEN: "codex-test-token",
          DOTENV_CONFIG_PATH: environmentPath,
          DOTENV_CONFIG_OVERRIDE: application?.env.DOTENV_CONFIG_OVERRIDE ?? "",
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("ok");
  });
});
