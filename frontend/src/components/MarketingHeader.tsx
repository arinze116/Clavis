import { Link } from "react-router-dom";

import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

export function MarketingHeader({ landing = false }: { landing?: boolean }) {
  const anchorPrefix = landing ? "" : "/";

  return (
    <header className="relative z-20 mx-auto flex h-24 max-w-[1440px] items-center justify-between px-5 lg:px-10">
      <div className="flex items-center gap-3">
        <Logo inverse />
        <span className="rounded-full bg-acid/15 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-acid">
          Testnet
        </span>
      </div>
      <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex" aria-label="Primary navigation">
        <a href={`${anchorPrefix}#architecture`} className="transition hover:text-white">
          Architecture
        </a>
        <Link to="/audit" className="transition hover:text-white">
          Public audit
        </Link>
        <a href={`${anchorPrefix}#security`} className="transition hover:text-white">
          Security
        </a>
      </nav>
      <WalletButton compact />
    </header>
  );
}
