"use client";

import { Banknote, CircleDollarSign, Copy, PackageCheck, ReceiptText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useBudgyData } from "@/lib/data/data-provider";

export interface QuickActionDefinition { key: string; label: string; href: string; tone: string; icon: typeof CircleDollarSign }

export function quickActionsForContext(options: { budget: boolean; rentals: boolean; businesses: boolean; dubaiStock: boolean }): QuickActionDefinition[] {
  const actions: QuickActionDefinition[] = [];
  if (options.budget) actions.push(
    { key: "expense", label: "Dépense", href: "/budget?action=expense", tone: "purple", icon: CircleDollarSign },
    { key: "income", label: "Revenu", href: "/budget?action=income", tone: "green", icon: TrendingUp },
    { key: "copy-budget", label: "Copier le mois", href: "/budget?action=copy", tone: "purple", icon: Copy },
  );
  if (options.rentals) actions.push({ key: "rent-payment", label: "Paiement loyer", href: "/rentals?action=payment", tone: "cyan", icon: Banknote });
  if (options.businesses && options.dubaiStock) actions.push({ key: "dubai-sale", label: "Vente Dubaï", href: "/business/dubai?action=sale", tone: "orange", icon: PackageCheck });
  if (options.businesses) actions.push({ key: "dubai-expense", label: "Charge Dubaï", href: "/business/dubai?action=expense", tone: "orange", icon: ReceiptText });
  return actions;
}

export function QuickActions() {
  const { data, isModuleOn } = useBudgyData();
  const actions = quickActionsForContext({ budget: isModuleOn("budget"), rentals: isModuleOn("rentals") && data.tenants.length > 0, businesses: isModuleOn("businesses"), dubaiStock: data.dubaiParts.length > 0 });
  if (!actions.length) return null;
  return <section className="quick-actions-section"><div className="section-heading"><h2>Actions rapides</h2><span>Accès direct</span></div><div className="quick-actions-scroll">{actions.map((action) => <Link className={`quick-action quick-${action.tone}`} href={action.href} key={action.key}><span><action.icon size={17} /></span>{action.label}</Link>)}</div></section>;
}
