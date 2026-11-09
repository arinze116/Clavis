import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type {
  CaptionCue,
  ClavisDemoProps,
  NarrationParagraph,
  NarrationTiming,
} from "./types";

const colors = {
  ink: "#11130f",
  canvas: "#f3f0e8",
  acid: "#c8ff62",
  moss: "#315b38",
  white: "#ffffff",
};

const sceneTitles: Record<string, { eyebrow: string; title: string; highlight: string }> = {
  promise: {
    eyebrow: "Contract-controlled native payroll",
    title: "Automation without surrendering control",
    highlight: "Minimized audit · public proof",
  },
  configure: {
    eyebrow: "Policy configured once",
    title: "Caps, schedules, routes, and recipients",
    highlight: "Owner-signed boundaries",
  },
  constrain: {
    eyebrow: "Restricted AI agent",
    title: "One key. One contract. One method.",
    highlight: "request_payment only",
  },
  enforce: {
    eyebrow: "Rules enforced onchain",
    title: "Every request checked independently",
    highlight: "Schedule · cap · treasury · commitment",
  },
  "fail-closed": {
    eyebrow: "Fail closed by design",
    title: "Native funds move only after policy passes",
    highlight: "Callback commits or rolls back",
  },
  "prove-privately": {
    eyebrow: "Minimized public evidence",
    title: "Employer-wide outcomes, not compensation data",
    highlight: "Minimized, not confidential",
  },
  close: {
    eyebrow: "Built on NEAR",
    title: "Enough authority to work. None to break rules.",
    highlight: "Agent → contract → native transfer",
  },
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function activeParagraph(
  timing: NarrationTiming,
  narrationSeconds: number,
): NarrationParagraph | undefined {
  return timing.paragraphs.find(
    (paragraph) =>
      narrationSeconds >= paragraph.startSeconds && narrationSeconds <= paragraph.endSeconds + 0.2,
  );
}

function activeCue(timing: NarrationTiming, narrationSeconds: number): CaptionCue | undefined {
  return timing.captions.find(
    (cue) => narrationSeconds >= cue.startSeconds - 0.08 && narrationSeconds <= cue.endSeconds + 0.12,
  );
}

function KeyMark({ size = 52 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: colors.acid,
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      }}
    >
      <div style={{ position: "relative", width: size * 0.4, height: size * 0.22 }}>
        <div
          style={{
            position: "absolute",
            width: size * 0.18,
            height: size * 0.18,
            border: `${Math.max(2, size * 0.035)}px solid ${colors.ink}`,
            borderRadius: "50%",
            left: 0,
            top: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: size * 0.23,
            height: Math.max(2, size * 0.035),
            background: colors.ink,
            right: 0,
            top: size * 0.09,
          }}
        />
      </div>
    </div>
  );
}

