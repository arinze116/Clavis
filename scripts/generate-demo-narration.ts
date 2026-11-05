import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsTimestampResponse {
  audio_base64?: string;
  alignment?: CharacterAlignment;
  normalized_alignment?: CharacterAlignment;
}

interface TimedWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

class NarrationError extends Error {
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    { retryable = false, retryAfterMs = null }: { retryable?: boolean; retryAfterMs?: number | null } = {},
  ) {
    super(message);
    this.name = "NarrationError";
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const defaultInputPath = path.join(repositoryRoot, "demo", "narration", "clavis-hackathon.txt");
const publicRoot = path.join(repositoryRoot, "demo", "remotion", "public");
const defaultAudioPath = path.join(publicRoot, "audio", "clavis-hackathon-narration.mp3");
const defaultTimingPath = path.join(publicRoot, "data", "narration-timing.json");
const paragraphIds = [
  "promise",
  "configure",
  "constrain",
  "enforce",
  "fail-closed",
  "prove-privately",
  "close",
] as const;
const maximumAttempts = 4;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

function retryDelay(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return retryAfterMs;
  return Math.min(1_000 * 2 ** (attempt - 1), 8_000) + Math.floor(Math.random() * 250);
}

async function safeApiMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string | { message?: string } };
    const detail = payload.detail;
    const message = typeof detail === "string" ? detail : detail?.message;
    return typeof message === "string" ? message.slice(0, 240) : "The request was rejected.";
  } catch {
    return "The request was rejected.";
  }
}

function validateAlignment(alignment: CharacterAlignment): void {
  const size = alignment.characters.length;
  if (
    size === 0 ||
    alignment.character_start_times_seconds.length !== size ||
    alignment.character_end_times_seconds.length !== size
  ) {
    throw new NarrationError("ElevenLabs returned incomplete character alignment data.");
  }
}

async function requestNarration(
  text: string,
  apiKey: string,
  voiceId: string,
  modelId: string,
): Promise<{ audio: Buffer; alignment: CharacterAlignment }> {
  const endpoint = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
  );
  endpoint.searchParams.set("output_format", "mp3_44100_128");

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
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
            speed: 0.78,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await safeApiMessage(response);
        const authenticationHint =
          response.status === 401 || response.status === 403
            ? " Check that ELEVENLABS_API_KEY contains an active API secret."
            : "";
        throw new NarrationError(
          `ElevenLabs request failed with HTTP ${response.status}: ${message}${authenticationHint}`,
          {
            retryable: response.status === 429 || response.status >= 500,
            retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
          },
        );
      }

      const payload = (await response.json()) as ElevenLabsTimestampResponse;
      const alignment = payload.alignment ?? payload.normalized_alignment;
      if (!payload.audio_base64 || !alignment) {
        throw new NarrationError("ElevenLabs returned no audio or timestamp alignment.");
      }

      validateAlignment(alignment);
      const audio = Buffer.from(payload.audio_base64, "base64");
      if (audio.length < 1_000) {
        throw new NarrationError("ElevenLabs returned an unexpectedly small audio response.");
      }

      return { audio, alignment };
    } catch (error) {
      const normalized =
        error instanceof NarrationError
          ? error
          : new NarrationError(
              error instanceof Error && error.name === "AbortError"
                ? "ElevenLabs request timed out."
                : "Unable to reach the ElevenLabs API.",
              { retryable: true },
            );

      if (!normalized.retryable || attempt === maximumAttempts) throw normalized;
      const delay = retryDelay(attempt, normalized.retryAfterMs);
      console.warn(
        `Narration request attempt ${attempt} failed; retrying in ${Math.ceil(delay / 1_000)} seconds.`,
      );
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new NarrationError("Narration generation failed after all retry attempts.");
}

