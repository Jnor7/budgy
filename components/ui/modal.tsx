"use client";
import type { LucideIcon } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = useId();
  const controlId = isValidElement(children) ? (children.props as { id?: string }).id ?? generatedId : generatedId;
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id: controlId }) : children;
  return <div className="field"><label htmlFor={controlId}>{label}</label>{control}</div>;
}
