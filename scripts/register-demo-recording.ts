import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const publicRoot = path.join(repositoryRoot, "demo", "remotion", "public");
const videoDirectory = path.join(publicRoot, "video");
const manifestPath = path.join(publicRoot, "data", "recording-manifest.json");

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/gu, "-");
}

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error(
      'Pass the OBS recording path, for example: npm run demo:register-recording -- "C:\\Users\\hp\\Videos\\Clavis.mp4"',
    );
  }

  const sourcePath = path.resolve(argument);
  const sourceStats = await stat(sourcePath);
  if (!sourceStats.isFile() || sourceStats.size < 1_000_000) {
    throw new Error("The recording is missing or unexpectedly small.");
  }

  const extension = path.extname(sourcePath).toLowerCase();
  if (!new Set([".mp4", ".mkv", ".mov", ".webm"]).has(extension)) {
    throw new Error(`Unsupported recording container: ${extension || "none"}`);
  }

  await Promise.all([
    mkdir(videoDirectory, { recursive: true }),
    mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);

  const resolvedVideoDirectory = path.resolve(videoDirectory) + path.sep;
  const alreadyInVideoDirectory = sourcePath
    .toLowerCase()
    .startsWith(resolvedVideoDirectory.toLowerCase());
  const registeredPath = alreadyInVideoDirectory
    ? sourcePath
    : path.join(videoDirectory, `Clavis Manual Walkthrough ${timestampSlug()}${extension}`);

  if (!alreadyInVideoDirectory) {
    // Copy rather than move so the original OBS recording remains untouched.
    await copyFile(sourcePath, registeredPath);
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        recordedAt: new Date().toISOString(),
        recordingFile: path.basename(registeredPath),
        narrationOffsetSeconds: 2,
        tailSeconds: 6,
        sourceScene: "manual-obs-capture",
        sourceName: "fullscreen-chrome",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Registered walkthrough: ${registeredPath}`);
  console.log(`Updated manifest: ${manifestPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown recording registration error.";
  console.error(`Unable to register the demo recording: ${message}`);
  process.exitCode = 1;
});