function normalizeWithCharacterMap(characters: string[]): { text: string; characterMap: number[] } {
  let text = "";
  const characterMap: number[] = [];
  let pendingSpaceIndex: number | null = null;

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] ?? "";
    if (/\s/u.test(character)) {
      if (text && !text.endsWith(" ")) pendingSpaceIndex = index;
      continue;
    }

    if (pendingSpaceIndex !== null) {
      text += " ";
      characterMap.push(pendingSpaceIndex);
      pendingSpaceIndex = null;
    }
    text += character;
    characterMap.push(index);
  }

  return { text, characterMap };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function buildParagraphTimings(
  narration: string,
  alignment: CharacterAlignment,
): Array<{ id: string; text: string; startSeconds: number; endSeconds: number }> {
  const paragraphs = narration
    .split(/\r?\n\s*\r?\n/u)
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean);

  if (paragraphs.length !== paragraphIds.length) {
    throw new NarrationError(
      `Expected ${paragraphIds.length} narration paragraphs but found ${paragraphs.length}.`,
    );
  }

  const normalized = normalizeWithCharacterMap(alignment.characters);
  let cursor = 0;

  return paragraphs.map((paragraph, index) => {
    const paragraphStart = normalized.text.indexOf(paragraph, cursor);
    if (paragraphStart < 0) {
      throw new NarrationError(`Unable to align narration paragraph ${index + 1} with the audio.`);
    }

    const paragraphEnd = paragraphStart + paragraph.length - 1;
    const firstCharacter = normalized.characterMap[paragraphStart];
    const lastCharacter = normalized.characterMap[paragraphEnd];
    if (firstCharacter === undefined || lastCharacter === undefined) {
      throw new NarrationError(`Narration paragraph ${index + 1} has invalid timing bounds.`);
    }
    cursor = paragraphEnd + 1;

    return {
      id: paragraphIds[index] ?? `paragraph-${index + 1}`,
      text: paragraph,
      startSeconds: alignment.character_start_times_seconds[firstCharacter] ?? 0,
      endSeconds: alignment.character_end_times_seconds[lastCharacter] ?? 0,
    };
  });
}

function buildTimedWords(alignment: CharacterAlignment): TimedWord[] {
  const words: TimedWord[] = [];
  let text = "";
  let firstCharacter = -1;
  let lastCharacter = -1;

  const flush = () => {
    const normalized = text.trim();
    if (normalized && firstCharacter >= 0 && lastCharacter >= firstCharacter) {
      words.push({
        text: normalized,
        startSeconds: alignment.character_start_times_seconds[firstCharacter] ?? 0,
        endSeconds: alignment.character_end_times_seconds[lastCharacter] ?? 0,
      });
    }
    text = "";
    firstCharacter = -1;
    lastCharacter = -1;
  };

  alignment.characters.forEach((character, index) => {
    if (/\s/u.test(character)) {
      flush();
      return;
    }
    if (firstCharacter < 0) firstCharacter = index;
    lastCharacter = index;
    text += character;
  });
  flush();

  return words;
}

function buildCaptionCues(words: TimedWord[]) {
  const cues: Array<{ startSeconds: number; endSeconds: number; words: TimedWord[] }> = [];
  let current: TimedWord[] = [];

  const flush = () => {
    const first = current[0];
    const last = current[current.length - 1];
    if (first && last) {
      cues.push({ startSeconds: first.startSeconds, endSeconds: last.endSeconds, words: current });
    }
    current = [];
  };

  for (const word of words) {
    const first = current[0];
    const wouldBeLong = first ? word.endSeconds - first.startSeconds > 3.4 : false;
    if (current.length >= 7 || wouldBeLong) flush();

    current.push(word);
    if (current.length >= 3 && /[.!?]$/u.test(word.text)) flush();
  }
  flush();

  return cues;
}

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new NarrationError(
      "ELEVENLABS_API_KEY is not configured. Set it in the process environment before generating narration.",
    );
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "JBFqnCBsd6RMkjVDRZzb";
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";
  const inputPath = path.resolve(process.argv[2] || defaultInputPath);
  const audioPath = path.resolve(process.argv[3] || defaultAudioPath);
  const timingPath = path.resolve(process.argv[4] || defaultTimingPath);
  const narration = (await readFile(inputPath, "utf8")).trim();
  if (!narration) throw new NarrationError(`Narration script is empty: ${inputPath}`);

  console.log(`Generating timestamped narration from ${path.relative(repositoryRoot, inputPath)}...`);
  const { audio, alignment } = await requestNarration(narration, apiKey, voiceId, modelId);
  const paragraphs = buildParagraphTimings(narration, alignment);
  const captions = buildCaptionCues(buildTimedWords(alignment));
  const durationSeconds = Math.max(...alignment.character_end_times_seconds);

  await Promise.all([
    mkdir(path.dirname(audioPath), { recursive: true }),
    mkdir(path.dirname(timingPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(audioPath, audio),
    writeFile(
      timingPath,
      `${JSON.stringify(
        {
          version: 1,
          scriptSha256: createHash("sha256").update(narration).digest("hex"),
          audioFile: path.basename(audioPath),
          modelId,
          durationSeconds,
          paragraphs,
          captions,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  console.log(`Narration saved to ${audioPath}`);
  console.log(`Timing data saved to ${timingPath}`);
  console.log(`Narration duration: ${durationSeconds.toFixed(2)} seconds`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown narration generation error.";
  console.error(`Narration generation failed: ${message}`);
  process.exitCode = 1;
});
