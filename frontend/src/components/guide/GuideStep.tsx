import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import type { GuideSection } from "../../data/guideContent";

interface GuideStepProps {
  section: GuideSection;
  stepNumber: number;
  totalSteps: number;
  previous: GuideSection | null;
  next: GuideSection | null;
  basePath: string;
}

function stepHref(basePath: string, section: GuideSection): string {
  return `${basePath}?step=${encodeURIComponent(section.id)}`;
}

export function GuideStep({
  section,
  stepNumber,
  totalSteps,
  previous,
  next,
  basePath,
}: GuideStepProps) {
  return (
    <article aria-labelledby={`guide-${section.id}-title`}>
      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs font-medium text-moss">
            Step {stepNumber} of {totalSteps}
          </p>
          <p className="text-xs text-ink/45">
            {Math.round((stepNumber / totalSteps) * 100)}% complete
          </p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-label="Guide progress"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={stepNumber}
        >
          <div
            className="h-full origin-left rounded-full bg-moss transition-transform duration-300 motion-reduce:transition-none"
            style={{ transform: `scaleX(${stepNumber / totalSteps})` }}
          />
        </div>
        <h2
          id={`guide-${section.id}-title`}
          className="mt-6 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl"
        >
          {section.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60 sm:text-base sm:leading-7">
          {section.summary}
        </p>
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0">{section.content}</div>
        <GuideVisual section={section} />
      </div>

      {section.action && (
        <div className="mt-8 border-t border-line pt-6">
          {section.action.external ? (
            <a
              className="button-primary"
              href={section.action.to}
              target="_blank"
              rel="noreferrer"
            >
              {section.action.label}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <Link className="button-primary" to={section.action.to}>
              {section.action.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      <nav
        className="mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2"
        aria-label="Guide step navigation"
      >
        {previous ? (
          <Link
            to={stepHref(basePath, previous)}
            className="group rounded-2xl border border-line bg-white p-4 transition-colors hover:border-ink/25"
          >
            <span className="flex items-center gap-2 text-xs text-ink/40">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
            </span>
            <span className="mt-2 block text-sm font-semibold text-ink">{previous.title}</span>
          </Link>
        ) : (
          <Link
            to="/guide"
            className="group rounded-2xl border border-line bg-white p-4 transition-colors hover:border-ink/25"
          >
            <span className="flex items-center gap-2 text-xs text-ink/40">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
            </span>
            <span className="mt-2 block text-sm font-semibold text-ink">Choose another guide</span>
          </Link>
        )}

        {next ? (
          <Link
            to={stepHref(basePath, next)}
            className="group rounded-2xl border border-ink bg-ink p-4 text-white transition-colors hover:bg-moss sm:text-right"
          >
            <span className="flex items-center gap-2 text-xs text-white/45 sm:justify-end">
              Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="mt-2 block text-sm font-semibold">{next.title}</span>
          </Link>
        ) : (
          <Link
            to="/guide"
            className="group rounded-2xl border border-ink bg-ink p-4 text-white transition-colors hover:bg-moss sm:text-right"
          >
            <span className="flex items-center gap-2 text-xs text-white/45 sm:justify-end">
              Complete <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="mt-2 block text-sm font-semibold">Return to all guides</span>
          </Link>
        )}
      </nav>
    </article>
  );
}

function GuideVisual({ section }: { section: GuideSection }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-ink text-white shadow-lift">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-acid" />
        </div>
        <span className="font-mono text-[10px] text-white/40">clavis.testnet</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="font-mono text-[11px] font-medium text-acid">{section.visual.label}</p>
        <h3 className="mt-2 font-display text-2xl font-semibold leading-tight">
          {section.visual.title}
        </h3>
        <div className="mt-6 grid gap-2">
          {section.visual.rows.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className="grid gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="text-xs text-white/45">{row.label}</span>
              <span
                className={`text-xs font-medium sm:text-right ${
                  row.state === "active"
                    ? "text-acid"
                    : row.state === "warning"
                      ? "text-amber-300"
                      : row.state === "muted"
                        ? "text-white/45"
                        : "text-white/80"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-white/45 sm:px-6">
        {section.visual.caption}
      </figcaption>
    </figure>
  );
}
