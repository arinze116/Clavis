import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { Logo } from "../components/Logo";

export default function NotFound() {
  return (
    <AppShell>
      <div className="mx-auto grid min-h-[62vh] max-w-3xl place-items-center px-5 py-20 text-center">
        <div>
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="mt-10 font-mono text-sm text-moss">404 · Route not found</p>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight sm:text-7xl">
            Page not found
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/55">
            The page you’re looking for doesn’t exist or has moved.
          </p>
          <Link to="/" className="button-primary mt-8">
            <ArrowLeft className="h-4 w-4" /> Go home
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
