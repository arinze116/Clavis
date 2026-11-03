import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OBSWebSocket, type OBSResponseTypes } from "obs-websocket-js";
import { chromium, type BrowserContext, type Page } from "playwright";

interface NarrationParagraph {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

interface NarrationTiming {
  durationSeconds: number;
  paragraphs: NarrationParagraph[];
}

interface MutedInputState {
  inputName: string;
  inputMuted: boolean;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const remotionPublicRoot = path.join(repositoryRoot, "demo", "remotion", "public");
const narrationTimingPath = path.join(remotionPublicRoot, "data", "narration-timing.json");
const recordingManifestPath = path.join(remotionPublicRoot, "data", "recording-manifest.json");
const rawVideoDirectory = path.join(remotionPublicRoot, "video");
const browserProfilesDirectory = path.join(repositoryRoot, "demo", "browser-profiles");
const smokeDirectory = path.join(repositoryRoot, "demo", "obs", "smoke");
const browserSmokeDirectory = path.join(repositoryRoot, "demo", "obs", "browser-smoke");
const chromePath = process.env.CHROME_PATH?.trim() || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const applicationUrl = (process.env.CLAVIS_DEMO_URL?.trim() || "http://127.0.0.1:4173").replace(/\/$/u, "");
const obsUrl = process.env.OBS_WEBSOCKET_URL?.trim() || "ws://127.0.0.1:4455";
const obsPassword = process.env.OBS_WEBSOCKET_PASSWORD?.trim() || undefined;
const obsScene = process.env.OBS_SCENE?.trim() || "main";
const obsSource = process.env.OBS_SOURCE?.trim() || "screen";
const ownerAccount = "clavis.testnet";
const workerAccount = "worker-one.testnet";
const narrationOffsetSeconds = 2;
const tailSeconds = 6;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/gu, "-");
}

async function waitForRecordState(obs: OBSWebSocket, active: boolean): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const status = await obs.call("GetRecordStatus");
    if (status.outputActive === active) return;
    await sleep(200);
  }
  throw new Error(`OBS recording did not become ${active ? "active" : "inactive"} within 10 seconds.`);
}

