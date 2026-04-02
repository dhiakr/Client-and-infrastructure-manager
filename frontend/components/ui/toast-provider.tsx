"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastIcon(tone: ToastTone) {
  if (tone === "success") return CheckCircle2;
  if (tone === "error") return CircleAlert;
  return Info;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!toasts.length) return;

    const timeout = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.slice(1));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [toasts]);

  function pushToast(toast: Omit<Toast, "id">) {
    setToasts((currentToasts) => [...currentToasts, { ...toast, id: Date.now() + Math.random() }]);
  }

  function dismissToast(toastId: number) {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }

  const value: ToastContextValue = {
    pushToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = getToastIcon(toast.tone);

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-2xl border bg-white p-4 shadow-lg shadow-slate-200/70",
                toast.tone === "success" && "border-emerald-200",
                toast.tone === "error" && "border-rose-200",
                toast.tone === "info" && "border-slate-200",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    toast.tone === "success" && "bg-emerald-50 text-emerald-600",
                    toast.tone === "error" && "bg-rose-50 text-rose-600",
                    toast.tone === "info" && "bg-slate-100 text-slate-600",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm text-slate-600">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
