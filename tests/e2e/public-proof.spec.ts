import { expect, test, type Page } from "@playwright/test";

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("landing page states the public proof boundary", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Payroll that keeps its promises/i })).toBeVisible();
  await expect(page.getByText("Illustrative policy flow", { exact: true })).toBeVisible();
  await expect(page.getByText("Live policy engine", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /What the live demo proves/i })).toBeVisible();
  await expect(page.getByText("Native NEAR settlement", { exact: true })).toBeVisible();
  await expect(page.getByText("Filled cross-chain settlement", { exact: true })).toBeVisible();
  await expect(page.getByText("Minimized, not confidential", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("public dashboard distinguishes native and cross-chain evidence", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/dashboard");

  await expect(page.getByText("Live contract evidence", { exact: true })).toBeVisible();
  await expect(page.getByText(/Final block \d+ · block time/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "What the demo proves" })).toBeVisible();
  await expect(page.getByText(/Direct testnet delivery is supported for NEAR routes/i)).toBeVisible();
  await expect(page.getByText(/No filled solver intent is published for this demo/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("security page keeps limitations beside the test evidence", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/security");

  await expect(page.getByRole("heading", { name: "Tests first. Claims second." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What this evidence does not claim" })).toBeVisible();
  await expect(page.getByText(/not an independent third-party audit/i)).toBeVisible();
  await expect(page.getByText(/Cross-chain settlement correctness depends on external solver/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("audit copy does not imply transaction confidentiality", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/audit");

  await expect(page.getByRole("heading", { name: "Proof without payroll exposure." })).toBeVisible();
  await expect(page.getByText("Minimized audit fields", { exact: true })).toBeVisible();
  await expect(page.getByText(/Final block \d+ · refreshes every 10 seconds/i)).toBeVisible();
  await expect(page.getByText(/Recipient policy and normal transaction data remain public/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("mobile navigation and proof content remain usable", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Toggle navigation" }).click();

  const mobileNavigation = page.getByRole("banner");
  await expect(mobileNavigation.getByRole("link", { name: "Security", exact: true })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Guide", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
