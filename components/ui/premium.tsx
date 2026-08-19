"use client";

import { ArrowLeft, Calendar, Cloud, CloudOff, LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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

const formatAmountRaw = (value: number) => (value ? String(value).replace(".", ",") : "");

/**
 * Champ montant dédié (V2.5.4 §13). Remplace `<input type="number" class="amount-field">` :
 * plus de spinner natif, suffixe de devise réellement séparé du nombre, et une
 * synchronisation propre avec des mises à jour externes (ex. boutons de fraction
 * dans la sheet Paiement) sans jamais écraser une saisie en cours.
 */
export function AmountField({ value, onChange, suffix = "€", size = "hero", placeholder = "0,00", autoFocus, id }: {
  value: number; onChange: (value: number) => void; suffix?: string;
  size?: "hero" | "compact"; placeholder?: string; autoFocus?: boolean; id?: string;
}) {
  const [raw, setRaw] = useState(() => formatAmountRaw(value));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setRaw(formatAmountRaw(value));
  }, [value]);

  return (
    <div className={`amount-input-wrap ${size === "compact" ? "compact" : ""}`}>
      <input
        id={id} type="text" inputMode="decimal" autoComplete="off" autoFocus={autoFocus}
        placeholder={placeholder} value={raw}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setRaw(formatAmountRaw(value)); }}
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9,.]/g, "");
          setRaw(next);
          const parsed = Number(next.replace(",", "."));
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
      <span className="amount-suffix">{suffix}</span>
    </div>
  );
}

/**
 * Wrapper visuel pour `<input type="date">` (V2.5.4 §14) : icône cohérente avec
 * les autres champs, même hauteur/bordure. Le sélecteur natif de l'OS reste
 * utilisé pour la saisie — seul son indicateur visuel par défaut est masqué et
 * remplacé, tout en restant cliquable sur toute la largeur du champ.
 */
export function DateField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  return (
    <div className="date-field">
      <Calendar size={16} className="date-field-icon" aria-hidden="true" />
      <input id={id} className="input" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
