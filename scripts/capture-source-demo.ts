import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Page } from "playwright";

interface NarrationParagraph {
  id: string;
  startSeconds: number;
  endSeconds: number;
}

interface NarrationTiming {
  durationSeconds: number;
  paragraphs: NarrationParagraph[];
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const publicRoot = path.join(repositoryRoot, "demo", "remotion", "public");
const timingPath = path.join(publicRoot, "data", "narration-timing.json");
const manifestPath = path.join(publicRoot, "data", "recording-manifest.json");
const videoDirectory = path.join(publicRoot, "video");
const recordingFile = "clavis-source-verified-walkthrough.webm";
const recordingPath = path.join(videoDirectory, recordingFile);
const applicationUrl = (process.env.CLAVIS_DEMO_URL?.trim() || "https://clavisapp.vercel.app").replace(
  /\/$/u,
  "",
);
const narrationOffsetSeconds = 2;
const tailSeconds = 6;

function paragraphById(timing: NarrationTiming, id: string): NarrationParagraph {
  const paragraph = timing.paragraphs.find((item) => item.id === id);
  if (!paragraph) throw new Error(`Narration timing is missing the ${id} paragraph`);
  return paragraph;
}

async function openRoute(
  page: Page,
  route: string,
  heading: RegExp,
  additionalEvidence?: RegExp,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(`${applicationUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.getByRole("heading", { level: 1, name: heading }).waitFor({
        state: "visible",
        timeout: 60_000,
      });
      if (additionalEvidence) {
        await page.getByText(additionalEvidence).first().waitFor({
          state: "visible",
          timeout: 60_000,
        });
      }
      await page.mouse.move(1810, 990);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await page.waitForTimeout(1_500);
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const timing = JSON.parse(await readFile(timingPath, "utf8")) as NarrationTiming;
  if (!Number.isFinite(timing.durationSeconds) || timing.durationSeconds <= 0) {
    throw new Error("Source-demo timing is missing. Run npm run demo:prepare:source first.");
  }

  await mkdir(videoDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: "light",
    reducedMotion: "no-preference",
    recordVideo: { dir: videoDirectory, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();
  if (!video) throw new Error("Playwright did not initialize source-demo video capture");
  const applicationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 429")) {
      applicationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => applicationErrors.push(error.message));

  const recordingStartedAt = performance.now();
  const waitForPresentationTime = async (seconds: number) => {
    const remaining =
      recordingStartedAt + (narrationOffsetSeconds + seconds) * 1_000 - performance.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
  };

  try {
    await openRoute(page, "/", /Payroll that keeps its promises/i);

    const configure = paragraphById(timing, "configure");
    await waitForPresentationTime(configure.startSeconds);
    await openRoute(
      page,
      "/dashboard",
      /Inspect the payroll system before connecting/i,
      /Contract-controlled native NEAR settlement is active on v0\.2\.0/i,
    );
    const configureDuration = configure.endSeconds - configure.startSeconds;
    await waitForPresentationTime(configure.startSeconds + configureDuration * 0.55);
    await openRoute(
      page,
      "/setup",
      /Launch your payroll contract/i,
      /New payroll deployment is blocked because factory\.clavis\.testnet does not report v0\.2\.0/i,
    );

    const constrain = paragraphById(timing, "constrain");
    await waitForPresentationTime(constrain.startSeconds);
    await openRoute(
      page,
      "/guide/developer",
      /Build on the Clavis architecture/i,
      /request_payment/i,
    );
    await page.mouse.move(1810, 990);

    const enforce = paragraphById(timing, "enforce");
    await waitForPresentationTime(enforce.startSeconds);
    await openRoute(page, "/security", /Tests first\. Claims second/i, /159/);

    const failClosed = paragraphById(timing, "fail-closed");
    await waitForPresentationTime(failClosed.startSeconds);
    await page
      .getByText(/Wallet cancellation leaves a new private recipient active/i)
      .scrollIntoViewIfNeeded();
    await page.mouse.move(1810, 990);

    const provePrivately = paragraphById(timing, "prove-privately");
    await waitForPresentationTime(provePrivately.startSeconds);
    await openRoute(
      page,
      "/audit",
      /Proof without payroll exposure/i,
      /Final block \d+ · refreshes every 10 seconds/i,
    );
    await waitForPresentationTime(
      provePrivately.startSeconds +
        (provePrivately.endSeconds - provePrivately.startSeconds) * 0.58,
    );
    const rejectedFilter = page.getByRole("button", { name: "rejected", exact: true });
    if (await rejectedFilter.isVisible()) await rejectedFilter.click();
    await openRoute(page, "/worker", /Your payroll, your view/i, /employer/i);

    const close = paragraphById(timing, "close");
    await waitForPresentationTime(close.startSeconds);
    await openRoute(page, "/security", /Tests first\. Claims second/i, /159/);
    await waitForPresentationTime(timing.durationSeconds + tailSeconds);

    if (applicationErrors.length > 0) {
      throw new Error(`The source-demo browser reported errors: ${applicationErrors.join(" | ")}`);
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const temporaryVideoPath = await video.path();
  await copyFile(temporaryVideoPath, recordingPath);
  const videoStats = await stat(recordingPath);
  if (videoStats.size < 1_000_000) throw new Error("The source-demo recording is unexpectedly small");

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        recordedAt: new Date().toISOString(),
        recordingFile,
        narrationOffsetSeconds,
        tailSeconds,
        sourceScene: "live-v02-release-candidate-walkthrough",
        sourceName: "playwright-headless-release-candidate",
        applicationUrl,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Captured truthful live-v0.2 release candidate from ${applicationUrl}`);
  console.log(`Recording: ${recordingPath}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unable to capture the source demo");
  process.exitCode = 1;
});
