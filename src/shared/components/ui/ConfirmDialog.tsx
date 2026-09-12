"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * Replaces window.confirm for destructive actions.
 *
 * confirm() gave a browser dialog with no context beyond one line of text, no
 * way to name the consequence, and no styling - which is what stood between a
 * user and reversing a financial transaction. This renders a real dialog, so
 * the action being confirmed can be described properly.
 */

interface ConfirmOptions {
  title: string;
  /** What will happen. Worth being concrete for financial actions. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  isDestructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  // Held in a ref so settle() stays stable across renders.
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const entry = { ...options, resolve };
      pendingRef.current = entry;
      setPending(entry);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
    setIsWorking(false);
  }, []);

  const dialog = useMemo(() => {
    if (!pending) return null;

    return (
      <Modal
        isOpen
        onClose={() => settle(false)}
        title={pending.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)} fullWidth>
              {pending.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={pending.isDestructive ? "danger" : "primary"}
              isLoading={isWorking}
              onClick={() => {
                setIsWorking(true);
                settle(true);
              }}
              fullWidth
            >
              {pending.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div className="text-xs text-fg-muted leading-relaxed">{pending.message}</div>
      </Modal>
    );
  }, [pending, isWorking, settle]);

  return { confirm, confirmDialog: dialog };
}
