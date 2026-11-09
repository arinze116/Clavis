import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface TimedWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

const paragraphIds = [
  "promise",
  "configure",
  "constrain",
  "enforce",
  "fail-closed",
  "prove-privately",
  "close",
] as const;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const narrationPath = path.join(repositoryRoot, "demo", "narration", "clavis-hackathon.txt");
const timingPath = path.join(
  repositoryRoot,
  "demo",
  "remotion",
  "public",
  "data",
  "narration-timing.json",
);
const WORDS_PER_SECOND = 2.7;
const PARAGRAPH_GAP_SECONDS = 0.45;
const MINIMUM_PARAGRAPH_SECONDS = 6.5;

function roundSeconds(value: number): number {
  return Number(value.toFixed(3));
}

function paragraphWords(paragraph: string): string[] {
  return paragraph.trim().split(/\s+/u).filter(Boolean);
}

function buildCaptionCues(words: TimedWord[]) {
  const cues: Array<{ startSeconds: number; endSeconds: number; words: TimedWord[] }> = [];
  let current: TimedWord[] = [];

  const flush = () => {
    const first = current[0];
    const last = current[current.length - 1];
    if (first && last) {
      cues.push({
        startSeconds: first.startSeconds,
        endSeconds: roundSeconds(last.endSeconds + 0.12),
        words: current,
      });
    }
    current = [];
  };

  for (const word of words) {
    current.push(word);
    if (current.length >= 7 || /[.!?]$/u.test(word.text)) flush();
  }
  flush();
  return cues;
}

async function main(): Promise<void> {
  const narration = (await readFile(narrationPath, "utf8")).trim();
  const paragraphs = narration
    .split(/\r?\n\s*\r?\n/u)
    .map((paragraph) => paragraph.trim().replace(/\s+/gu, " "))
    .filter(Boolean);
  if (paragraphs.length !== paragraphIds.length) {
    throw new Error(`Expected ${paragraphIds.length} paragraphs but found ${paragraphs.length}`);
  }

  let cursorSeconds = 0;
  const timedWords: TimedWord[] = [];
  const timedParagraphs = paragraphs.map((text, index) => {
    const words = paragraphWords(text);
    const durationSeconds = Math.max(
      MINIMUM_PARAGRAPH_SECONDS,
      words.length / WORDS_PER_SECOND + 1.2,
    );
    const startSeconds = cursorSeconds;
    const wordWindowSeconds = Math.max(1, durationSeconds - 0.7);
    const wordDurationSeconds = wordWindowSeconds / words.length;
    words.forEach((word, wordIndex) => {
      const wordStart = startSeconds + 0.25 + wordIndex * wordDurationSeconds;
      timedWords.push({
        text: word,
        startSeconds: roundSeconds(wordStart),
        endSeconds: roundSeconds(wordStart + wordDurationSeconds * 0.82),
      });
    });
    const endSeconds = startSeconds + durationSeconds;
    cursorSeconds = endSeconds + PARAGRAPH_GAP_SECONDS;
    return {
      id: paragraphIds[index],
      text,
      startSeconds: roundSeconds(startSeconds),
      endSeconds: roundSeconds(endSeconds),
    };
  });

  const lastParagraph = timedParagraphs[timedParagraphs.length - 1];
  if (!lastParagraph) throw new Error("The source demo narration is empty");
  const timing = {
    version: 1,
    scriptSha256: createHash("sha256").update(narration).digest("hex"),
    audioFile: null,
    presentationMode: "caption-led-source-walkthrough",
    durationSeconds: lastParagraph.endSeconds,
    paragraphs: timedParagraphs,
    captions: buildCaptionCues(timedWords),
  };

  await mkdir(path.dirname(timingPath), { recursive: true });
  await writeFile(timingPath, `${JSON.stringify(timing, null, 2)}\n`, "utf8");
  console.log(
    `Prepared ${timedParagraphs.length} source-demo scenes over ${timing.durationSeconds.toFixed(1)} seconds.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unable to prepare the source demo");
  process.exitCode = 1;
});
