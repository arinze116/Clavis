import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  explorerHref?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 7_000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[100] grid w-[min(390px,calc(100vw-2.5rem))] gap-3"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink px-4 py-3 text-sm text-white shadow-2xl"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-acid" />
            <span className="flex-1">{toast.message}</span>
            {toast.explorerHref && (
              <a
                href={toast.explorerHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-acid"
              >
                View <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-white/45 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
