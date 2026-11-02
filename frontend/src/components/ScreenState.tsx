import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";

export function LoadingState({ label = "Loading contract state" }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-5">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-moss" />
        <p className="mt-4 text-sm text-ink/55">{label}</p>
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
