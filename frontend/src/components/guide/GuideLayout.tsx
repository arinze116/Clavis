import { BookOpen, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { RoleGuide } from "../../data/guideContent";
import { AppShell } from "../AppShell";
import { GuideStep } from "./GuideStep";

interface GuideLayoutProps {
  guide: RoleGuide;
  basePath: string;
}

export function GuideLayout({ guide, basePath }: GuideLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStep = searchParams.get("step");
  const activeIndex = useMemo(() => {
    const index = guide.sections.findIndex((section) => section.id === requestedStep);
    return index >= 0 ? index : 0;
  }, [guide.sections, requestedStep]);
  const activeSection = guide.sections[activeIndex] ?? guide.sections[0];
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeSection?.id]);

  if (!activeSection) return null;

  function selectStep(id: string) {
    setSearchParams({ step: id });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-5 lg:px-10 lg:py-12">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-ink/45" aria-label="Breadcrumb">
          <Link className="transition-colors hover:text-ink" to="/guide">Guide</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-current="page">{guide.role}</span>
        </nav>

        <header className="mt-7 max-w-4xl">
          <div className="flex items-center gap-3 text-moss">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
            <p className="font-mono text-xs font-medium">{guide.role} guide</p>
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-none tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {guide.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-ink/60">{guide.intro}</p>
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          <aside className="hidden lg:block" aria-label={`${guide.role} guide sections`}>
            <div className="sticky top-28 rounded-2xl border border-line bg-white/70 p-3">
              <p className="px-3 pb-2 pt-1 text-xs font-semibold text-ink/45">In this guide</p>
              <nav className="grid gap-1">
                {guide.sections.map((section, index) => (
                  <Link
                    key={section.id}
                    to={`${basePath}?step=${encodeURIComponent(section.id)}`}
                    aria-current={index === activeIndex ? "step" : undefined}
                    className={`grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2 rounded-xl px-3 py-2.5 text-sm leading-5 transition-colors ${
                      index === activeIndex
                        ? "bg-ink text-white"
                        : "text-ink/60 hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <span className={`font-mono text-[10px] ${index === activeIndex ? "text-acid" : "text-ink/35"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{section.title}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <div className="lg:hidden">
            <label className="block text-xs font-semibold text-ink/55" htmlFor="guide-section-select">
              Guide section
            </label>
            <select
              id="guide-section-select"
              className="field mt-2"
              value={activeSection.id}
              onChange={(event) => selectStep(event.target.value)}
            >
              {guide.sections.map((section, index) => (
                <option key={section.id} value={section.id}>
                  {index + 1}. {section.title}
                </option>
              ))}
            </select>
          </div>

          <section
            ref={contentRef}
            className="mt-6 min-w-0 rounded-2xl border border-line bg-white/75 p-5 shadow-lift outline-none sm:p-7 lg:mt-0 lg:p-9"
            tabIndex={-1}
            aria-live="polite"
          >
            <GuideStep
              section={activeSection}
              stepNumber={activeIndex + 1}
              totalSteps={guide.sections.length}
              previous={guide.sections[activeIndex - 1] ?? null}
              next={guide.sections[activeIndex + 1] ?? null}
              basePath={basePath}
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
