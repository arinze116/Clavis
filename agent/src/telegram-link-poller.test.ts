import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationPreferenceStore } from "./notification-preferences.js";
import { TelegramLinkPoller } from "./telegram-link-poller.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("TelegramLinkPoller", () => {
  it("connects a private chat from the bot start token", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "clavis-telegram-"));
    temporaryDirectories.push(directory);
    const store = new NotificationPreferenceStore(path.join(directory, "preferences.json"));
    await store.load();
    const pairing = await store.createTelegramPairing("owner.testnet", 60_000);
    let updateDelivered = false;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/sendMessage")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (!updateDelivered) {
          updateDelivered = true;
          return new Response(
            JSON.stringify({
              ok: true,
              result: [
                {
                  update_id: 42,
                  message: {
                    text: `/start ${pairing.startToken}`,
                    chat: { id: 123456789, type: "private" },
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      }),
    );

    const poller = new TelegramLinkPoller({ botToken: "telegram-token", store });
    poller.start();
    await vi.waitFor(() => {
      expect(store.get("owner.testnet")).toMatchObject({ telegramChatId: "123456789" });
      expect(store.getTelegramUpdateOffset()).toBe(43);
    });
    poller.stop();
  });
});
