import { config } from "./config.js";
import { IntentStore } from "./intent-store.js";
import { IntentClient } from "./intents.js";
import { errorMessage, logger } from "./logger.js";
import { FactoryClient, NearTransferClient } from "./near.js";
import { NotificationManager } from "./notifications/index.js";
import { Scheduler } from "./scheduler.js";

async function main(): Promise<void> {
  const transferClient =
    config.settlementAccountId && config.settlementPrivateKey
      ? new NearTransferClient({
          networkId: config.nearNetwork,
          rpcUrl: config.nearRpcUrl,
          accountId: config.settlementAccountId,
          privateKey: config.settlementPrivateKey,
        })
      : undefined;
  if (transferClient) await transferClient.connect();

  const factory = new FactoryClient({
    rpcUrl: config.nearRpcUrl,
    factoryContractId: config.factoryContractId,
  });
  const intentStore = new IntentStore(config.intentStatePath);
  await intentStore.load();
  const intents = new IntentClient({
    solverRelayUrl: config.solverRelayUrl,
    apiKey: config.intentsApiKey,
    intentsContractId: config.intentsContractId,
    signerAccountId: config.settlementAccountId,
    signerPrivateKey: config.settlementPrivateKey,
    transferClient,
  });
  const notifications = new NotificationManager({
    resendApiKey: config.resendApiKey,
    resendFromEmail: config.resendFromEmail,
    telegramBotToken: config.telegramBotToken,
    telegramChatId: config.telegramChatId,
  });
  const scheduler = new Scheduler({
    config,
    factory,
    intents,
    intentStore,
    notifications,
  });

  const shutdown = (signal: string): void => {
    logger.info("agent.shutdown_requested", { signal });
    scheduler.stop();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("agent.started", {
    network: config.nearNetwork,
    factoryContractId: config.factoryContractId,
    pollIntervalMs: config.pollIntervalMs,
  });
  await scheduler.start();
}

main().catch((error: unknown) => {
  logger.error("agent.fatal", { error: errorMessage(error) });
  process.exitCode = 1;
});
