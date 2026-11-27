import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { AdminActor } from "./adminData";
import { describeError, getErrorCode } from "./errors";

type ToastKind = "success" | "error" | "info";
export type ToastInput = { kind: ToastKind; title: string; detail?: string };
type Toast = ToastInput & { id: string };

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this exact text to confirm (for dangerous actions). */
  requireText?: string;
};

type PendingConfirm = { options: ConfirmOptions; resolve: (ok: boolean) => void };

type SessionValue = {
  actor: AdminActor;
  toast: (toast: ToastInput) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  setActiveDirty: (dirty: boolean) => void;
  handleError: (err: unknown, context: string) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Fake-but-fun git commit hash for success toasts. */
export function commitTitle(message: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hash = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 7);
  return `[main ${hash}] ${message}`;
}

export function useAdminSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return value;
}

export function AdminSessionProvider({
  actor,
  setActiveDirty,
  children,
}: {
  actor: AdminActor;
  setActiveDirty: (dirty: boolean) => void;
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = makeId();
      setToasts((prev) => [...prev.slice(-3), { ...input, id }]);
      window.setTimeout(() => dismiss(id), input.kind === "error" ? 9000 : 5000);
    },
    [dismiss],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const closeConfirm = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const handleError = useCallback(
    (err: unknown, context: string) => {
      const blocked = getErrorCode(err) === "permission-denied";
      toast({
        kind: "error",
        title: blocked ? "Blocked by security rules" : `Could not ${context}`,
        detail: describeError(err),
      });
    },
    [toast],
  );

  const value = useMemo<SessionValue>(
    () => ({ actor, toast, confirm, setActiveDirty, handleError }),
    [actor, toast, confirm, setActiveDirty, handleError],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}

      <div className="adm-toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
          return (
            <div key={t.id} className={`adm-toast adm-toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
              <Icon size={18} aria-hidden="true" />
              <div>
                <strong>{t.title}</strong>
                {t.detail && <p>{t.detail}</p>}
              </div>
              <button type="button" className="adm-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {pending && <ConfirmModal options={pending.options} onClose={closeConfirm} />}
    </SessionContext.Provider>
  );
}

function ConfirmModal({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const locked = Boolean(options.requireText) && typed.trim() !== options.requireText;

  useEffect(() => {
    (options.requireText ? inputRef.current : cancelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options.requireText, onClose]);

  return (
    <div className="adm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="adm-modal" role="alertdialog" aria-modal="true" aria-labelledby="adm-modal-title">
        <div className={`adm-modal-icon${options.danger ? " is-danger" : ""}`}>
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <h2 id="adm-modal-title">{options.title}</h2>
        <p>{options.message}</p>
        {options.requireText && (
          <label className="adm-modal-confirm">
            <span>
              Type <code>{options.requireText}</code> to confirm
            </span>
            <input
              ref={inputRef}
              className="adm-input adm-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !locked) onClose(true);
              }}
            />
          </label>
        )}
        <div className="adm-modal-actions">
          <button ref={cancelRef} type="button" className="adm-btn adm-btn-ghost" onClick={() => onClose(false)}>
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className={`adm-btn ${options.danger ? "adm-btn-danger" : "adm-btn-primary"}`}
            disabled={locked}
            onClick={() => onClose(true)}
          >
            <span>{options.confirmLabel ?? "Confirm"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
