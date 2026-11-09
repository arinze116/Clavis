export interface TimedWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface CaptionCue {
  startSeconds: number;
  endSeconds: number;
  words: TimedWord[];
}

export interface NarrationParagraph {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface NarrationTiming {
  version: number;
  audioFile: string | null;
  durationSeconds: number;
  paragraphs: NarrationParagraph[];
  captions: CaptionCue[];
}

export interface RecordingManifest {
  version: number;
  recordingFile: string;
  narrationOffsetSeconds: number;
  tailSeconds: number;
  sourceScene: string;
  sourceName: string;
}

export interface ClavisDemoProps {
  [key: string]: unknown;
  timing: NarrationTiming | null;
  recording: RecordingManifest | null;
}
