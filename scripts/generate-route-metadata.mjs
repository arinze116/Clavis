import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const distRoot = path.join(repositoryRoot, "frontend", "dist");
const template = await readFile(path.join(distRoot, "index.html"), "utf8");

const routes = [
  {
    path: "dashboard",
    title: "Business Console · Clavis",
    description:
      "Inspect live Clavis treasury, policy, roster, anomalies, and audit evidence without connecting a wallet.",
  },
  {
    path: "worker",
    title: "Worker Portal · Clavis",
    description:
      "Register a NEAR testnet wallet, choose a settlement preference, and verify privacy-minimized payroll decisions.",
  },
  {
    path: "audit",
    title: "Public Audit Log · Clavis",
    description:
      "Inspect privacy-minimized Clavis payroll decisions with the public NEAR transaction boundary disclosed.",
  },
  {
    path: "security",
    title: "Security Evidence · Clavis",
    description: "Review Clavis threat cases, source-linked tests, CI evidence, and documented limitations.",
  },
  {
    path: "setup",
    title: "Configure Payroll · Clavis",
    description: "Deploy and configure an isolated Clavis payroll contract on NEAR testnet.",
  },
  {
    path: "guide",
    title: "How to Use Clavis · Guide",
    description: "Step-by-step Clavis guides for business owners, workers, and developers.",
  },
  {
    path: "guide/business",
    title: "Business Owner Guide · Clavis",
    description: "Deploy, fund, secure, and monitor an autonomous Clavis payroll contract.",
  },
  {
    path: "guide/worker",
    title: "Worker Guide · Clavis",
    description: "Join a Clavis payroll roster, receive payments, and review your history.",
  },
  {
    path: "guide/developer",
    title: "Developer Guide · Clavis",
    description: "Understand and run the Clavis contracts, scheduler, frontend, and factory.",
  },
  {
    path: "privacy",
    title: "Privacy · Clavis",
    description: "Understand the Clavis privacy boundary and private payroll-plan storage model.",
  },
  {
    path: "terms",
    title: "Terms · Clavis",
    description: "Clavis testnet terms of use and software limitations.",
  },
];

for (const route of routes) {
  const html = template
    .replace(/<title>[^<]*<\/title>/u, `<title>${escapeHtml(route.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/u,
      `<meta name="description" content="${escapeHtml(route.description)}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/u,
      `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/u,
      `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    );
  const directory = path.join(distRoot, ...route.path.split("/"));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), html, "utf8");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
