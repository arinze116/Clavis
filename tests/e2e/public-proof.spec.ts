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

async function mockPublicContractReads(page: Page, delayMs = 0) {
  const blockHeight = 276_900_000;
  const blockHash = "11111111111111111111111111111111";
  const blockTimestampNanoseconds = "1793845410551148443";
  const values: Record<string, unknown> = {
    contract_version: "0.1.0",
    get_owner: "clavis.testnet",
    get_agent: "clavis-agent.testnet",
    get_daily_limit: "100000000000000000000000000",
    get_daily_spent: "0",
    get_last_reset_timestamp: "1793840000000000000",
    get_per_payment_limit: "20000000000000000000000000",
    get_treasury_balance: "9940000000000000000000000",
    is_paused: false,
    get_pending_native_payment_recovery_at: null,
    get_recipients: [],
    get_audit_log_reverse: [],
    get_anomaly_count: 0,
    get_anomalies: [],
    get_log_count: 0,
  };

  await page.route("**/api/near-rpc", async (route) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const request = route.request().postDataJSON() as {
      id: string | number;
      method: string;
      params?: { method_name?: string };
    };
    if (request.method === "block") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            header: {
              height: blockHeight,
              hash: blockHash,
              timestamp_nanosec: blockTimestampNanoseconds,
            },
          },
        }),
      });
      return;
    }
    const methodName = request.params?.method_name;
    if (request.method !== "query" || !methodName || !(methodName in values)) {
      throw new Error(`Unexpected mocked NEAR RPC request: ${request.method}.${methodName ?? ""}`);
    }
    const encoded = [...new TextEncoder().encode(JSON.stringify(values[methodName]))];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { result: encoded, block_height: blockHeight, block_hash: blockHash },
      }),
    });
  });
  await page.route("https://api-testnet.nearblocks.io/**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) });
  });
}

test("landing page states the public proof boundary", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Payroll that keeps its promises/i })).toBeVisible();
  await expect(page.getByText("Illustrative policy flow", { exact: true })).toBeVisible();
  await expect(page.getByText("Live policy engine", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /What the public evidence proves/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /What the live demo proves/i })).toHaveCount(0);
  await expect(page.getByText("Contract-controlled native NEAR", { exact: true })).toBeVisible();
  await expect(page.getByText("Cross-chain execution", { exact: true })).toBeVisible();
  await expect(page.getByText("Minimized, not confidential", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("footer preserves grouped navigation, resources, and legal destinations", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");

  const footer = page.locator("footer");
  await expect(footer.getByRole("heading", { name: "Platform", exact: true })).toBeVisible();
  await expect(footer.getByRole("heading", { name: "Transparency" })).toBeVisible();
  await expect(footer.getByRole("heading", { name: "Documentation" })).toBeVisible();
  await expect(footer.getByText("Private payroll. Verifiable execution.", { exact: true })).toBeVisible();

  const internalLinks = [
    ["Home", "/"],
    ["Dashboard", "/dashboard"],
    ["Worker Portal", "/worker"],
    ["Audit Log", "/audit"],
    ["Security Evidence", "/security"],
    ["Setup", "/setup"],
    ["Guide", "/guide"],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
  ] as const;

  for (const [label, destination] of internalLinks) {
    await expect(footer.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "href",
      destination,
    );
  }

  const resourceLinks = [
    ["Source code", "https://github.com/arinze116/Clavis"],
    ["Contract on testnet", "https://testnet.nearblocks.io/address/clavis.testnet"],
    ["Follow on X", "https://x.com/useClavis_"],
    ["NEAR Hackathon", "https://nearhackathon.com"],
  ] as const;

  for (const [label, destination] of resourceLinks) {
    const link = footer.getByRole("link", { name: new RegExp(`^${label}`) });
    await expect(link).toHaveAttribute("href", destination);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  const homeLink = footer.getByRole("link", { name: "Home", exact: true });
  await homeLink.focus();
  await expect(homeLink).toBeFocused();
  const outlineStyle = await homeLink.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outlineStyle).not.toBe("none");
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("public dashboard distinguishes native and cross-chain evidence", async ({ page }) => {
  const errors = collectPageErrors(page);
  await mockPublicContractReads(page);

  await page.goto("/dashboard");

  await expect(page.getByText("Live contract evidence", { exact: true })).toBeVisible();
  await expect(page.getByText(/Final block \d+ · block time/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settlement boundary" })).toBeVisible();
  await expect(page.getByText(/contract.*v0\.2\.0|Reading the deployed contract version/i)).toBeVisible();
  await expect(page.getByText(/Cross-chain execution is disabled in this release/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("security page keeps limitations beside the test evidence", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/security");

  await expect(page.getByRole("heading", { name: "Tests first. Claims second." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What this evidence does not claim" })).toBeVisible();
  await expect(page.getByText(/not an independent third-party audit/i)).toBeVisible();
  await expect(page.getByText(/Cross-chain execution is disabled in this release/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("audit copy does not imply transaction confidentiality", async ({ page }) => {
  const errors = collectPageErrors(page);
  await mockPublicContractReads(page, 1_000);

  await page.goto("/audit");

  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Proof without payroll exposure." })).toBeVisible();
  await expect(page.getByText("Minimized audit fields", { exact: true })).toBeVisible();
  await expect(page.getByText(/Final block \d+ · refreshes every 10 seconds/i)).toBeVisible();
  await expect(page.getByText(/Recipient policy and normal transaction data remain public/i)).toBeVisible();
  await expect(page.getByText("No contract decisions yet", { exact: true })).toBeVisible();
  await expect(page.getByText(/your agent will log every decision/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("mobile navigation and proof content remain usable", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPublicContractReads(page, 1_000);

  for (let trial = 0; trial < 6; trial += 1) {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Toggle navigation" }).click();

    const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(
      mobileNavigation.getByRole("link", { name: "Security", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(
      mobileNavigation.getByRole("link", { name: "Guide", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Toggle navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  }
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
