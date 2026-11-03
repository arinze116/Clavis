import type { CalculateMetadataFunction } from "remotion";
import { Composition, staticFile } from "remotion";

import { ClavisDemo } from "./ClavisDemo";
import type { ClavisDemoProps, NarrationTiming, RecordingManifest } from "./types";

export const FPS = 30;

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(staticFile(file));
  if (!response.ok) throw new Error(`Unable to load ${file}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

const calculateMetadata: CalculateMetadataFunction<ClavisDemoProps> = async () => {
  const [timing, recording] = await Promise.all([
    fetchJson<NarrationTiming>("data/narration-timing.json"),
    fetchJson<RecordingManifest>("data/recording-manifest.json"),
  ]);
  const durationSeconds =
    recording.narrationOffsetSeconds + timing.durationSeconds + recording.tailSeconds;

  return {
    durationInFrames: Math.ceil(durationSeconds * FPS),
    defaultCodec: "h264",
    defaultOutName: "clavis-demo-1080p.mp4",
    props: { timing, recording },
  };
};

export function RemotionRoot() {
  return (
    <Composition
      id="ClavisDemo"
      component={ClavisDemo}
      durationInFrames={2_400}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ timing: null, recording: null }}
      calculateMetadata={calculateMetadata}
    />
  );
}
