"use client";
import { TriangleAlert, X, type LucideIcon } from "lucide-react";
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toneStyle, type Tone } from "@/components/ui/v2";

/**
 * Sheet premium partagée par tous les formulaires de saisie/création/modification.
 * Structure fixe : grabber → header (titre + Annuler discret) → icône illustrative
 * optionnelle → contenu défilant → CTA principal fixé en bas (sticky). Changer
 * cette mise en page ici la propage à l'identique dans toute l'application —
 * c'est le point d'unification demandé pour "mêmes hauteurs, mêmes marges,
 * mêmes CTA, mêmes comportements".
 */
export function Sheet({
  open, title, onClose, onSubmit, submitLabel = "Ajouter", children, disableSubmit = false,
  icon: Icon, tone = "purple",
}: {
  open: boolean; title: string; onClose: () => void; onSubmit?: () => void; submitLabel?: string;
  children: ReactNode; disableSubmit?: boolean; icon?: LucideIcon; tone?: Tone;
}) {
  const startY = useRef(0);
  const [dragY, setDragY] = useState(0);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previous = document.body.style.overflow;
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = previous; };
  }, [onClose, open]);
  if (!open) return null;

  return createPortal(
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section
        className="sheet" role="dialog" aria-modal="true" aria-label={title}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        <div
          className="sheet-grabber"
          onPointerDown={(event) => { startY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setDragY(Math.max(0, event.clientY - startY.current)); }}
          onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); if (dragY > 90) onClose(); setDragY(0); }}
        />
        <header className="sheet-header">
          <button className="button button-ghost" onClick={onClose}>Annuler</button>
          <strong>{title}</strong>
          <span />
        </header>
        {Icon ? (
          <div className="sheet-icon-badge" style={toneStyle(tone)}>
            <Icon size={26} strokeWidth={2.1} />
          </div>
        ) : null}
        <div className="sheet-content">{children}</div>
        {onSubmit ? (
          <footer className="sheet-footer">
            <button className="button button-primary sheet-cta" disabled={disableSubmit} onClick={onSubmit}>
              {submitLabel}
            </button>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

/**
 * Modal dédiée aux formulaires de saisie. Contrairement à `Sheet`, elle reste
 * centrée sur mobile, tablette et desktop, avec header/CTA fixes et contenu
 * défilant. Les interactions courtes continuent d'utiliser `Sheet`.
 */
export function FormModal({
  open, title, onClose, onSubmit, submitLabel = "Enregistrer", children,
  disableSubmit = false, icon: Icon, tone = "purple",
}: {
  open: boolean; title: string; onClose: () => void; onSubmit: () => void;
  submitLabel?: string; children: ReactNode; disableSubmit?: boolean;
  icon: LucideIcon; tone?: Tone;
}) {
  const titleId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const closingRef = useRef(false);
  const dirtyRef = useRef(false);
  const confirmCloseRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const setCloseConfirmation = useCallback((value: boolean) => {
    confirmCloseRef.current = value;
    setConfirmClose(value);
  }, []);

  const markDirty = useCallback(() => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  const closeWith = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closingRef.current = false;
      setClosing(false);
      (after ?? onClose)();
    }, 180);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmCloseRef.current) setCloseConfirmation(false);
      else if (dirtyRef.current) setCloseConfirmation(true);
      else closeWith();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKey);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      closingRef.current = false;
      previousFocus.current?.focus();
    };
  }, [closeWith, open, setCloseConfirmation]);

  useEffect(() => {
    if (open) return;
    const resetTimer = window.setTimeout(() => {
      dirtyRef.current = false;
      confirmCloseRef.current = false;
      setDirty(false);
      setConfirmClose(false);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [open]);

  const requestClose = () => {
    if (dirtyRef.current) setCloseConfirmation(true);
    else closeWith();
  };

  const submit = () => {
    dirtyRef.current = false;
    setDirty(false);
    closeWith(onSubmit);
  };

  const discardAndClose = () => {
    dirtyRef.current = false;
    setDirty(false);
    setCloseConfirmation(false);
    closeWith();
  };

  if (!open) return null;
  return createPortal(
    <div className={`form-modal-backdrop ${closing ? "is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) requestClose(); }}>
      <section className={`form-modal form-modal-${tone} ${closing ? "is-closing" : ""}`} data-dirty={dirty || undefined} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="form-modal-header"><h2 id={titleId}>{title}</h2><button type="button" aria-label="Fermer" onClick={requestClose}><X size={18} /></button></header>
        <div className="form-modal-scroll" onInputCapture={markDirty} onChangeCapture={markDirty} onClickCapture={(event) => { const button = (event.target as HTMLElement).closest("button"); if (button && !button.hasAttribute("data-form-dirty-ignore")) markDirty(); }}>
          <div className="form-modal-icon" style={toneStyle(tone)}><Icon size={25} strokeWidth={2.15} /></div>
          {children}
        </div>
        <footer className="form-modal-footer"><button className="button button-primary form-modal-cta" disabled={disableSubmit} onClick={submit}>{submitLabel}</button></footer>
      </section>
      {confirmClose ? <div className="form-leave-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCloseConfirmation(false); }}><section className="form-leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${titleId}-leave`}><span><TriangleAlert size={22} /></span><h3 id={`${titleId}-leave`}>Quitter ce formulaire&nbsp;?</h3><p>Les modifications non enregistrées seront perdues.</p><div><button type="button" className="button button-soft" onClick={() => setCloseConfirmation(false)}>Continuer la saisie</button><button type="button" className="button button-danger" onClick={discardAndClose}>Quitter sans enregistrer</button></div></section></div> : null}
    </div>,
    document.body,
  );
}

export function FormRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`form-row ${className}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = useId();
  const controlId = isValidElement(children) ? (children.props as { id?: string }).id ?? generatedId : generatedId;
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id: controlId }) : children;
  return <div className="field"><label htmlFor={controlId}>{label}</label>{control}</div>;
}
