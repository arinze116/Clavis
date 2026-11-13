import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type CDPSession, type Page } from "playwright";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const SCREENSHOT_ROOT = path.join(REPOSITORY_ROOT, "docs", "screenshots");
const PRODUCTION_ORIGIN = "https://clavisapp.vercel.app";
const OWNER_CDP_ENDPOINT = process.env.CLAVIS_SCREENSHOT_CDP ?? "http://127.0.0.1:9222";
const RESUME_CONNECTED_CAPTURE = process.env.CLAVIS_SCREENSHOT_RESUME === "1";
const CSS_VIEWPORT = { width: 1920, height: 1080 } as const;
const DEVICE_SCALE_FACTOR = 2;

const screenshotPaths = {
  overview: "01-overview/01-clavis-overview.png",
  businessDashboard: "02-business/02-business-dashboard.png",
  payrollConfiguration: "02-business/03-payroll-configuration.png",
  workerManagement: "03-workers/04-worker-management.png",
  ownerAuthorisation: "02-business/05-owner-authorisation.png",
  aiAssistance: "04-ai-payroll/06-ai-payroll-assistance.png",
  policyAnalysis: "04-ai-payroll/07-policy-analysis.png",
  restrictedAgent: "04-ai-payroll/08-restricted-agent.png",
  payrollExecution: "05-payments/09-payroll-execution.png",
  transactionEvidence: "05-payments/10-onchain-transaction.png",
  workerDashboard: "06-verification/11-worker-dashboard.png",
  paymentVerification: "06-verification/12-payment-verification.png",
  publicAudit: "07-audit/13-public-audit.png",
  securityEvidence: "07-audit/14-security-evidence.png",
  securityBoundaries: "07-audit/15-security-boundaries.png",
  aiControlReport: "04-ai-payroll/16-ai-control-report.png",
} as const;

async function createScreenshotDirectories(): Promise<void> {
  const directories = new Set(
    Object.values(screenshotPaths).map((relativePath) => path.dirname(relativePath)),
  );
  await Promise.all(
    [...directories].map((directory) =>
      mkdir(path.join(SCREENSHOT_ROOT, directory), { recursive: true }),
    ),
  );
}

function screenshotPath(relativePath: string): string {
  return path.join(SCREENSHOT_ROOT, relativePath);
}

async function waitForStablePage(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1_200);
  await page.mouse.move(CSS_VIEWPORT.width - 12, CSS_VIEWPORT.height - 12);
}

async function capturePlaywrightPage(page: Page, relativePath: string): Promise<void> {
  await waitForStablePage(page);
  await page.screenshot({
    path: screenshotPath(relativePath),
    animations: "disabled",
    caret: "hide",
  });
}

async function setNative4kMetrics(session: CDPSession): Promise<void> {
  await session.send("Emulation.setDeviceMetricsOverride", {
    ...CSS_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    mobile: false,
    screenWidth: CSS_VIEWPORT.width,
    screenHeight: CSS_VIEWPORT.height,
  });
}

async function captureCdpPage(
  page: Page,
  session: CDPSession,
  relativePath: string,
): Promise<void> {
  await waitForStablePage(page);
  const screenshot = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(screenshotPath(relativePath), Buffer.from(screenshot.data, "base64"));
}

