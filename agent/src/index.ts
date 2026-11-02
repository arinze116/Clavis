import { config } from "./config.js";
import { IntentClient } from "./intents.js";
import { errorMessage, logger } from "./logger.js";
import { NearClient } from "./near.js";
import { Scheduler } from "./scheduler.js";
import { StateStore } from "./state.js";

async function main(): Promise<void> {
  const near = new NearClient({
    networkId: config.nearNetwork,
    rpcUrl: config.nearRpcUrl,
    accountId: config.nearAccountId,
    privateKey: config.nearPrivateKey,
    contractId: config.contractId,
  });
  await near.connect();
  await near.verifyRestrictedKey();

  const state = new StateStore(config.statePath);
  await state.load();
  const intents = new IntentClient({
    dryRun: config.dryRunIntents,
    confidentialExecutorUrl: config.confidentialExecutorUrl,
    apiKey: config.intentsApiKey,
    intentsContractId: config.intentsContractId,
  });
  const scheduler = new Scheduler({ config, near, intents, state });

  const shutdown = (signal: string): void => {
    logger.info("agent.shutdown_requested", { signal });
    scheduler.stop();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("agent.started", {
    network: config.nearNetwork,
    contract: config.contractId,
    dryRunIntents: config.dryRunIntents,
  });
  await scheduler.start();
}

main().catch((error: unknown) => {
  logger.error("agent.fatal", { error: errorMessage(error) });
  process.exitCode = 1;
});
