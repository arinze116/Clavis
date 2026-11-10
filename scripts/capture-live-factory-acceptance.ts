import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.CLAVIS_ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:4173";
const outputDirectory = path.resolve(
  process.env.CLAVIS_ACCEPTANCE_UI_DIRECTORY ??
    "artifacts/acceptance/clavis-v02-20261110/ui",
);
const viewports = [
  { height: 844, label: "320", width: 320 },
  { height: 812, label: "375", width: 375 },
  { height: 1024, label: "768", width: 768 },
  { height: 900, label: "1024", width: 1024 },
  { height: 1100, label: "1440", width: 1440 },
] as const;

await mkdir(outputDirectory, { recursive: true, mode: 0o755 });
const browser = await chromium.launch({ headless: true });
const results: Array<Record<string, unknown>> = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: viewport.height, width: viewport.width },
    });
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(`${baseUrl}/setup`, { waitUntil: "networkidle" });
    await page
      .getByText(/Factory v0\.2\.0 creates contracts with contract-controlled native NEAR settlement/i)
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
    await page.keyboard.press("Tab");
    const metrics = await page.evaluate(() => {
      const controls = [
        ...document.querySelectorAll("a[href], button, input, select, textarea"),
      ].filter((element) => {
        const rectangle = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rectangle.width > 0 &&
          rectangle.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      });
      return {
        bodyFontSize: getComputedStyle(document.body).fontSize,
        firstFocusText: document.activeElement?.textContent?.trim() ?? "",
        h1Count: document.querySelectorAll("h1").length,
        imagesMissingAlt: [...document.images].filter((image) => !image.hasAttribute("alt"))
          .length,
        lang: document.documentElement.lang,
        mainCount: document.querySelectorAll("main").length,
        overflow: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        targetViolations: controls.filter((element) => {
          const rectangle = element.getBoundingClientRect();
          return rectangle.width < 44 || rectangle.height < 44;
        }).length,
        unnamedButtons: [...document.querySelectorAll("button")].filter(
          (button) => {
            const rectangle = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return (
              rectangle.width > 0 &&
              rectangle.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              !button.textContent?.trim() &&
              !button.getAttribute("aria-label") &&
              !button.getAttribute("title")
            );
          },
        ).length,
      };
    });
    if (metrics.mainCount !== 1 || metrics.h1Count !== 1 || metrics.overflow > 1) {
      throw new Error(`Invalid ${viewport.label}px layout metrics: ${JSON.stringify(metrics)}`);
    }
    if (
      metrics.lang !== "en" ||
      metrics.bodyFontSize !== "16px" ||
      metrics.firstFocusText !== "Skip to main content" ||
      metrics.imagesMissingAlt > 0 ||
      metrics.targetViolations > 0 ||
      metrics.unnamedButtons > 0
    ) {
      throw new Error(
        `Invalid ${viewport.label}px accessibility metrics: ${JSON.stringify(metrics)}`,
      );
    }
    if (browserErrors.length > 0) {
      throw new Error(`Browser errors at ${viewport.label}px: ${browserErrors.join(" | ")}`);
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const screenshot = path.join(outputDirectory, `setup-live-factory-${viewport.label}.png`);
    await page.screenshot({ fullPage: true, path: screenshot });
    results.push({
      browser_errors: browserErrors,
      factory_status: "v0.2.0 active",
      ...metrics,
      screenshot,
      viewport,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const auditPath = path.join(outputDirectory, "audit.json");
await writeFile(
  auditPath,
  `${JSON.stringify({ captured_at: new Date().toISOString(), base_url: baseUrl, results }, null, 2)}\n`,
);
console.log(`Captured live factory responsive acceptance: ${auditPath}`);