async function configureObs(obs: OBSWebSocket, recordDirectory: string): Promise<MutedInputState[]> {
  const recordStatus = await obs.call("GetRecordStatus");
  if (recordStatus.outputActive) {
    throw new Error("OBS is already recording. Stop the current recording before starting the Clavis capture.");
  }

  await mkdir(recordDirectory, { recursive: true });
  await obs.call("SetRecordDirectory", { recordDirectory });
  await obs.call("SetVideoSettings", {
    fpsNumerator: 30,
    fpsDenominator: 1,
    baseWidth: 1920,
    baseHeight: 1080,
    outputWidth: 1920,
    outputHeight: 1080,
  });

  // OBS 32 supports hybrid MP4. If the current profile rejects these optional
  // parameters, recording still proceeds using its existing safe container.
  for (const parameter of [
    { parameterCategory: "Output", parameterName: "Mode", parameterValue: "Simple" },
    { parameterCategory: "SimpleOutput", parameterName: "RecFormat2", parameterValue: "hybrid_mp4" },
    {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting",
      parameterValue: "Clavis Walkthrough %CCYY-%MM-%DD %hh-%mm-%ss",
    },
  ]) {
    try {
      await obs.call("SetProfileParameter", parameter);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`OBS profile parameter was not applied: ${message}`);
    }
  }

  await obs.call("SetCurrentProgramScene", { sceneName: obsScene });
  const sceneItem = await obs.call("GetSceneItemId", {
    sceneName: obsScene,
    sourceName: obsSource,
  });
  await obs.call("SetSceneItemTransform", {
    sceneName: obsScene,
    sceneItemId: sceneItem.sceneItemId,
    sceneItemTransform: {
      positionX: 0,
      positionY: 0,
      boundsType: "OBS_BOUNDS_STRETCH",
      boundsWidth: 1920,
      boundsHeight: 1080,
      boundsAlignment: 5,
    },
  });

  const specialInputs = await obs.call("GetSpecialInputs");
  const inputNames = Array.from(
    new Set(
      [
        specialInputs.desktop1,
        specialInputs.desktop2,
        specialInputs.mic1,
        specialInputs.mic2,
        specialInputs.mic3,
        specialInputs.mic4,
      ].filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const states: MutedInputState[] = [];
  for (const inputName of inputNames) {
    try {
      const state = await obs.call("GetInputMute", { inputName });
      states.push({ inputName, inputMuted: state.inputMuted });
      if (!state.inputMuted) {
        await obs.call("SetInputMute", { inputName, inputMuted: true });
      }
    } catch {
      // A disabled global audio source may be listed but not addressable.
    }
  }
  return states;
}

async function restoreInputMuteStates(obs: OBSWebSocket, states: MutedInputState[]): Promise<void> {
  for (const state of states) {
    try {
      await obs.call("SetInputMute", state);
    } catch {
      // OBS may already be shutting down; capture has safely stopped by this point.
    }
  }
}

async function seedPublicAccount(page: Page, accountId: string | null): Promise<void> {
  await page.evaluate((nextAccountId) => {
    localStorage.removeItem("signedAccountId");
    localStorage.removeItem("functionCallKey");
    localStorage.removeItem("near-wallet-selector:selectedWalletId");
    localStorage.removeItem("near-wallet-selector:recentlySignedInWallets");

    if (nextAccountId) {
      localStorage.setItem("signedAccountId", nextAccountId);
      localStorage.setItem(
        "near-wallet-selector:selectedWalletId",
        JSON.stringify("my-near-wallet"),
      );
      localStorage.setItem(
        "near-wallet-selector:recentlySignedInWallets",
        JSON.stringify(["my-near-wallet"]),
      );
    }
  }, accountId);
}

async function openRoute(page: Page, route: string, expectedText: string): Promise<void> {
  await page.goto(`${applicationUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByText(expectedText, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.bringToFront();
  await page.waitForTimeout(200);
  await page.mouse.move(1240, 690);
}

async function launchCleanBrowser(): Promise<{ context: BrowserContext; page: Page }> {
  await access(chromePath);
  await mkdir(browserProfilesDirectory, { recursive: true });
  const profileDirectory = path.join(browserProfilesDirectory, timestampSlug());
  const context = await chromium.launchPersistentContext(profileDirectory, {
    executablePath: chromePath,
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--kiosk",
      "--new-window",
      "--window-position=0,0",
      "--window-size=1280,720",
      "--force-device-scale-factor=1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-notifications",
      "--disable-session-crashed-bubble",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=Translate,MediaRouter",
    ],
  });
  await context.clearCookies();
  const pages = context.pages();
  const page = pages[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", {
    windowId,
    bounds: { windowState: "fullscreen" },
  });
  await page.bringToFront();
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await openRoute(page, "/", "Payroll that keeps its promises.");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Payroll that keeps its promises.", { exact: false }).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page.bringToFront();
  await page.waitForTimeout(400);
  await page.mouse.move(1240, 690);
  return { context, page };
}

function paragraphById(timing: NarrationTiming, id: string): NarrationParagraph {
  const paragraph = timing.paragraphs.find((item) => item.id === id);
  if (!paragraph) throw new Error(`Narration timing is missing the ${id} paragraph.`);
  return paragraph;
}

async function runWalkthrough(
  page: Page,
  timing: NarrationTiming,
  recordingStartedAt: number,
): Promise<void> {
  const waitForNarrationTime = async (seconds: number) => {
    const remaining = recordingStartedAt + (narrationOffsetSeconds + seconds) * 1_000 - performance.now();
    if (remaining > 0) await sleep(remaining);
  };

  const configure = paragraphById(timing, "configure");
  await waitForNarrationTime(configure.startSeconds);
  await seedPublicAccount(page, ownerAccount);
  await openRoute(page, "/setup", "Set the boundaries once.");
  const continueButton = page.getByRole("button", { name: /Continue/u });
  const configureDuration = configure.endSeconds - configure.startSeconds;

  await waitForNarrationTime(configure.startSeconds + configureDuration * 0.3);
  await continueButton.click();
  await page.getByText("Set treasury limits", { exact: false }).waitFor({ state: "visible" });

  await waitForNarrationTime(configure.startSeconds + configureDuration * 0.58);
  await continueButton.click();
  await page.getByText("Add approved recipients", { exact: false }).waitFor({ state: "visible" });

  await waitForNarrationTime(configure.startSeconds + configureDuration * 0.8);
  await continueButton.click();
  await page.getByText("Authorize the payroll agent", { exact: false }).waitFor({ state: "visible" });

  const constrain = paragraphById(timing, "constrain");
  await waitForNarrationTime(constrain.startSeconds);
  await openRoute(page, "/dashboard", "Good morning, owner.");

  const enforce = paragraphById(timing, "enforce");
  await waitForNarrationTime(enforce.startSeconds + 1.2);
  await page.getByText("Your payroll roster", { exact: false }).scrollIntoViewIfNeeded();
  await page.mouse.move(1180, 620);
  await waitForNarrationTime(enforce.startSeconds + (enforce.endSeconds - enforce.startSeconds) * 0.6);
  await page.getByText("Rules engine", { exact: false }).scrollIntoViewIfNeeded();

  const failClosed = paragraphById(timing, "fail-closed");
  await waitForNarrationTime(failClosed.startSeconds);
  await openRoute(page, "/audit", "Proof without payroll exposure.");
  await waitForNarrationTime(failClosed.startSeconds + (failClosed.endSeconds - failClosed.startSeconds) * 0.6);
  const rejectedFilter = page.getByRole("button", { name: "rejected", exact: true });
  if (await rejectedFilter.isVisible()) await rejectedFilter.click();

  const provePrivately = paragraphById(timing, "prove-privately");
  await waitForNarrationTime(
    provePrivately.startSeconds + (provePrivately.endSeconds - provePrivately.startSeconds) * 0.52,
  );
  await seedPublicAccount(page, workerAccount);
  await openRoute(page, "/worker", "Hello, Worker One.");

  const close = paragraphById(timing, "close");
  await waitForNarrationTime(close.startSeconds);
  await seedPublicAccount(page, null);
  await openRoute(page, "/", "Payroll that keeps its promises.");
  await waitForNarrationTime(close.startSeconds + (close.endSeconds - close.startSeconds) * 0.45);
  await page.locator("#architecture").scrollIntoViewIfNeeded();
  await page.mouse.move(1240, 690);

  await waitForNarrationTime(timing.durationSeconds + tailSeconds);
}

async function smokeTest(obs: OBSWebSocket): Promise<void> {
  const muteStates = await configureObs(obs, smokeDirectory);
  let recordingActive = false;
  try {
    await obs.call("StartRecord");
    recordingActive = true;
    await waitForRecordState(obs, true);
    await sleep(3_000);
    const result = await obs.call("StopRecord");
    recordingActive = false;
    await waitForRecordState(obs, false);
    console.log(`OBS smoke recording saved to ${result.outputPath}`);
  } finally {
    if (recordingActive) await obs.call("StopRecord").catch(() => undefined);
    await restoreInputMuteStates(obs, muteStates);
  }
}

async function browserSmokeTest(obs: OBSWebSocket): Promise<void> {
  const { context, page } = await launchCleanBrowser();
  const muteStates = await configureObs(obs, browserSmokeDirectory);
  let recordingActive = false;
  try {
    await page.bringToFront();
    await obs.call("StartRecord");
    recordingActive = true;
    await waitForRecordState(obs, true);
    await sleep(2_000);
    await seedPublicAccount(page, ownerAccount);
    await openRoute(page, "/dashboard", "Good morning, owner.");
    await sleep(3_000);
    await seedPublicAccount(page, workerAccount);
    await openRoute(page, "/worker", "Hello, Worker One.");
    await sleep(3_000);
    const result = await obs.call("StopRecord");
    recordingActive = false;
    await waitForRecordState(obs, false);
    console.log(`OBS browser smoke recording saved to ${result.outputPath}`);
  } finally {
    if (recordingActive) await obs.call("StopRecord").catch(() => undefined);
    await restoreInputMuteStates(obs, muteStates);
    await context.close();
  }
}

async function recordDemo(obs: OBSWebSocket): Promise<void> {
  const timing = JSON.parse(await readFile(narrationTimingPath, "utf8")) as NarrationTiming;
  if (!Number.isFinite(timing.durationSeconds) || timing.durationSeconds <= 0) {
    throw new Error("Narration timing is invalid. Run npm run demo:narration first.");
  }

  const { context, page } = await launchCleanBrowser();
  const muteStates = await configureObs(obs, rawVideoDirectory);
  let recordingActive = false;
  try {
    await obs.call("StartRecord");
    recordingActive = true;
    await waitForRecordState(obs, true);
    const recordingStartedAt = performance.now();
    await runWalkthrough(page, timing, recordingStartedAt);
    const result = await obs.call("StopRecord");
    recordingActive = false;
    await waitForRecordState(obs, false);

    const outputPath = path.resolve(result.outputPath);
    const expectedRoot = path.resolve(rawVideoDirectory) + path.sep;
    if (!outputPath.toLowerCase().startsWith(expectedRoot.toLowerCase())) {
      throw new Error(`OBS saved outside the expected raw video directory: ${outputPath}`);
    }

    await mkdir(path.dirname(recordingManifestPath), { recursive: true });
    await writeFile(
      recordingManifestPath,
      `${JSON.stringify(
        {
          version: 1,
          recordedAt: new Date().toISOString(),
          recordingFile: path.basename(outputPath),
          narrationOffsetSeconds,
          tailSeconds,
          sourceScene: obsScene,
          sourceName: obsSource,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    console.log(`Original OBS walkthrough saved to ${outputPath}`);
    console.log(`Recording manifest saved to ${recordingManifestPath}`);
  } finally {
    if (recordingActive) await obs.call("StopRecord").catch(() => undefined);
    await restoreInputMuteStates(obs, muteStates);
    await context.close();
  }
}

async function main(): Promise<void> {
  const smoke = process.argv.includes("--smoke");
  const browserSmoke = process.argv.includes("--browser-smoke");
  const obs = new OBSWebSocket();
  try {
    const version = await obs.connect(obsUrl, obsPassword, { rpcVersion: 1 });
    console.log(`Connected to OBS ${version.obsWebSocketVersion}.`);
    if (smoke) await smokeTest(obs);
    else if (browserSmoke) await browserSmokeTest(obs);
    else await recordDemo(obs);
  } finally {
    await obs.disconnect().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown recording error.";
  console.error(`Demo recording failed: ${message}`);
  process.exitCode = 1;
});