function Caption({ timing, narrationSeconds }: { timing: NarrationTiming; narrationSeconds: number }) {
  const cue = activeCue(timing, narrationSeconds);
  if (!cue) return null;
  const cueProgress = clamp((narrationSeconds - cue.startSeconds) / 0.22);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 52,
        transform: `translate(-50%, ${interpolate(cueProgress, [0, 1], [16, 0])}px)`,
        opacity: cueProgress,
        maxWidth: 1640,
        padding: "18px 28px 20px",
        borderRadius: 26,
        background: "rgba(17, 19, 15, 0.88)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 20px 70px rgba(0,0,0,0.32)",
        color: colors.white,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 42,
        fontWeight: 700,
        letterSpacing: "-0.025em",
        lineHeight: 1.15,
        textAlign: "center",
      }}
    >
      {cue.words.map((word, index) => {
        const active =
          narrationSeconds >= word.startSeconds - 0.04 && narrationSeconds <= word.endSeconds + 0.05;
        return (
          <span
            key={`${word.startSeconds}-${word.text}`}
            style={{
              color: active ? colors.acid : "rgba(255,255,255,0.92)",
              textShadow: active ? "0 0 24px rgba(200,255,98,0.28)" : "none",
              transition: "color 80ms linear",
            }}
          >
            {word.text}
            {index < cue.words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}

function SceneLabel({
  paragraph,
  narrationSeconds,
}: {
  paragraph: NarrationParagraph | undefined;
  narrationSeconds: number;
}) {
  if (!paragraph) return null;
  const content = sceneTitles[paragraph.id];
  if (!content) return null;
  const localSeconds = narrationSeconds - paragraph.startSeconds;
  const entrance = clamp(localSeconds / 0.55);
  const exit = clamp((paragraph.endSeconds - narrationSeconds) / 0.42);
  const opacity = Math.min(entrance, exit);

  return (
    <div
      style={{
        position: "absolute",
        top: 58,
        left: 60,
        width: 660,
        opacity,
        transform: `translateY(${interpolate(entrance, [0, 1], [-14, 0])}px)`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px 10px 12px",
          borderRadius: 999,
          background: "rgba(17,19,15,0.9)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: colors.white,
          boxShadow: "0 16px 44px rgba(0,0,0,0.22)",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 10,
            background: colors.acid,
            boxShadow: "0 0 18px rgba(200,255,98,0.7)",
          }}
        />
        <span
          style={{
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
          }}
        >
          {content.eyebrow}
        </span>
      </div>
    </div>
  );
}

function Highlight({
  paragraph,
  narrationSeconds,
}: {
  paragraph: NarrationParagraph | undefined;
  narrationSeconds: number;
}) {
  if (!paragraph) return null;
  const content = sceneTitles[paragraph.id];
  if (!content) return null;
  const start = paragraph.startSeconds + Math.min(2.2, (paragraph.endSeconds - paragraph.startSeconds) * 0.2);
  const end = Math.min(paragraph.endSeconds - 0.35, start + 4.5);
  if (narrationSeconds < start || narrationSeconds > end) return null;
  const inProgress = clamp((narrationSeconds - start) / 0.35);
  const outProgress = clamp((end - narrationSeconds) / 0.35);
  const opacity = Math.min(inProgress, outProgress);

  return (
    <div
      style={{
        position: "absolute",
        top: 126,
        right: 58,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "17px 22px",
        borderRadius: 22,
        background: colors.acid,
        color: colors.ink,
        opacity,
        transform: `translateX(${interpolate(inProgress, [0, 1], [28, 0])}px)`,
        boxShadow: "0 22px 60px rgba(17,19,15,0.2)",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 22,
        fontWeight: 800,
      }}
    >
      <span style={{ fontSize: 18 }}>✓</span>
      {content.highlight}
    </div>
  );
}

function OpeningTitle({ fps }: { fps: number }) {
  const frame = useCurrentFrame();
  const reveal = spring({ frame, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
  const fade = interpolate(frame, [58, 82], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `rgba(17,19,15,${0.82 * fade})`,
        opacity: fade,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          transform: `translateY(${interpolate(reveal, [0, 1], [34, 0])}px) scale(${interpolate(
            reveal,
            [0, 1],
            [0.96, 1],
          )})`,
          opacity: reveal,
        }}
      >
        <KeyMark size={78} />
        <div>
          <div
            style={{
              color: colors.acid,
              fontFamily: "Consolas, monospace",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Clavis on NEAR
          </div>
          <div
            style={{
              marginTop: 12,
              color: colors.white,
              fontFamily: "Georgia, serif",
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: "-0.045em",
            }}
          >
            Privacy-minimized audit. Public proof.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneWipes({ timing, offsetFrames, fps }: { timing: NarrationTiming; offsetFrames: number; fps: number }) {
  return (
    <>
      {timing.paragraphs.slice(1).map((paragraph, index) => {
        const start = offsetFrames + Math.floor(paragraph.startSeconds * fps) - 7;
        return (
          <Sequence key={paragraph.id} from={Math.max(0, start)} durationInFrames={16}>
            <Wipe alternate={index % 2 === 1} />
          </Sequence>
        );
      })}
    </>
  );
}

function Wipe({ alternate }: { alternate: boolean }) {
  const frame = useCurrentFrame();
  const firstHalf = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const secondHalf = interpolate(frame, [8, 16], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const progress = frame <= 8 ? firstHalf : secondHalf;
  return (
    <AbsoluteFill
      style={{
        background: alternate ? colors.ink : colors.acid,
        transform: `scaleX(${progress})`,
        transformOrigin: frame <= 8 ? "left center" : "right center",
      }}
    />
  );
}

function EndCard({ fps }: { fps: number }) {
  const frame = useCurrentFrame();
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 105, mass: 0.9 } });
  return (
    <AbsoluteFill
      style={{
        background: colors.ink,
        justifyContent: "center",
        alignItems: "center",
        opacity: clamp(frame / 14),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: "rgba(200,255,98,0.1)",
          filter: "blur(80px)",
          transform: `scale(${interpolate(entrance, [0, 1], [0.7, 1])})`,
        }}
      />
      <div
        style={{
          position: "relative",
          textAlign: "center",
          transform: `translateY(${interpolate(entrance, [0, 1], [34, 0])}px)`,
          opacity: entrance,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <KeyMark size={82} />
        </div>
        <div
          style={{
            marginTop: 28,
            color: colors.white,
            fontFamily: "Georgia, serif",
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: "-0.055em",
          }}
        >
          Clavis
        </div>
        <div
          style={{
            marginTop: 16,
            color: "rgba(255,255,255,0.64)",
            fontFamily: "Inter, Arial, sans-serif",
            fontSize: 30,
          }}
        >
          Privacy-minimized, rule-bound payroll automation on NEAR testnet.
        </div>
        <div
          style={{
            marginTop: 34,
            color: colors.acid,
            fontFamily: "Consolas, monospace",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.17em",
            textTransform: "uppercase",
          }}
        >
          Enough authority to work · none to break the rules
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function ClavisDemo({ timing, recording }: ClavisDemoProps) {
  if (!timing || !recording) throw new Error("Clavis demo metadata has not loaded.");
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const narrationOffsetFrames = Math.round(recording.narrationOffsetSeconds * fps);
  const narrationSeconds = (frame - narrationOffsetFrames) / fps;
  const paragraph = activeParagraph(timing, narrationSeconds);
  const endCardStart = narrationOffsetFrames + Math.ceil(timing.durationSeconds * fps);
  const cameraScale = interpolate(frame, [0, durationInFrames], [1.012, 1.028], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const videoStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${cameraScale})`,
    filter: "saturate(1.03) contrast(1.015)",
  };

  return (
    <AbsoluteFill style={{ background: colors.ink, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(`video/${recording.recordingFile}`)}
        volume={0}
        style={videoStyle}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(17,19,15,0.20) 0%, transparent 20%, transparent 70%, rgba(17,19,15,0.36) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 58,
          right: 60,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 16px",
          borderRadius: 999,
          background: "rgba(17,19,15,0.78)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.82)",
          fontFamily: "Consolas, monospace",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 8, background: colors.acid }} />
        NEAR testnet
      </div>

      <SceneLabel paragraph={paragraph} narrationSeconds={narrationSeconds} />
      <Highlight paragraph={paragraph} narrationSeconds={narrationSeconds} />
      <Caption timing={timing} narrationSeconds={narrationSeconds} />
      <SceneWipes timing={timing} offsetFrames={narrationOffsetFrames} fps={fps} />

      <Sequence from={0} durationInFrames={90}>
        <OpeningTitle fps={fps} />
      </Sequence>
      <Sequence from={narrationOffsetFrames}>
        <Audio src={staticFile(`audio/${timing.audioFile}`)} volume={1} />
      </Sequence>
      <Sequence from={endCardStart}>
        <EndCard fps={fps} />
      </Sequence>
    </AbsoluteFill>
  );
}
