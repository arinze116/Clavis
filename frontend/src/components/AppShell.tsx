import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { AnomalyNotificationBell } from "./AnomalyNotificationBell";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";
import { SiteFooter } from "./SiteFooter";

const links = [
  { to: "/dashboard", label: "Business" },
  { to: "/worker", label: "Worker" },
  { to: "/audit", label: "Audit log" },
  { to: "/security", label: "Security" },
  { to: "/setup", label: "Setup" },
  { to: "/guide", label: "Guide" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:inline-flex focus:min-h-11 focus:min-w-11 focus:items-center"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto grid h-[76px] max-w-[1440px] grid-cols-[1fr_auto] items-center px-5 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-acid px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">
              Testnet
            </span>
          </div>
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 rounded-full border border-ink/10 bg-white/60 p-1 lg:flex"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 justify-self-end">
            <AnomalyNotificationBell />
            <div className="hidden lg:block">
              <WalletButton compact />
            </div>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-[10px] border border-ink/10 bg-white lg:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-label="Toggle navigation"
              aria-expanded={open}
              aria-controls="mobile-navigation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div
            id="mobile-navigation"
            className="border-t border-ink/10 bg-canvas px-5 pb-5 pt-3 lg:hidden"
          >
            <nav aria-label="Mobile navigation" className="grid gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-2xl px-4 py-3 text-sm font-medium ${isActive ? "bg-ink text-white" : "text-ink/70"}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3"><WalletButton /></div>
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </div>
  );
}
