"use client";
import { cloneElement, isValidElement, useEffect, useId, type ReactElement, type ReactNode } from "react";
export function Sheet({ open,title,onClose,onSubmit,submitLabel="Ajouter",children,disableSubmit=false }: { open:boolean; title:string; onClose:()=>void; onSubmit?:()=>void; submitLabel?:string; children:ReactNode; disableSubmit?:boolean }) {
  useEffect(()=>{ if(!open)return; const handler=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();}; document.addEventListener("keydown",handler); document.body.style.overflow="hidden"; return()=>{document.removeEventListener("keydown",handler);document.body.style.overflow="";};},[onClose,open]);
  if(!open)return null;
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)onClose();}}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-grabber"/><header className="sheet-header"><button className="button button-ghost" onClick={onClose}>Annuler</button><strong>{title}</strong>{onSubmit?<button className="button button-ghost" disabled={disableSubmit} onClick={onSubmit}>{submitLabel}</button>:<span/>}</header><div className="sheet-content">{children}</div></section></div>;
}
export function Field({ label,children }: { label:string; children:ReactNode }) {
  const generatedId=useId();
  const controlId=isValidElement(children)?(children.props as {id?:string}).id??generatedId:generatedId;
  const control=isValidElement(children)?cloneElement(children as ReactElement<{id?:string}>,{id:controlId}):children;
  return <div className="field"><label htmlFor={controlId}>{label}</label>{control}</div>;
}
