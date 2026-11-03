import { timingSafeEqual } from "node:crypto";

import { Client, type ClientChannel } from "ssh2";

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
const MAX_RESPONSE_BYTES = 64 * 1_024;
const UPSTREAM_TIMEOUT_MS = 28_000;

interface UpstreamResponse {
  status: number;
  contentType: string;
  body: string;
}

interface SshBridgeConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
  hostKeySha256: string;
}

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

  const apiKey = process.env.CLAVIS_AGENT_API_KEY?.trim();
  if (!apiKey) {
    response.status(503).json({ error: "Notification linking is not configured" });
    return;
  }

  const body = JSON.stringify(request.body ?? {});
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    response.status(413).json({ error: "Request body is too large" });
    return;
  }

  try {
    const upstream = await forwardNotification(body, apiKey);
    response.status(upstream.status);
    response.setHeader("content-type", upstream.contentType);
    response.send(upstream.body);
  } catch {
    response.status(502).json({ error: "Notification service is temporarily unavailable" });
  }
}

async function forwardNotification(body: string, apiKey: string): Promise<UpstreamResponse> {
  const configuredUrl = process.env.CLAVIS_AGENT_API_URL?.trim();
  if (configuredUrl) return forwardOverHttps(configuredUrl, body, apiKey);

  const ssh = sshBridgeConfig();
  if (ssh) return forwardOverSsh(ssh, body, apiKey);
  throw new Error("No notification transport is configured");
}

async function forwardOverHttps(
  configuredUrl: string,
  body: string,
  apiKey: string,
): Promise<UpstreamResponse> {
  const upstreamTarget = new URL(configuredUrl);
  if (upstreamTarget.protocol !== "https:") throw new Error("HTTPS is required");

  const upstream = await fetch(upstreamTarget, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  return {
    status: upstream.status,
    contentType:
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    body: await upstream.text(),
  };
}

function sshBridgeConfig(): SshBridgeConfig | null {
  const host = process.env.CLAVIS_AGENT_SSH_HOST?.trim();
  const username = process.env.CLAVIS_AGENT_SSH_USER?.trim();
  const privateKey = process.env.CLAVIS_AGENT_SSH_PRIVATE_KEY?.replaceAll("\\n", "\n").trim();
  const hostKeySha256 = process.env.CLAVIS_AGENT_SSH_HOST_KEY_SHA256?.trim().toLowerCase();
  const configuredPort = Number(process.env.CLAVIS_AGENT_SSH_PORT ?? "22");
  if (
    !host ||
    !username ||
    !privateKey ||
    !hostKeySha256 ||
    !/^[a-f0-9]{64}$/.test(hostKeySha256) ||
    !Number.isInteger(configuredPort) ||
    configuredPort < 1 ||
    configuredPort > 65_535
  ) {
    return null;
  }
  return { host, port: configuredPort, username, privateKey, hostKeySha256 };
}

function forwardOverSsh(
  config: SshBridgeConfig,
  body: string,
  apiKey: string,
): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let channel: ClientChannel | null = null;
    let settled = false;
    const finish = (error?: unknown, result?: UpstreamResponse): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel?.destroy();
      client.end();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("Notification bridge closed without a response"));
    };
    const timeout = setTimeout(
      () => finish(new Error("Notification bridge timed out")),
      UPSTREAM_TIMEOUT_MS,
    );

    client
      .once("ready", () => {
        client.forwardOut("127.0.0.1", 0, "127.0.0.1", 8_787, (error, stream) => {
          if (error) return finish(error);
          channel = stream;
          const chunks: Buffer[] = [];
          let responseSize = 0;
          stream.on("data", (chunk: Buffer) => {
            responseSize += chunk.length;
            if (responseSize > MAX_RESPONSE_BYTES) {
              finish(new Error("Notification response exceeded the size limit"));
              return;
            }
            chunks.push(chunk);
          });
          stream.once("error", finish);
          stream.once("end", () => {
            try {
              finish(undefined, parseHttpResponse(Buffer.concat(chunks)));
            } catch (parseError) {
              finish(parseError);
            }
          });

          const requestBody = Buffer.from(body, "utf8");
          const requestHead = Buffer.from(
            [
              "POST /v1/notifications HTTP/1.1",
              "Host: 127.0.0.1:8787",
              `Authorization: Bearer ${apiKey}`,
              "Content-Type: application/json",
              `Content-Length: ${requestBody.length}`,
              "Connection: close",
              "",
              "",
            ].join("\r\n"),
            "utf8",
          );
          stream.end(Buffer.concat([requestHead, requestBody]));
        });
      })
      .once("error", finish)
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey: config.privateKey,
        readyTimeout: 10_000,
        hostHash: "sha256",
        hostVerifier: (fingerprint: string) => secureEqual(fingerprint, config.hostKeySha256),
        algorithms: { serverHostKey: ["ssh-ed25519"] },
      });
  });
}

function parseHttpResponse(value: Buffer): UpstreamResponse {
  const headerEnd = value.indexOf("\r\n\r\n");
  if (headerEnd < 0) throw new Error("Notification bridge returned an invalid HTTP response");
  const headerLines = value.subarray(0, headerEnd).toString("latin1").split("\r\n");
  const statusMatch = headerLines[0]?.match(/^HTTP\/1\.[01] (\d{3})/);
  if (!statusMatch?.[1]) throw new Error("Notification bridge returned an invalid status");

  const headers = new Map<string, string>();
  for (const line of headerLines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  let responseBody = value.subarray(headerEnd + 4);
  if (headers.get("transfer-encoding")?.toLowerCase().includes("chunked")) {
    responseBody = decodeChunkedBody(responseBody);
  } else {
    const contentLength = Number(headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength >= 0) {
      if (responseBody.length < contentLength) {
        throw new Error("Notification bridge returned an incomplete response");
      }
      responseBody = responseBody.subarray(0, contentLength);
    }
  }
  return {
    status: Number(statusMatch[1]),
    contentType: headers.get("content-type") ?? "application/json; charset=utf-8",
    body: responseBody.toString("utf8"),
  };
}

function decodeChunkedBody(value: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < value.length) {
    const lineEnd = value.indexOf("\r\n", offset);
    if (lineEnd < 0) throw new Error("Notification bridge returned invalid chunk framing");
    const sizeValue = value.subarray(offset, lineEnd).toString("ascii").split(";", 1)[0];
    const size = Number.parseInt(sizeValue ?? "", 16);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error("Notification bridge returned an invalid chunk size");
    }
    offset = lineEnd + 2;
    if (size === 0) return Buffer.concat(chunks);
    const chunkEnd = offset + size;
    if (chunkEnd + 2 > value.length || value.subarray(chunkEnd, chunkEnd + 2).toString() !== "\r\n") {
      throw new Error("Notification bridge returned an incomplete chunk");
    }
    chunks.push(value.subarray(offset, chunkEnd));
    offset = chunkEnd + 2;
  }
  throw new Error("Notification bridge returned an unterminated chunked response");
}

function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
