import path from "node:path";

import { AgentCredentialProvider } from "./agent-credentials.js";
import { config } from "./config.js";
import { ContractEventMonitor } from "./contract-event-monitor.js";
import { IntentStore } from "./intent-store.js";
import { IntentClient } from "./intents.js";
import { errorMessage, logger } from "./logger.js";
import { FactoryClient } from "./near.js";
import { NotificationApiServer } from "./notification-api.js";
import { NotificationEventStore } from "./notification-event-store.js";
import { NotificationPreferenceStore } from "./notification-preferences.js";
import { NotificationManager } from "./notifications/index.js";
import { Scheduler } from "./scheduler.js";
import { TelegramLinkPoller } from "./telegram-link-poller.js";

async function main(): Promise<void> {
  const credentials = await AgentCredentialProvider.load({
    ...(config.agentCredentialsPath
      ? { credentialPath: config.agentCredentialsPath }
      : {}),
    ...(config.nearAccountId && config.nearPrivateKey && config.legacyAgentContractId
      ? {
          legacyCredential: {
            accountId: config.nearAccountId,
            privateKey: config.nearPrivateKey,
          },
          legacyContractId: config.legacyAgentContractId,
        }
      : {}),
  });
  const factory = new FactoryClient({
    rpcUrl: config.nearRpcUrl,
    factoryContractId: config.factoryContractId,
  });
  const intentStore = new IntentStore(config.intentStatePath);
  await intentStore.load();
  const notificationPreferences = new NotificationPreferenceStore(
    config.notificationPreferencesPath,
  );
  await notificationPreferences.load();
  const intents = new IntentClient({
    solverRelayUrl: config.solverRelayUrl,
    apiKey: config.intentsApiKey,
  });
  const notifications = new NotificationManager({
    resendApiKey: config.resendApiKey,
    resendFromEmail: config.resendFromEmail,
    telegramBotToken: config.telegramBotToken,
    telegramChatId: config.telegramChatId,
    preferences: notificationPreferences,
  });
  const notificationEvents = new NotificationEventStore(
    path.join(config.dataDirectory, "notification-events.json"),
  );
  const contractEventMonitor = new ContractEventMonitor({
    factory,
    rpcUrl: config.nearRpcUrl,
    payrollConfigPath: config.payrollConfigPath,
    payrollDirectory: config.payrollDirectory,
    pollIntervalMs: config.notificationEventPollIntervalMs,
    notifications,
    events: notificationEvents,
  });
  await contractEventMonitor.initialize();
  const notificationApi = config.notificationApiEnabled
    ? new NotificationApiServer({
        host: config.notificationApiHost,
        port: config.notificationApiPort,
        apiKey: config.notificationApiKey!,
        factoryContractId: config.factoryContractId,
        nearRpcUrl: config.nearRpcUrl,
        allowedOrigins: config.notificationAllowedOrigins,
        sessionTtlMs: config.notificationSessionTtlMs,
        payrollDirectory: config.payrollDirectory,
        store: notificationPreferences,
        notifications,
        ...(!config.runOnce && config.telegramBotToken && config.telegramBotUsername
          ? { telegramBotUsername: config.telegramBotUsername }
          : {}),
      })
    : null;
  await notificationApi?.start();
  const telegramLinkPoller =
    config.notificationApiEnabled &&
    !config.runOnce &&
    config.telegramBotToken &&
    config.telegramBotUsername
      ? new TelegramLinkPoller({
          botToken: config.telegramBotToken,
          store: notificationPreferences,
        })
      : null;
  telegramLinkPoller?.start();
  const scheduler = new Scheduler({
    config,
    factory,
    intents,
    intentStore,
    notifications,
    notificationEvents,
    credentials,
  });

  const shutdown = (signal: string): void => {
    logger.info("agent.shutdown_requested", { signal });
    scheduler.stop();
    contractEventMonitor.stop();
    telegramLinkPoller?.stop();
    void notificationApi?.stop().catch((error: unknown) => {
      logger.error("notification_api.shutdown_failed", { error: errorMessage(error) });
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("agent.started", {
    network: config.nearNetwork,
    factoryContractId: config.factoryContractId,
    pollIntervalMs: config.pollIntervalMs,
    notificationEventPollIntervalMs: config.notificationEventPollIntervalMs,
    notificationApiEnabled: config.notificationApiEnabled,
  });
  await Promise.all([
    scheduler.start(),
    ...(config.runOnce ? [] : [contractEventMonitor.start()]),
  ]);
}

main().catch((error: unknown) => {
  logger.error("agent.fatal", { error: errorMessage(error) });
  process.exitCode = 1;
});
