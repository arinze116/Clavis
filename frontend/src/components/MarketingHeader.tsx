import { Link } from "react-router-dom";

import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

export function MarketingHeader({ landing = false }: { landing?: boolean }) {
  const anchorPrefix = landing ? "" : "/";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-acid px-4 py-2 text-sm font-semibold text-ink focus:not-sr-only focus:inline-flex focus:min-h-11 focus:min-w-11 focus:items-center"
      >
        Skip to main content
      </a>
      <header className="relative z-20 mx-auto flex h-24 max-w-[1440px] items-center justify-between px-5 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo inverse />
          <span className="hidden rounded-full bg-acid/15 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-acid min-[360px]:inline-flex">
            Testnet
          </span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex" aria-label="Primary navigation">
          <a href={`${anchorPrefix}#architecture`} className="inline-flex min-h-11 min-w-11 items-center transition hover:text-white">
            Architecture
          </a>
          <Link to="/audit" className="inline-flex min-h-11 min-w-11 items-center transition hover:text-white">
            Public audit
          </Link>
          <Link to="/security" className="inline-flex min-h-11 min-w-11 items-center transition hover:text-white">
            Security
          </Link>
          <Link to="/guide" className="inline-flex min-h-11 min-w-11 items-center transition hover:text-white">
            Guide
          </Link>
        </nav>
        <div className="shrink-0">
          <WalletButton compact />
        </div>
      </header>
    </>
  );
}
