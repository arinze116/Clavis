import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { Logo } from "./Logo";

const productLinks = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/audit", label: "Audit Log" },
  { to: "/security", label: "Security Evidence" },
  { to: "/setup", label: "Setup" },
  { to: "/worker", label: "Worker Portal" },
  { to: "/guide", label: "Guide" },
];

const resourceLinks = [
  { href: "https://github.com/arinze116/Clavis", label: "Source code" },
  { href: "https://testnet.nearblocks.io/address/clavis.testnet", label: "Contract on testnet" },
  { href: "https://x.com/useClavis_", label: "Follow on X" },
  { href: "https://nearhackathon.com", label: "NEAR Hackathon" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink px-5 text-white lg:px-10">
      <div className="mx-auto grid max-w-[1360px] gap-12 py-14 md:grid-cols-[1.35fr_0.7fr_1fr] lg:gap-20 lg:py-20">
        <div>
          <Logo inverse />
          <p className="mt-5 text-sm font-medium text-white/70">Privacy-minimized payroll controls on NEAR</p>
          <p className="mt-2 text-sm text-white/40">Built by Arinze · Nigeria → the world</p>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-acid">Product</p>
          <nav className="mt-5 grid gap-3" aria-label="Product links">
            {productLinks.map((link) => (
              <Link key={link.to} to={link.to} className="inline-flex min-h-11 min-w-11 w-fit items-center text-sm text-white/55 transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-acid">Resources</p>
          <nav className="mt-5 grid gap-3" aria-label="Resource links">
            {resourceLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 min-w-11 w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
              >
                {link.label}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto grid max-w-[1360px] gap-3 py-5 text-xs text-white/35 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <p>© 2026 Clavis · MIT License</p>
          <p>Running on NEAR Testnet · Not financial advice</p>
          <p className="md:text-right">
            <Link to="/privacy" className="inline-flex min-h-11 min-w-11 items-center transition hover:text-white">Privacy</Link>
            {" · "}
            <Link to="/terms" className="inline-flex min-h-11 min-w-11 items-center transition hover:text-white">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
