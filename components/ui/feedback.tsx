"use client";

import { Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastOptions {
  title: string;
  detail?: string;
  tone?: "success" | "neutral" | "error";
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastItem extends ToastOptions { id: string }
const ToastContext = createContext<{ showToast: (toast: ToastOptions) => string } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const showToast = useCallback((toast: ToastOptions) => {
    const id = crypto.randomUUID();
    setItems((current) => [...current.slice(-2), { ...toast, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), toast.duration ?? 4200));
    return id;
  }, [dismiss]);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite">{items.map((item) => <div className={`toast toast-${item.tone ?? "neutral"}`} key={item.id}><span className="toast-icon">{item.tone === "success" ? <Check size={17} /> : null}</span><span className="toast-copy"><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}</span>{item.actionLabel ? <button onClick={() => { item.onAction?.(); dismiss(item.id); }}>{item.actionLabel}</button> : null}<button className="toast-close" aria-label="Fermer" onClick={() => dismiss(item.id)}><X size={16} /></button></div>)}</div></ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

export function ConfirmDialog({ open, title, detail, confirmLabel = "Supprimer", confirmTone = "danger", onCancel, onConfirm }: {
  open: boolean; title: string; detail: string; confirmLabel?: string; confirmTone?: "danger" | "primary"; onCancel: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><div className={`confirm-symbol confirm-symbol-${confirmTone}`}>!</div><h2 id="confirm-title">{title}</h2><p>{detail}</p><div className="confirm-actions"><button className="button button-soft" onClick={onCancel}>Annuler</button><button className={`button button-${confirmTone}`} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

export function SuccessState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="success-state"><span><Check size={28} strokeWidth={2.6} /></span><h2>{title}</h2><p>{detail}</p>{action}</div>;
}
