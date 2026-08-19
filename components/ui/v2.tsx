"use client";

import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const CATEGORY_COLORS: Record<string, string> = {
  revenus: "var(--v2-positive)", fixes: "var(--v2-cat-fixes)", fixe: "var(--v2-cat-fixes)",
  abonnements: "var(--v2-cat-abonnements)", abonnement: "var(--v2-cat-abonnements)",
  variables: "var(--v2-cat-variables)", variable: "var(--v2-cat-variables)",
  loyers: "var(--v2-cat-loyers)", loyer: "var(--v2-cat-loyers)",
  business: "var(--v2-cat-business)", voyages: "var(--v2-cat-voyages)", voyage: "var(--v2-cat-voyages)",
  autres: "var(--v2-cat-autres)", autre: "var(--v2-cat-autres)",
};

const FALLBACK_COLORS = [
  "var(--v2-cat-fixes)", "var(--v2-cat-variables)", "var(--v2-cat-loyers)",
  "var(--v2-cat-abonnements)", "var(--v2-cat-business)", "var(--v2-cat-voyages)",
];

export const categoryColor = (label: string, index = 0) =>
  CATEGORY_COLORS[label.trim().toLocaleLowerCase("fr-FR")] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]!;

const TONE_BACKGROUNDS: Record<string, string> = {
  purple: "#f2ebff", green: "#e3f9ec", cyan: "#e4f6fe", orange: "#fff2de", red: "#ffeced", rose: "#fdf0f6",
};
const TONE_COLORS: Record<string, string> = {
  purple: "var(--v2-violet)", green: "var(--v2-positive)", cyan: "#0ea5e9",
  orange: "#f59e0b", red: "var(--v2-negative)", rose: "#c2477e",
};
export type Tone = keyof typeof TONE_COLORS;

export function V2Card({ children, className = "", as = "section" }: {
  children: ReactNode; className?: string; as?: "section" | "div";
}) {
  const Tag = as;
  return <Tag className={`v2-card ${className}`}>{children}</Tag>;
}

export function V2Tile({ icon: Icon, label, value, detail, tone = "purple" }: {
  icon: LucideIcon; label: string; value: string; detail?: string; tone?: Tone;
}) {
  return (
    <div className="v2-tile">
      <span className="v2-tile-icon" style={{ background: TONE_BACKGROUNDS[tone], color: TONE_COLORS[tone] }}>
        <Icon size={19} />
      </span>
      <span className="v2-tile-label">{label}</span>
      <strong className="v2-tile-value" style={{ color: TONE_COLORS[tone] }}>{value}</strong>
      {detail ? <span className="v2-tile-detail">{detail}</span> : null}
    </div>
  );
}

export function V2Icon({ icon: Icon, tone = "purple", size = 19 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  return (
    <span className="v2-tile-icon" style={{ background: TONE_BACKGROUNDS[tone], color: TONE_COLORS[tone] }}>
      <Icon size={size} />
    </span>
  );
}

export interface DonutSlice { label: string; amount: number; share: number }

/** Donut SVG accessible : chaque part est décrite dans le `title` du groupe. */
export function V2Donut({ slices, centerValue, centerLabel, size = 148, thickness = 20 }: {
  slices: DonutSlice[]; centerValue: string; centerLabel?: string; size?: number; thickness?: number;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Chaque arc part de la fin du précédent : calcul pur en une passe, sans réassignation
  // de variable après le rendu (offset cumulé porté par l'accumulateur du reduce).
  const arcs = slices.reduce<{ items: { label: string; dash: string; dashOffset: number }[]; cursor: number }>(
    (acc, slice) => {
      const length = Math.max(slice.share, 0) * circumference;
      acc.items.push({ label: slice.label, dash: `${length} ${circumference - length}`, dashOffset: -acc.cursor });
      acc.cursor += length;
      return acc;
    },
    { items: [], cursor: 0 },
  ).items;

  return (
    <div className="v2-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`Répartition : ${centerValue}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="#f0eef5" strokeWidth={thickness}
        />
        {slices.map((slice, index) => {
          const arc = arcs[index]!;
          return (
            <circle
              key={slice.label}
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={categoryColor(slice.label, index)} strokeWidth={thickness}
              strokeDasharray={arc.dash} strokeDashoffset={arc.dashOffset} strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="v2-donut-center">
        <strong>{centerValue}</strong>
        {centerLabel ? <span>{centerLabel}</span> : null}
      </div>
    </div>
  );
}

export function V2Avatar({ name, url, large = false }: { name: string; url?: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <span className={`v2-avatar ${large ? "v2-avatar-lg" : ""}`} title={name}>
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar Supabase Storage, taille fixe, next/image inutile ici */}
      {url ? <img src={url} alt="" /> : initials}
    </span>
  );
}

export function V2Empty({ icon: Icon, title, text, action }: {
  icon: LucideIcon; title: string; text: string; action?: ReactNode;
}) {
  return (
    <div className="v2-card v2-empty">
      <span className="v2-empty-icon"><Icon size={27} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function V2Switch({ checked, onChange, label }: {
  checked: boolean; onChange: (next: boolean) => void; label: string;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      className="v2-switch" onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function V2ModuleCard({ icon: Icon, title, text, selected, onToggle, tone = "purple" }: {
  icon: LucideIcon; title: string; text: string; selected: boolean; onToggle: () => void; tone?: Tone;
}) {
  return (
    <button type="button" className="v2-module" aria-pressed={selected} onClick={onToggle}>
      <V2Icon icon={Icon} tone={tone} />
      <span className="v2-module-body">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <span className="v2-check">{selected ? <Check size={14} strokeWidth={3} /> : null}</span>
    </button>
  );
}

export function V2Skeleton({ height = 90 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} />;
}
