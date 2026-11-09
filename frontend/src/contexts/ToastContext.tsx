import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Info,
  LoaderCircle,
  X,
  XCircle,
} from "lucide-react";

export type ToastStatus = "info" | "pending" | "success" | "error";

interface Toast {
  id: string;
  message: string;
  explorerHref?: string;
  status: ToastStatus;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id" | "status"> & { status?: ToastStatus }) => string;
  updateToast: (
    id: string,
    toast: Partial<Omit<Toast, "id">>,
  ) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const scheduleDismiss = useCallback(
    (id: string, status: ToastStatus) => {
      const existing = timers.current.get(id);
      if (existing !== undefined) window.clearTimeout(existing);
      timers.current.delete(id);
      if (status === "pending") return;
      const timer = window.setTimeout(() => dismiss(id), status === "error" ? 10_000 : 7_000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );
  const showToast = useCallback(
    (toast: Omit<Toast, "id" | "status"> & { status?: ToastStatus }) => {
      const id = crypto.randomUUID();
      const status = toast.status ?? "info";
      setToasts((current) => [...current, { ...toast, id, status }]);
      scheduleDismiss(id, status);
      return id;
    },
    [scheduleDismiss],
  );
  const updateToast = useCallback(
    (id: string, toast: Partial<Omit<Toast, "id">>) => {
      let nextStatus: ToastStatus | null = null;
      setToasts((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, ...toast };
          nextStatus = next.status;
          return next;
        }),
      );
      if (nextStatus) scheduleDismiss(id, nextStatus);
    },
    [scheduleDismiss],
  );
  const value = useMemo(
    () => ({ showToast, updateToast, dismissToast: dismiss }),
    [dismiss, showToast, updateToast],
  );

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
            className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-ink px-4 py-3 text-sm text-white shadow-2xl"
          >
            <ToastIcon status={toast.status} />
            <span className="flex-1">{toast.message}</span>
            {toast.explorerHref && (
              <a
                href={toast.explorerHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-acid"
              >
                View on explorer <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
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

function ToastIcon({ status }: { status: ToastStatus }) {
  if (status === "pending") {
    return <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-acid" aria-hidden="true" />;
  }
  if (status === "success") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />;
  }
  if (status === "error") {
    return <XCircle className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />;
  }
  return <Info className="h-4 w-4 shrink-0 text-acid" aria-hidden="true" />;
}