async function scrollToText(page: Page, text: string, offset = 110): Promise<void> {
  const target = page.getByText(text, { exact: true }).first();
  await target.evaluate((element, distance) => {
    const top = element.getBoundingClientRect().top + window.scrollY - distance;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, offset);
  await page.waitForTimeout(500);
}

async function openPublicRoute(page: Page, route: string, heading: RegExp): Promise<void> {
  await page.goto(`${PRODUCTION_ORIGIN}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByRole("heading", { level: 1, name: heading }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await waitForStablePage(page);
}

async function capturePublicScreenshots(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: CSS_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  try {
    await openPublicRoute(page, "/dashboard", /Inspect the payroll system before connecting/i);
    await page.getByText(/Contract-controlled native NEAR settlement is active on v0\.3\.0/i).waitFor();
    await capturePlaywrightPage(page, screenshotPaths.overview);

    await scrollToText(page, "Payment audit");
    await capturePlaywrightPage(page, screenshotPaths.transactionEvidence);

    await openPublicRoute(page, "/audit", /Proof without payroll exposure/i);
    await capturePlaywrightPage(page, screenshotPaths.publicAudit);

    await openPublicRoute(page, "/security", /Tests first\. Claims second/i);
    await capturePlaywrightPage(page, screenshotPaths.securityEvidence);
    await scrollToText(page, "What this evidence does not claim");
    await capturePlaywrightPage(page, screenshotPaths.securityBoundaries);
  } finally {
    await browser.close();
  }
}

function findPage(browser: Browser, predicate: (page: Page) => boolean): Page {
  const page = browser.contexts().flatMap((context) => context.pages()).find(predicate);
  if (!page) throw new Error("Required connected browser page is not available");
  return page;
}

async function clickButton(page: Page, name: RegExp | string): Promise<void> {
  const button = page.getByRole("button", { name }).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  await button.click();
  await page.waitForTimeout(500);
}

async function addDemoWorker(
  page: Page,
  worker: { name: string; accountId: string; milestoneId: string },
): Promise<void> {
  await page.getByLabel("Display name").fill(worker.name);
  await page.getByLabel("NEAR testnet wallet").fill(worker.accountId);
  await page.getByLabel("Recipient region").fill("West Africa");
  await page.getByLabel("Personal cap (NEAR)").fill("1");
  await page.getByLabel("Scheduled payment (NEAR)").fill("0.001");
  await page.locator("#setup-recipient-schedule").selectOption("Milestone");
  await page.getByLabel(/Prepare this one-time milestone payment/i).check();
  await page.getByLabel("Milestone reference").fill(worker.milestoneId);
  await clickButton(page, "Add to setup");
}

async function prepareWorkerStep(page: Page, session: CDPSession): Promise<void> {
  await scrollToText(page, "What NEAR AI extracted");
  await captureCdpPage(page, session, screenshotPaths.policyAnalysis);
  const confirmButton = page.getByRole("button", { name: /Confirm and fill fields|Rules confirmed/i });
  if (await confirmButton.isEnabled()) await confirmButton.click();
  await scrollToText(page, "Review treasury limits");
  await captureCdpPage(page, session, screenshotPaths.payrollConfiguration);
  await clickButton(page, "Back");
  await clickButton(page, "Back");
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCdpPage(page, session, screenshotPaths.ownerAuthorisation);
  await clickButton(page, "Continue");
  await clickButton(page, "Continue");
  await clickButton(page, "Continue");
}

async function captureSetupWorkflow(page: Page, session: CDPSession): Promise<void> {
  if (!RESUME_CONNECTED_CAPTURE) await prepareWorkerStep(page, session);
  await addDemoWorker(page, {
    name: "Arinze Worker 1",
    accountId: "arinze-worker1.testnet",
    milestoneId: "readme-demo-worker-1",
  });
  await addDemoWorker(page, {
    name: "Arinze Worker 2",
    accountId: "arinze-worker2.testnet",
    milestoneId: "readme-demo-worker-2",
  });
  await scrollToText(page, "Arinze Worker 1", 320);
  await captureCdpPage(page, session, screenshotPaths.workerManagement);

  await clickButton(page, "Continue");
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCdpPage(page, session, screenshotPaths.restrictedAgent);
  await clickButton(page, "Continue");
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCdpPage(page, session, screenshotPaths.payrollExecution);
}

async function captureOwnerDashboard(page: Page, session: CDPSession): Promise<void> {
  await page.goto(`${PRODUCTION_ORIGIN}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Payroll under control" }).waitFor({ timeout: 60_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCdpPage(page, session, screenshotPaths.businessDashboard);

  await clickButton(page, /Generate verified report/i);
  await page.getByRole("heading", { name: "AI payroll control report" }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await page.getByLabel("Generating payroll report").waitFor({
    state: "hidden",
    timeout: 60_000,
  });
  await page.getByText("Clavis payroll controls", { exact: true }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await captureCdpPage(page, session, screenshotPaths.aiControlReport);
}

async function captureAiInstruction(page: Page, session: CDPSession): Promise<void> {
  await page.goto(`${PRODUCTION_ORIGIN}/setup`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Set up your Clavis business/i }).waitFor();
  await clickButton(page, "Continue");
  await clickButton(page, "Continue");
  await page.getByLabel("Payroll rules").fill(
    "Pay up to 120 NEAR per day and no more than 20 NEAR per payment. Use Milestone as the default payroll schedule.",
  );
  await scrollToText(page, "Describe the policy you want");
  await captureCdpPage(page, session, screenshotPaths.aiAssistance);
}

async function repairLocalWorkerContractRequests(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const postData = request.postData();
    if (!postData?.includes("clavis.clavis.testnet")) {
      await route.continue();
      return;
    }
    await route.continue({ postData: postData.replaceAll("clavis.clavis.testnet", "clavis.testnet") });
  });
}

async function captureWorkerScreenshots(browser: Browser): Promise<void> {
  const page = findPage(browser, (candidate) => candidate.url() === "http://127.0.0.1:4173/worker");
  const session = await page.context().newCDPSession(page);
  await setNative4kMetrics(session);
  await repairLocalWorkerContractRequests(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Hello, Arinze Worker 1/i }).waitFor({ timeout: 60_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCdpPage(page, session, screenshotPaths.workerDashboard);
  await scrollToText(page, "Payment audit", 140);
  await captureCdpPage(page, session, screenshotPaths.paymentVerification);
  await session.detach();
}

async function captureConnectedScreenshots(): Promise<void> {
  const browser = await chromium.connectOverCDP(OWNER_CDP_ENDPOINT);
  const setupPage = findPage(
    browser,
    (page) => page.url() === `${PRODUCTION_ORIGIN}/setup`,
  );
  const session = await setupPage.context().newCDPSession(setupPage);
  await setNative4kMetrics(session);

  await captureSetupWorkflow(setupPage, session);
  await captureOwnerDashboard(setupPage, session);
  await captureAiInstruction(setupPage, session);
  await session.detach();
  await captureWorkerScreenshots(browser);
  await browser.close();
}

async function main(): Promise<void> {
  await createScreenshotDirectories();
  if (!RESUME_CONNECTED_CAPTURE) await capturePublicScreenshots();
  await captureConnectedScreenshots();
  process.stdout.write(`Captured ${Object.keys(screenshotPaths).length} README screenshots.\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
