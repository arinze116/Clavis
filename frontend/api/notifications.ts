interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(value: unknown): void;
  send(value: string): void;
}

export const config = {
  maxDuration: 30,
};

const MAX_BODY_BYTES = 32 * 1_024;

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
): Promise<void> {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const upstreamUrl = process.env.CLAVIS_AGENT_API_URL?.trim();
  const apiKey = process.env.CLAVIS_AGENT_API_KEY?.trim();
  if (!upstreamUrl || !apiKey) {
    response.status(503).json({ error: "Notification linking is not configured" });
    return;
  }
  let upstreamTarget: URL;
  try {
    upstreamTarget = new URL(upstreamUrl);
    if (upstreamTarget.protocol !== "https:") throw new Error("HTTPS is required");
  } catch {
    response.status(503).json({ error: "Notification service URL is invalid" });
    return;
  }

  const body = JSON.stringify(request.body ?? {});
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    response.status(413).json({ error: "Request body is too large" });
    return;
  }

  try {
    const upstream = await fetch(upstreamTarget, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(28_000),
    });
    const result = await upstream.text();
    response.status(upstream.status);
    response.setHeader(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    );
    response.send(result);
  } catch {
    response.status(502).json({ error: "Notification service is temporarily unavailable" });
  }
}
