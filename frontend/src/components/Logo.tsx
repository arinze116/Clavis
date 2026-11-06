import { Link } from "react-router-dom";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-3" aria-label="Clavis home">
      <img
        src="/clavis-logo.jpg"
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
        className={`h-10 w-10 rounded-[11px] object-cover ring-1 ${
          inverse ? "ring-white/10" : "ring-ink/10"
        }`}
      />
      <span className={`font-display text-2xl font-semibold tracking-tight ${inverse ? "text-white" : "text-ink"}`}>
        Clavis
      </span>
    </Link>
  );
}
