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

const payroll = {
  version: 1,
  recipients: [
    {
      recipientHash: hash(workerOne),
      amountYocto: near(4),
      milestoneReady: false,
      destinations: [
        { chain: "near", token: "NEAR", address: workerOne, percentage: 100 },
      ],
    },
    {
      recipientHash: hash(workerTwo),
      amountYocto: near(5),
      milestoneReady: false,
      destinations: [
        {
          chain: "ethereum",
          token: "USDC",
          address: "0x2222222222222222222222222222222222222222",
          percentage: 100,
        },
      ],
    },
    {
      recipientHash: hash(workerThree),
      amountYocto: near(3),
      milestoneReady: true,
      milestoneId: "demo-launch-delivery",
      destinations: [
        {
          chain: "bnb",
          token: "BUSD",
          address: "0x3333333333333333333333333333333333333333",
          percentage: 100,
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
