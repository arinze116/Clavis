import { config } from "./config.js";
import { errorMessage, logger } from "./logger.js";
import { NearClient } from "./near.js";

const UNAPPROVED_RECIPIENT = "f".repeat(64);

async function simulateAttack(): Promise<void> {
  const near = new NearClient({
    networkId: config.nearNetwork,
    rpcUrl: config.nearRpcUrl,
    accountId: config.nearAccountId,
    privateKey: config.nearPrivateKey,
    contractId: config.contractId,
  });
  await near.connect();
  await near.verifyRestrictedKey();

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
