"use client";

import { ArrowLeft, Cloud, CloudOff, LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function AppPageHeader({ title, subtitle, backHref, action }: { title: string; subtitle?: string; backHref?: string; action?: ReactNode }) {
  return <header className="app-page-header">{backHref ? <Link className="icon-button" href={backHref} aria-label="Retour"><ArrowLeft size={20} /></Link> : null}<div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action ? <div className="app-page-action">{action}</div> : null}</header>;
}

export function AnimatedSegmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  return <div className="animated-segmented" role="tablist" aria-label={label} style={{ "--segments": options.length, "--selected": selected } as CSSProperties}><i aria-hidden="true" />{options.map((option) => <button type="button" role="tab" aria-selected={value === option.value} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <fieldset className="form-section"><legend>{title}</legend>{hint ? <p>{hint}</p> : null}<div className="form-grid">{children}</div></fieldset>;
}

export function SyncBadge({ status, local }: { status: "idle" | "loading" | "syncing" | "error"; local: boolean }) {
  const Icon = local ? CloudOff : status === "loading" || status === "syncing" ? LoaderCircle : Cloud;
  const label = local ? "Enregistré sur cet appareil" : status === "error" ? "Synchronisation à vérifier" : status === "loading" || status === "syncing" ? "Synchronisation…" : "Synchronisé";
  return <span className={`sync-badge sync-${status}`}><Icon size={14} className={status === "loading" || status === "syncing" ? "spin" : ""} />{label}</span>;
}

export function PremiumEmpty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return <div className="premium-empty"><span><Icon size={28} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}
