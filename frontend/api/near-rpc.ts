import { isTestnetRpcUrl } from "../src/utils/nearConfig.js";

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

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params: unknown;
}

export const config = { maxDuration: 20 };

const MAX_REQUEST_BYTES = 32 * 1_024;
const MAX_RESPONSE_BYTES = 2 * 1_024 * 1_024;
const UPSTREAM_TIMEOUT_MS = 5_500;
const ALLOWED_METHODS = new Set(["block", "query", "tx"]);

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

  const body = normalizeRequestBody(request.body);
  if (!body || !isAllowedRpcRequest(body.value)) {
    response.status(400).json({ error: "Invalid or unsupported NEAR RPC request" });
    return;
  }
  if (body.encoded.length > MAX_REQUEST_BYTES) {
    response.status(413).json({ error: "NEAR RPC request is too large" });
    return;
  }

  let lastError: unknown;
  for (const endpoint of upstreamEndpoints(body.value.method)) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body.encoded,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (isRetryableStatus(upstream.status)) {
        lastError = new Error(`NEAR RPC returned HTTP ${upstream.status}`);
        continue;
      }

      const encodedResponse = await boundedResponseBody(upstream);
      if (isDeprecatedRpcResponse(encodedResponse)) {
        lastError = new Error("NEAR RPC endpoint is deprecated");
        continue;
      }
      response.status(upstream.status);
      response.setHeader(
        "content-type",
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      );
      response.send(encodedResponse);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(
    "near_rpc_proxy.failed",
    lastError instanceof Error ? lastError.message : "No NEAR RPC endpoint was available",
  );
  response.status(502).json({ error: "NEAR RPC is temporarily unavailable" });
}

function normalizeRequestBody(
  value: unknown,
): { value: unknown; encoded: string } | null {
  try {
    if (typeof value === "string") {
      return { value: JSON.parse(value) as unknown, encoded: value };
    }
    return { value, encoded: JSON.stringify(value ?? null) };
  } catch {
    return null;
  }
}

function isAllowedRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const request = value as Partial<JsonRpcRequest>;
  if (request.jsonrpc !== "2.0" || !ALLOWED_METHODS.has(request.method ?? "")) return false;
  if (
    request.id !== null &&
    typeof request.id !== "string" &&
    typeof request.id !== "number"
  ) {
    return false;
  }
  return allowedParams(request.method ?? "", request.params);
}

function allowedParams(method: string, value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const params = value as Record<string, unknown>;
  if (method === "block") {
    return params.finality === "final" || typeof params.block_id === "string";
  }
  if (method === "tx") {
    return (
      typeof params.tx_hash === "string" &&
      typeof params.sender_account_id === "string" &&
      params.wait_until === "FINAL"
    );
  }
  if (method !== "query") return false;
  if (params.request_type === "view_account") {
    return (
      typeof params.account_id === "string" &&
      (params.finality === "final" || typeof params.block_id === "string")
    );
  }
  return (
    params.request_type === "call_function" &&
    typeof params.account_id === "string" &&
    typeof params.method_name === "string" &&
    typeof params.args_base64 === "string" &&
    (params.finality === "final" || typeof params.block_id === "string")
  );
}

function upstreamEndpoints(method: string): URL[] {
  const configured = [
    (process.env.CLAVIS_NEAR_TESTNET_RPC_URL ?? process.env.NEAR_RPC_URL)?.trim(),
    "https://test.rpc.fastnear.com",
    ...(method === "tx"
      ? ["https://archival-rpc.testnet.near.org", "https://near-testnet.drpc.org"]
      : ["https://near-testnet.drpc.org", "https://archival-rpc.testnet.near.org"]),
  ];
  const endpoints: URL[] = [];
  const seen = new Set<string>();
  for (const value of configured) {
    if (!value) continue;
    try {
      const endpoint = new URL(value);
      if (
        !isTestnetRpcUrl(endpoint.href) ||
        seen.has(endpoint.href)
      ) {
        continue;
      }
      seen.add(endpoint.href);
      endpoints.push(endpoint);
      if (endpoints.length === 3) break;
    } catch {
      // Ignore malformed operator configuration and retain verified defaults.
    }
  }
  return endpoints;
}

function isDeprecatedRpcResponse(encodedResponse: string): boolean {
  try {
    const value = JSON.parse(encodedResponse) as {
      error?: { code?: unknown; message?: unknown };
    };
    const message = typeof value.error?.message === "string" ? value.error.message : "";
    return value.error?.code === -429 || message.toLowerCase().includes("endpoint is deprecated");
  } catch {
    return false;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function boundedResponseBody(response: Response): Promise<string> {
  const advertisedLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_RESPONSE_BYTES) {
    throw new Error("NEAR RPC response exceeded the size limit");
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("NEAR RPC response exceeded the size limit");
  }
  return new TextDecoder().decode(body);
}
