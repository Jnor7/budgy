"use client";

import { Banknote, CircleDollarSign, Copy, Plane, RefreshCcw, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { Field, Sheet } from "@/components/ui/modal";
import { AnimatedSegmented, FormSection } from "@/components/ui/premium";
import { V2Avatar } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { entriesForMonth } from "@/lib/domain/budget";
import { totalDueForMonth } from "@/lib/domain/tenants";
import { eur, fromDateInput, monthLabel, toDateInput } from "@/lib/format";
import type { EntryType, ModuleKey, Tenant } from "@/types/domain";

export type HomeActionKey = "expense" | "income" | "copy-budget" | "rent-payment" | "trip" | "subscription";
export interface QuickActionDefinition { key: HomeActionKey; label: string; tone: string; icon: typeof CircleDollarSign }

export function quickActionsForContext(options: { modules: ModuleKey[]; hasTenants: boolean }): QuickActionDefinition[] {
  const active = new Set(options.modules);
  const actions: QuickActionDefinition[] = [];
  if (active.has("budget")) actions.push(
    { key: "expense", label: "Dépense", tone: "purple", icon: CircleDollarSign },
    { key: "income", label: "Revenu", tone: "green", icon: TrendingUp },
    { key: "copy-budget", label: "Copier le mois", tone: "purple", icon: Copy },
  );
  if (active.has("rentals") && options.hasTenants) actions.push({ key: "rent-payment", label: "Paiement loyer", tone: "cyan", icon: Banknote });
  if (active.has("trips")) actions.push({ key: "trip", label: "Ajouter un voyage", tone: "cyan", icon: Plane });
  if (active.has("subscriptions")) actions.push({ key: "subscription", label: "Ajouter un abonnement", tone: "orange", icon: RefreshCcw });
  return actions;
}

export function QuickActions() {
  const { data, modules, create, update, remove } = useBudgyData();
  const { showToast } = useToast();
  const [action, setAction] = useState<HomeActionKey>();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Autre");
  const [date, setDate] = useState(() => new Date().toISOString());
  const [tenant, setTenant] = useState<Tenant>();
  const [destination, setDestination] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString());
  const [peopleCount, setPeopleCount] = useState(1);
  const [dueDay, setDueDay] = useState(1);
  const actions = quickActionsForContext({ modules, hasTenants: data.tenants.length > 0 });
  const today = useMemo(() => new Date(), []);
  const monthEntries = useMemo(() => entriesForMonth(data.budgetEntries, today), [data.budgetEntries, today]);

  const reset = (next?: HomeActionKey) => {
    setTitle(""); setAmount(0); setCategory("Autre"); setDate(new Date().toISOString());
    setEndDate(new Date().toISOString()); setDestination(""); setPeopleCount(1); setDueDay(1); setTenant(undefined); setAction(next);
  };
  const copyMonth = () => {
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1); const ids: string[] = [];
    for (const entry of monthEntries) {
      const source = new Date(entry.date); const day = Math.min(source.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
      const exists = data.budgetEntries.some((candidate) => { const candidateDate = new Date(candidate.date); return candidateDate.getFullYear() === target.getFullYear() && candidateDate.getMonth() === target.getMonth() && candidateDate.getDate() === day && candidate.title.trim().toLowerCase() === entry.title.trim().toLowerCase() && candidate.amount === entry.amount && candidate.type === entry.type && candidate.category === entry.category && candidate.bucket === entry.bucket; });
      if (!exists) ids.push(create("budgetEntries", { title: entry.title, amount: entry.amount, potentialAmount: entry.potentialAmount, type: entry.type, category: entry.category, bucket: entry.bucket, scope: entry.scope, note: entry.note, status: "non", date: new Date(target.getFullYear(), target.getMonth(), day, 12).toISOString() }).id);
    }
    setAction(undefined); showToast({ title: `Budget copié vers ${monthLabel(target).toLocaleLowerCase("fr-FR")}`, detail: `${ids.length} élément${ids.length > 1 ? "s" : ""} ajouté${ids.length > 1 ? "s" : ""}.`, tone: "success", actionLabel: ids.length ? "Annuler" : undefined, onAction: () => ids.forEach((id) => remove("budgetEntries", id)) });
  };
  const saveBudget = (type: EntryType) => {
    if (!title.trim() || amount <= 0) return;
    create("budgetEntries", { title: title.trim(), amount, potentialAmount: 0, type, category, bucket: type === "revenu" ? "Rentrée" : "Variable", scope: "Perso", date, note: "", status: "non" });
    setAction(undefined); showToast({ title: type === "revenu" ? "Revenu ajouté" : "Dépense ajoutée", detail: title, tone: "success" });
  };
  const saveRent = () => {
    if (!tenant || amount < 0) return; const month = today.getMonth() + 1; const year = today.getFullYear();
    const due = totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, year, month);
    const existing = data.rentPayments.find((payment) => payment.tenantId === tenant.id && payment.month === month && payment.year === year);
    if (existing) update("rentPayments", existing.id, { amountReceived: amount, isPaid: amount >= due, paidDate: amount > 0 ? new Date().toISOString() : undefined });
    else create("rentPayments", { tenantId: tenant.id, month, year, isPaid: amount >= due, paidDate: amount > 0 ? new Date().toISOString() : undefined, amountDue: due, amountReceived: amount, carryOver: Math.max(due - tenant.monthlyRent, 0), note: "Ajout rapide" });
    setAction(undefined); showToast({ title: "Paiement enregistré", detail: `${tenant.name} · ${eur.format(amount)}`, tone: "success" });
  };
  const saveTrip = () => {
    if (!title.trim() || !destination.trim()) return;
    create("trips", { title: title.trim(), destinationSummary: destination.trim(), startDate: date, endDate, peopleCount, targetBudget: amount, notes: "", isCompleted: false, createdAt: new Date().toISOString(), coverImageUrl: "" });
    setAction(undefined); showToast({ title: "Voyage créé", detail: title, tone: "success" });
  };
  const saveSubscription = () => {
    if (!title.trim() || amount <= 0) return;
    create("subscriptions", { title: title.trim(), amount, dueDay, category, systemImage: "", colorHex: "#8b5cf6", scope: "Perso", isActive: true, note: "" });
    setAction(undefined); showToast({ title: "Abonnement ajouté", detail: title, tone: "success" });
  };

  if (!actions.length) return null;
  const budgetType: EntryType = action === "income" ? "revenu" : "depense";
  return <><section className="quick-actions-section"><div className="section-heading"><h2>Actions rapides</h2><span>Sans quitter l’accueil</span></div><div className="quick-actions-scroll">{actions.map((item) => <button className={`quick-action quick-${item.tone}`} onClick={() => reset(item.key)} key={item.key}><span><item.icon size={17} /></span>{item.label}</button>)}</div></section>
    <Sheet open={action === "expense" || action === "income"} title={budgetType === "revenu" ? "Ajouter un revenu" : "Ajouter une dépense"} submitLabel="Ajouter" disableSubmit={!title.trim() || amount <= 0} onClose={() => setAction(undefined)} onSubmit={() => saveBudget(budgetType)}><div className="transaction-form"><Field label="Montant"><input className="input amount-field" type="number" inputMode="decimal" value={amount || ""} placeholder="0,00 €" autoFocus onChange={(event) => setAmount(Number(event.target.value))} /></Field><AnimatedSegmented value={budgetType} options={[{ value: "revenu", label: "Revenu" }, { value: "depense", label: "Dépense" }]} onChange={(type) => setAction(type === "revenu" ? "income" : "expense")} label="Type" /><FormSection title="Détails"><Field label="Intitulé"><input className="input" value={title} autoCapitalize="sentences" onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Catégorie"><input className="input" value={category} onChange={(event) => setCategory(event.target.value)} /></Field><Field label="Date"><input className="input" type="date" value={toDateInput(date)} onChange={(event) => setDate(fromDateInput(event.target.value))} /></Field></FormSection></div></Sheet>
    <Sheet open={action === "copy-budget"} title="Copier ce budget" onClose={() => setAction(undefined)}><div className="confirm-sheet-content"><span className="v2-empty-icon"><Copy /></span><h2>Copier {monthLabel(today)} ?</h2><p>Les éléments seront ajoutés au mois suivant. Les doublons exacts seront ignorés.</p><button className="button button-primary" onClick={copyMonth}>Copier vers {monthLabel(new Date(today.getFullYear(), today.getMonth() + 1, 1)).toLocaleLowerCase("fr-FR")}</button></div></Sheet>
    <Sheet open={action === "rent-payment"} title={tenant ? "Enregistrer un paiement" : "Choisir un locataire"} submitLabel="Enregistrer" disableSubmit={!tenant || amount < 0} onClose={() => setAction(undefined)} onSubmit={tenant ? saveRent : undefined}>{tenant ? <div className="transaction-form"><div className="selected-person"><V2Avatar name={tenant.name} /><span><strong>{tenant.name}</strong><small>{monthLabel(today)}</small></span></div><Field label="Montant reçu"><input className="input amount-field" type="number" inputMode="decimal" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} /></Field></div> : <div className="dense-picker">{data.tenants.map((item) => <button className="v2-row" key={item.id} onClick={() => { setTenant(item); const existing = data.rentPayments.find((payment) => payment.tenantId === item.id && payment.month === today.getMonth() + 1 && payment.year === today.getFullYear()); setAmount(existing?.amountReceived ?? 0); }}><V2Avatar name={item.name} /><span className="v2-row-main"><strong>{item.name}</strong><span>Échéance le {item.dueDay}</span></span><Banknote size={18} className="accent" /></button>)}</div>}</Sheet>
    <Sheet open={action === "trip"} title="Ajouter un voyage" submitLabel="Créer" disableSubmit={!title.trim() || !destination.trim()} onClose={() => setAction(undefined)} onSubmit={saveTrip}><div className="form-grid"><FormSection title="Destination"><Field label="Nom du voyage"><input className="input" value={title} autoCapitalize="words" onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Destination"><input className="input" value={destination} autoCapitalize="words" onChange={(event) => setDestination(event.target.value)} /></Field></FormSection><FormSection title="Dates"><div className="grid-2"><Field label="Début"><input className="input" type="date" value={toDateInput(date)} onChange={(event) => setDate(fromDateInput(event.target.value))} /></Field><Field label="Fin"><input className="input" type="date" value={toDateInput(endDate)} onChange={(event) => setEndDate(fromDateInput(event.target.value))} /></Field></div></FormSection><div className="grid-2"><Field label="Participants"><input className="input" type="number" inputMode="numeric" min="1" value={peopleCount} onChange={(event) => setPeopleCount(Number(event.target.value))} /></Field><Field label="Budget"><input className="input" type="number" inputMode="decimal" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} /></Field></div></div></Sheet>
    <Sheet open={action === "subscription"} title="Ajouter un abonnement" submitLabel="Ajouter" disableSubmit={!title.trim() || amount <= 0} onClose={() => setAction(undefined)} onSubmit={saveSubscription}><div className="transaction-form"><Field label="Montant mensuel"><input className="input amount-field" type="number" inputMode="decimal" value={amount || ""} placeholder="0,00 €" onChange={(event) => setAmount(Number(event.target.value))} /></Field><FormSection title="Détails"><Field label="Nom"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Catégorie"><input className="input" value={category} onChange={(event) => setCategory(event.target.value)} /></Field><Field label="Jour de prélèvement"><input className="input" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} /></Field></FormSection></div></Sheet>
  </>;
}
