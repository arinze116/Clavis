import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { Logo } from "./Logo";

const navigationGroups = [
  {
    label: "Platform",
    links: [
      { to: "/", label: "Home" },
      { to: "/dashboard", label: "Dashboard" },
      { to: "/worker", label: "Worker Portal" },
    ],
  },
  {
    label: "Transparency",
    links: [
      { to: "/audit", label: "Audit Log" },
      { to: "/security", label: "Security Evidence" },
    ],
  },
  {
    label: "Documentation",
    links: [
      { to: "/setup", label: "Setup" },
      { to: "/guide", label: "Guide" },
    ],
  },
];

const resourceLinks = [
  { href: "https://github.com/arinze116/Clavis", label: "Source code" },
  { href: "https://testnet.nearblocks.io/address/clavis.testnet", label: "Contract on testnet" },
  { href: "https://x.com/useClavis_", label: "Follow on X" },
  { href: "https://nearhackathon.com", label: "NEAR Hackathon" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink px-5 text-white sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-[1360px] gap-x-12 gap-y-10 py-12 md:grid-cols-2 md:gap-y-12 md:py-14 lg:grid-cols-[1.15fr_1.15fr_0.8fr] lg:gap-x-16 lg:py-16 xl:grid-cols-[1.25fr_1fr_0.75fr] xl:gap-x-24">
        <div className="md:col-span-2 lg:col-span-1">
          <Logo inverse />
          <p className="mt-5 max-w-sm text-base font-medium leading-6 text-white/75">
            Privacy-preserving payroll infrastructure on NEAR.
          </p>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Built by Arinze · Nigeria → the world
          </p>
          <p className="mt-7 font-display text-lg leading-6 text-white/80">
            Private payroll. Verifiable execution.
          </p>
        </div>

        <div>
          <nav
            className="grid grid-cols-2 gap-x-8 gap-y-6"
            aria-label="Platform navigation"
          >
            {navigationGroups.map((group) => (
              <div
                key={group.label}
                className={group.label === "Platform" ? "row-span-2" : undefined}
              >
                <h2
                  className={`font-mono font-semibold uppercase ${
                    group.label === "Platform"
                      ? "text-[11px] tracking-[0.2em] text-acid"
                      : "text-[10px] tracking-[0.16em] text-white/55"
                  }`}
                >
                  {group.label}
                </h2>
                <ul className="mt-2">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="inline-flex min-h-11 min-w-11 w-fit items-center text-sm leading-5 text-white/60 motion-safe:transition-colors motion-safe:duration-150 hover:text-white focus-visible:rounded-sm focus-visible:outline-acid"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div>
          <h2
            id="footer-resources-heading"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-acid"
          >
            Resources
          </h2>
          <nav className="mt-5" aria-labelledby="footer-resources-heading">
            <ul>
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-h-11 min-w-11 w-fit items-center gap-2.5 text-sm leading-5 text-white/60 motion-safe:transition-colors motion-safe:duration-150 hover:text-white focus-visible:rounded-sm focus-visible:outline-acid"
                  >
                    <span>{link.label}</span>
                    <ExternalLink
                      className="h-3.5 w-3.5 shrink-0 text-white/35 motion-safe:transition-colors motion-safe:duration-150 group-hover:text-acid"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto grid max-w-[1360px] gap-x-6 gap-y-2 py-6 text-xs leading-5 text-white/50 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <p>© 2026 Clavis · MIT License</p>
          <p>Deployed on NEAR Testnet · Experimental software</p>
          <nav aria-label="Legal links" className="flex items-center gap-4 md:justify-end">
            <Link
              to="/privacy"
              className="inline-flex min-h-11 min-w-11 items-center motion-safe:transition-colors motion-safe:duration-150 hover:text-white focus-visible:rounded-sm focus-visible:outline-acid"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="inline-flex min-h-11 min-w-11 items-center motion-safe:transition-colors motion-safe:duration-150 hover:text-white focus-visible:rounded-sm focus-visible:outline-acid"
            >
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
