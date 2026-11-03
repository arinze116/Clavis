import { AlertTriangle, RefreshCw } from "lucide-react";

export function LoadingState({ label = "Loading contract state" }: { label?: string }) {
  return (
    <div className="mx-auto min-h-[50vh] max-w-[1180px] px-5 py-14 lg:px-10">
      <p className="sr-only">{label}</p>
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-4 w-28 rounded-full bg-ink/10" />
        <div className="h-14 max-w-xl rounded-2xl bg-ink/10" />
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 rounded-[28px] bg-white/65" />
          ))}
        </div>
        <div className="h-80 rounded-[28px] bg-white/65" />
      </div>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <div className="panel p-9">
        <AlertTriangle className="mx-auto h-9 w-9 text-amber-600" />
        <h2 className="mt-5 font-display text-3xl">Contract unavailable</h2>
        <p className="mt-3 text-sm leading-6 text-ink/55">{message}</p>
        {retry && (
          <button type="button" className="button-primary mt-6" onClick={retry}>
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
