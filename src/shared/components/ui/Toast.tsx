"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";

/**
 * Transient feedback.
 *
 * Replaces alert(), which blocked the page, could not be styled, and was being
 * used to report failures of consequential actions - a transaction reversal
 * that did not go through announced itself with a browser dialog.
 */

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Long enough to read an error, short enough not to linger. */
const DISMISS_AFTER_MS = 5000;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId++;
      setToasts((current) => [...current, { id, tone, message }]);
      setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      error: (message: string) => toast(message, "error"),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        aria-live so new messages are announced without stealing focus.
        "assertive" would interrupt whatever the user is doing; these are
        confirmations and failures they can act on at their own pace.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-auto sm:max-w-sm"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONES: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: {
    ring: "border-receivable/30 bg-receivable/10 text-receivable",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l4 4 8-8" />
    ),
  },
  error: {
    ring: "border-danger/30 bg-danger/10 text-danger",
    icon: <path strokeLinecap="round" d="M10 5.5v6M10 14.5h.01" />,
  },
  info: {
    ring: "border-info/30 bg-info/10 text-info",
    icon: <path strokeLinecap="round" d="M10 9v5.5M10 5.5h.01" />,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone = TONES[toast.tone];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3 shadow-lg backdrop-blur-sm animate-fade-in",
        tone.ring
      )}
    >
      <svg
        className="h-4 w-4 mt-px shrink-0"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        {tone.icon}
      </svg>
      <p className="flex-1 text-xs font-medium leading-relaxed">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}
