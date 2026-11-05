import { afterEach, describe, expect, it, vi } from "vitest";

import type { NotificationPreferenceStore } from "../notification-preferences.js";
import { NotificationManager } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function manager(): NotificationManager {
  const preferences = {
    get: (accountId: string) =>
      accountId === "owner.testnet" || accountId === "worker.testnet"
        ? {
            accountId,
            email: accountId === "owner.testnet" ? "owner@example.com" : "worker@example.com",
            telegramChatId: accountId === "owner.testnet" ? "123456789" : "987654321",
            updatedAt: "2026-11-03T08:00:00.000Z",
          }
        : null,
  } as unknown as NotificationPreferenceStore;

  return new NotificationManager({
    resendApiKey: "re_test_key",
    resendFromEmail: "Clavis Testnet <onboarding@resend.dev>",
    telegramBotToken: "telegram-token",
    telegramChatId: undefined,
    preferences,
  });
}

describe("NotificationManager", () => {
  it("sends a one-time email code before storing the address", async () => {
    let requestBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = String(init?.body ?? "");
        return new Response(JSON.stringify({ id: "email-id" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await manager().sendEmailVerification({
      accountId: "owner.testnet",
      email: "owner@example.com",
      code: "123456",
    });

    expect(JSON.parse(requestBody)).toMatchObject({
      to: "owner@example.com",
      subject: expect.stringContaining("123456"),
      text: expect.stringContaining("owner.testnet"),
    });
  });

  it("fans a finalized transaction alert out to linked email and Telegram channels", async () => {
    const requests: Array<{ url: string; body: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, body: String(init?.body ?? "") });
        return url.includes("api.resend.com")
          ? new Response(JSON.stringify({ id: "email-id" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          : new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
      }),
    );

    await manager().transactionRecorded({
      accountId: "owner.testnet",
      receiverId: "acme.clavis.testnet",
      transactionHash: "transaction-hash",
      label: "Worker added",
      methodNames: ["add_recipient"],
      details: ["Ada"],
      succeeded: true,
    });

    expect(requests).toHaveLength(2);
    expect(requests.some((request) => request.url.includes("api.resend.com"))).toBe(true);
    const telegram = requests.find((request) => request.url.includes("api.telegram.org"));
    expect(JSON.parse(telegram?.body ?? "{}")).toMatchObject({
      chat_id: "123456789",
      text: expect.stringContaining("Worker added confirmed"),
    });
  });

  it("does not reject the payment flow when one notification provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes("api.resend.com")
          ? new Response(JSON.stringify({ message: "temporary outage" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            })
          : new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
      ),
    );

    await expect(
      manager().transactionRecorded({
        accountId: "owner.testnet",
        receiverId: "acme.clavis.testnet",
        transactionHash: "transaction-hash",
        label: "Payroll limits updated",
        methodNames: ["update_limits"],
        details: [],
        succeeded: true,
      }),
    ).resolves.toBeUndefined();
  });

  it("notifies a linked worker after their confirmed roster addition", async () => {
    const requests: Array<{ url: string; body: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, body: String(init?.body ?? "") });
        return url.includes("api.resend.com")
          ? new Response(JSON.stringify({ id: "email-id" }), { status: 200 })
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    await manager().recipientAdded({
      contractId: "acme.clavis.testnet",
      workerAccountId: "worker.testnet",
      workerName: "Ada",
    });

    const email = requests.find((request) => request.url.includes("api.resend.com"));
    expect(JSON.parse(email?.body ?? "{}")).toMatchObject({
      to: "worker@example.com",
      subject: expect.stringContaining("added"),
    });
    const telegram = requests.find((request) => request.url.includes("api.telegram.org"));
    expect(JSON.parse(telegram?.body ?? "{}")).toMatchObject({
      chat_id: "987654321",
      text: expect.stringContaining("Added to payroll"),
    });
  });
});
