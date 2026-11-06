import { AgentCredentialProvider } from "./agent-credentials.js";
import { config } from "./config.js";
import { errorMessage, logger } from "./logger.js";
import { NearClient } from "./near.js";

const UNAPPROVED_RECIPIENT = "f".repeat(64);

async function simulateAttack(): Promise<void> {
  const contractId = process.env.CONTRACT_ID?.trim() || "clavis.testnet";
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
  const credential = credentials.resolve(contractId);
  const near = new NearClient({
    networkId: config.nearNetwork,
    rpcUrl: config.nearRpcUrl,
    accountId: credential.accountId,
    privateKey: credential.privateKey,
    contractId,
  });
  await near.connect();
  await near.verifyAgentKey();

  const result = await near.requestPayment({
    recipientHash: UNAPPROVED_RECIPIENT,
    amountYocto: "1000000000000000000000000",
    chain: "near",
    token: "NEAR",
  });

  if (result.approved || result.reason !== "Recipient not approved") {
    throw new Error("Attack simulation did not produce the expected policy rejection");
  }
  logger.info("attack.rejected_as_expected", {
    paymentId: result.payment_id,
    reason: result.reason,
  });
}

simulateAttack().catch((error: unknown) => {
  logger.error("attack.simulation_failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
