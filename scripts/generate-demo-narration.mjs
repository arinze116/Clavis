import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const defaultInputPath = path.join(repositoryRoot, "demo", "narration", "clavis-hackathon.txt");
const defaultOutputPath = path.resolve(
  repositoryRoot,
  "..",
  "demo-videos",
  "clavis",
  "remotion",
  "public",
  "audio",
  "clavis-hackathon-narration.mp3",
);

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "JBFqnCBsd6RMkjVDRZzb";
const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
const inputPath = path.resolve(process.argv[2] || defaultInputPath);
const outputPath = path.resolve(process.argv[3] || defaultOutputPath);
const maximumAttempts = 4;

class NarrationError extends Error {
  constructor(message, { retryable = false, retryAfterMs = null } = {}) {
    super(message);
    this.name = "NarrationError";
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(attempt, retryAfterMs) {
  if (retryAfterMs !== null) return retryAfterMs;
  return Math.min(1_000 * 2 ** (attempt - 1), 8_000) + Math.floor(Math.random() * 250);
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

async function safeApiMessage(response) {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    const message = typeof detail === "string" ? detail : detail?.message;
    return typeof message === "string" ? message.slice(0, 300) : "The request was rejected.";
  } catch {
    return "The request was rejected.";
  }
}

async function requestNarration(text) {
  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  endpoint.searchParams.set("output_format", "mp3_44100_128");

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.58,
            similarity_boost: 0.78,
            style: 0.22,
            use_speaker_boost: true,
            speed: 0.96,
          },
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const audio = Buffer.from(await response.arrayBuffer());
        if (audio.length < 1_000) {
          throw new NarrationError("ElevenLabs returned an unexpectedly small audio response.");
        }
        return audio;
      }

      const message = await safeApiMessage(response);
      const retryable = response.status === 429 || response.status >= 500;
      const authenticationHint = response.status === 401 || response.status === 403
        ? " Check that ELEVENLABS_API_KEY contains an active API secret, not its key ID."
        : "";
      throw new NarrationError(
        `ElevenLabs request failed with HTTP ${response.status}: ${message}${authenticationHint}`,
        {
          retryable,
          retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
        },
      );
    } catch (error) {
      const normalized = error instanceof NarrationError
        ? error
        : new NarrationError(
            error?.name === "AbortError"
              ? "ElevenLabs request timed out."
              : "Unable to reach the ElevenLabs API.",
            { retryable: true },
          );

      if (!normalized.retryable || attempt === maximumAttempts) throw normalized;
      const delay = retryDelay(attempt, normalized.retryAfterMs);
      console.warn(`Narration request attempt ${attempt} failed; retrying in ${Math.ceil(delay / 1_000)} seconds.`);
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new NarrationError("Narration generation failed after all retry attempts.");
}

async function main() {
  if (!apiKey) {
    throw new NarrationError(
      "ELEVENLABS_API_KEY is not configured. Set it in the process environment before generating narration.",
    );
  }

  const narration = (await readFile(inputPath, "utf8")).trim();
  if (!narration) throw new NarrationError(`Narration script is empty: ${inputPath}`);

  console.log(`Generating Clavis narration from ${path.relative(repositoryRoot, inputPath)}...`);
  const audio = await requestNarration(narration);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, audio);
  console.log(`Narration saved to ${outputPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown narration generation error.";
  console.error(`Narration generation failed: ${message}`);
  process.exitCode = 1;
});
