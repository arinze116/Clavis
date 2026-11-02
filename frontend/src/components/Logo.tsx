import { Link } from "react-router-dom";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-3" aria-label="Clavis home">
      <span
        className={`grid h-9 w-9 place-items-center rounded-full ${
          inverse ? "bg-acid text-ink" : "bg-ink text-acid"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
          <path d="M12 12h8m-2 0v3m-3-3v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className={`font-display text-2xl font-semibold tracking-tight ${inverse ? "text-white" : "text-ink"}`}>
        Clavis
      </span>
    </Link>
  );
}
