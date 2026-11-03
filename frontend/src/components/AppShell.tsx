import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";
import { SiteFooter } from "./SiteFooter";

const links = [
  { to: "/dashboard", label: "Business" },
  { to: "/worker", label: "Worker" },
  { to: "/audit", label: "Audit log" },
  { to: "/setup", label: "Setup" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto grid h-[76px] max-w-[1440px] grid-cols-[1fr_auto] items-center px-5 md:grid-cols-[1fr_auto_1fr] lg:px-10">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-acid px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">
              Testnet
            </span>
          </div>
          <nav className="hidden items-center gap-1 rounded-full border border-ink/10 bg-white/60 p-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden justify-self-end md:block">
            <WalletButton compact />
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-white md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-ink/10 bg-canvas px-5 pb-5 pt-3 md:hidden">
            <nav className="grid gap-1">
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
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
