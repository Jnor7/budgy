"use client";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function SwipeRow({ children, onDelete, onEdit, label }: { children: ReactNode; onDelete: () => void; onEdit?: () => void; label: string }) {
  const id = useId(); const start = useRef(0); const offsetRef = useRef(0); const [offset, setOffset] = useState(0);
  const moveTo = (value: number) => { offsetRef.current = value; setOffset(value); };
  const close = () => moveTo(0);

  useEffect(() => {
    const closeOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) { offsetRef.current = 0; setOffset(0); } };
    window.addEventListener("budgy-swipe-open", closeOther);
    return () => window.removeEventListener("budgy-swipe-open", closeOther);
  }, [id]);

  return <div className={`swipe-row ${offset ? "is-open" : ""}`}>
    <button className="swipe-edit" aria-label={`Modifier ${label}`} onClick={() => { close(); onEdit?.(); }}><Pencil size={18} /><span>Modifier</span></button>
    <button className="swipe-delete" aria-label={`Supprimer ${label}`} onClick={() => { close(); onDelete(); }}><Trash2 size={18} /><span>Supprimer</span></button>
    <div className="swipe-content" style={{ transform: `translateX(${offset}px)` }} onClickCapture={(event) => { if (offsetRef.current !== 0) { event.preventDefault(); event.stopPropagation(); close(); } }} onPointerDown={(event) => { start.current = event.clientX - offsetRef.current; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const delta = event.clientX - start.current; moveTo(Math.max(-88, Math.min(onEdit ? 88 : 0, delta))); }} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); const target = offsetRef.current < -38 ? -88 : offsetRef.current > 38 && onEdit ? 88 : 0; moveTo(target); if (target) window.dispatchEvent(new CustomEvent("budgy-swipe-open", { detail: id })); }} onPointerCancel={close}>{children}</div>
  </div>;
}
