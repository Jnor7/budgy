import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
export function MetricCard({ icon:Icon, label, value, detail, tone="purple" }: { icon:LucideIcon; label:string; value:string; detail?:string; tone?:"purple"|"green"|"cyan"|"orange" }) {
  return <div className="card-flat stack-sm"><div className={`icon-tile icon-${tone}`}><Icon size={20}/></div><span className="muted small">{label}</span><strong className={`amount ${tone === "green" ? "positive" : tone === "cyan" ? "cyan" : tone === "orange" ? "orange" : "accent"}`}>{value}</strong>{detail && <span className="muted small">{detail}</span>}</div>;
}
export function BubbleHeader({ title, subtitle, action }: { title:string; subtitle:string; action?:ReactNode }) { return <header className="bubble-header"><h1>{title}</h1><p>{subtitle}</p>{action}</header>; }
