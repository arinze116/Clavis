import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const outputPath = path.join(repositoryRoot, "agent", "config", "payroll.local.json");

const hash = (value) => createHash("sha256").update(value).digest("hex");
const near = (value) => (BigInt(value) * 10n ** 24n).toString();

const workerOne = process.env.WORKER_ONE_ID ?? "worker-one.testnet";
const workerTwo = process.env.WORKER_TWO_ID ?? "worker-two.testnet";
const workerThree = process.env.WORKER_THREE_ID ?? "worker-three.testnet";
const contractId = process.env.CONTRACT_ID ?? "clavis.testnet";
const ownerEmail = process.env.OWNER_EMAIL ?? "notifications-disabled@example.com";

const payroll = {
  businesses: [
    {
      contract_id: contractId,
      owner_email: ownerEmail,
      recipients: [
        {
          recipientHash: hash(workerOne),
          name: "Ada",
          nearAddress: workerOne,
          amountYocto: near(4),
          milestoneReady: false,
          destinations: [
            { chain: "near", token: "NEAR", address: workerOne, percentage: 100 },
          ],
        },
        {
          recipientHash: hash(workerTwo),
          name: "Sarah",
          nearAddress: workerTwo,
          amountYocto: near(5),
          milestoneReady: false,
          destinations: [
            { chain: "near", token: "NEAR", address: workerTwo, percentage: 100 },
          ],
        },
        {
          recipientHash: hash(workerThree),
          name: "Chidi",
          nearAddress: workerThree,
          amountYocto: near(3),
          milestoneReady: true,
          milestoneId: "demo-launch-delivery",
          destinations: [
            { chain: "near", token: "NEAR", address: workerThree, percentage: 100 },
          ],
        },
      ],
    },
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payroll, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(`Private demo payroll written to ${outputPath}`);
