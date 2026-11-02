import type { ReactNode } from "react";

import { MarketingHeader } from "./MarketingHeader";
import { SiteFooter } from "./SiteFooter";

export interface LegalSection {
  title: string;
  content: ReactNode;
}

export function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen bg-ink text-white">
      <MarketingHeader />
      <main className="bg-canvas px-5 py-16 text-ink lg:px-10 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-none tracking-tight md:text-7xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink/55">{intro}</p>

          <div className="mt-12 grid gap-4">
            {sections.map((section) => (
              <section key={section.title} className="panel p-6 sm:p-8">
                <h2 className="font-display text-2xl font-semibold">{section.title}</h2>
                <div className="mt-3 text-sm leading-7 text-ink/55">{section.content}</div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
