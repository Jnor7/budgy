"use client";

import { ArrowLeftRight, Banknote, CircleDollarSign, Copy, PackageCheck, Plane, RefreshCcw, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { Field, FormModal, FormRow, Sheet } from "@/components/ui/modal";
import { AmountField, AnimatedSegmented, DateField, FormSection } from "@/components/ui/premium";
import { V2Avatar } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { entriesForMonth, transactionCategory } from "@/lib/domain/budget";
import { totalDueForMonth } from "@/lib/domain/tenants";
import { eur, fromDateInput, money, monthLabel, toDateInput } from "@/lib/format";
import type { Currency, DubaiMovementType, EntryType, ModuleKey, Tenant } from "@/types/domain";

export type HomeActionKey = "expense" | "income" | "copy-budget" | "rent-payment" | "dubai-sale" | "dubai-cash" | "trip" | "subscription";
export interface QuickActionDefinition { key: HomeActionKey; label: string; tone: string; icon: typeof CircleDollarSign }

export function quickActionsForContext(options: { modules: ModuleKey[]; hasTenants: boolean; hasDubaiParts?: boolean }): QuickActionDefinition[] {
  const active = new Set(options.modules);
  const actions: QuickActionDefinition[] = [];
  if (active.has("budget")) actions.push(
    { key: "expense", label: "Dépense", tone: "purple", icon: CircleDollarSign },
    { key: "income", label: "Revenu", tone: "green", icon: TrendingUp },
    { key: "copy-budget", label: "Copier le mois", tone: "purple", icon: Copy },
  );
  if (active.has("rentals") && options.hasTenants) actions.push({ key: "rent-payment", label: "Paiement loyer", tone: "cyan", icon: Banknote });
  if (active.has("businesses") && options.hasDubaiParts) actions.push({ key: "dubai-sale", label: "Vente Dubaï", tone: "orange", icon: PackageCheck });
  if (active.has("businesses")) actions.push({ key: "dubai-cash", label: "Mouvement cash", tone: "orange", icon: ArrowLeftRight });
  if (active.has("trips")) actions.push({ key: "trip", label: "Ajouter un voyage", tone: "cyan", icon: Plane });
  if (active.has("subscriptions")) actions.push({ key: "subscription", label: "Ajouter un abonnement", tone: "rose", icon: RefreshCcw });
  return actions.slice(0, 6);
}

export function QuickActions() {
  const { data, modules, create, update, remove } = useBudgyData();
  const { showToast } = useToast();
  const [action, setAction] = useState<HomeActionKey>();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString());
  const [tenant, setTenant] = useState<Tenant>();
  const [destination, setDestination] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString());
  const [peopleCount, setPeopleCount] = useState(1);
  const [dueDay, setDueDay] = useState(1);
  const [selectedPart, setSelectedPart] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [currency, setCurrency] = useState<Currency>("AED");
  const [movementType, setMovementType] = useState<DubaiMovementType>("cash_out");
  const actions = quickActionsForContext({ modules, hasTenants: data.tenants.length > 0, hasDubaiParts: data.dubaiParts.length > 0 });
  const today = useMemo(() => new Date(), []);
  const monthEntries = useMemo(() => entriesForMonth(data.budgetEntries, today), [data.budgetEntries, today]);

  const reset = (next?: HomeActionKey) => {
    setTitle(""); setAmount(0); setCategory(""); setDate(new Date().toISOString());
    setEndDate(new Date().toISOString()); setDestination(""); setPeopleCount(1); setDueDay(1); setTenant(undefined);
    setSelectedPart(""); setQuantity(1); setCurrency("AED"); setMovementType("cash_out"); setAction(next);
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
    create("budgetEntries", { title: title.trim(), amount, potentialAmount: 0, type, category: transactionCategory(category), bucket: type === "revenu" ? "Rentrée" : "Variable", scope: "Perso", date, note: "", status: "non" });
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
    create("subscriptions", { title: title.trim(), amount, dueDay, category: transactionCategory(category), systemImage: "", colorHex: "#8b5cf6", scope: "Perso", isActive: true, note: "" });
    setAction(undefined); showToast({ title: "Abonnement ajouté", detail: title, tone: "success" });
  };
  const saveDubaiSale = () => {
    if (!selectedPart || amount <= 0 || quantity <= 0) return;
    create("dubaiSales", { partId: selectedPart, quantity, unitSalePriceAED: amount, currency, date: new Date().toISOString(), customerName: title.trim() || "Client", note: "Ajout rapide" });
    setAction(undefined); showToast({ title: "Vente ajoutée", detail: title.trim() || "Business Dubaï", tone: "success" });
  };
  const saveDubaiCash = () => {
    if (amount <= 0) return;
    create("dubaiCashMovements", { title: title.trim() || "Mouvement cash", amount, currency, date: new Date().toISOString(), type: movementType, category: movementType === "withdrawal" ? "Retrait" : "Cash", note: "Ajout rapide", status: "done" });
    setAction(undefined); showToast({ title: "Mouvement cash enregistré", detail: money(amount, currency), tone: "success" });
  };

  if (!actions.length) return null;
  const budgetType: EntryType = action === "income" ? "revenu" : "depense";
  return <><section className="quick-actions-section"><div className="section-heading"><h2>Actions rapides</h2><span>Sans quitter l’accueil</span></div><div className="quick-actions-scroll">{actions.map((item) => <button className={`quick-action quick-${item.tone}`} onClick={() => reset(item.key)} key={item.key}><span><item.icon size={17} /></span>{item.label}</button>)}</div></section>
    <FormModal open={action === "expense" || action === "income"} title={budgetType === "revenu" ? "Ajouter un revenu" : "Ajouter une dépense"} submitLabel="Enregistrer la transaction" disableSubmit={!title.trim() || amount <= 0} onClose={() => setAction(undefined)} onSubmit={() => saveBudget(budgetType)} icon={budgetType === "revenu" ? TrendingUp : CircleDollarSign} tone={budgetType === "revenu" ? "green" : "red"}><div className="form-grid"><FormSection title="Type"><AnimatedSegmented value={budgetType} options={[{ value: "depense", label: "↓ Dépense" }, { value: "revenu", label: "↑ Revenu" }]} onChange={(type) => setAction(type === "revenu" ? "income" : "expense")} label="Type" /></FormSection><FormSection title="Transaction"><FormRow><Field label="Montant"><AmountField size="modal" value={amount} onChange={setAmount} autoFocus /></Field><Field label="Catégorie"><input className="input" value={category} placeholder="Autre" onChange={(event) => setCategory(event.target.value)} /></Field></FormRow><div className="form-choice-chips" aria-label="Catégories rapides">{["Logement", "Alimentation", "Transport", "Voyage", "Abonnement"].map((item) => <button type="button" className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><Field label="Intitulé"><input className="input" value={title} autoCapitalize="sentences" onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Date"><DateField value={toDateInput(date)} onChange={(v) => setDate(fromDateInput(v))} /></Field></FormSection></div></FormModal>
    <ConfirmDialog open={action === "copy-budget"} title={`Copier le budget de ${monthLabel(today).toLocaleLowerCase("fr-FR")} ?`} detail={`Les transactions de ce mois seront copiées vers ${monthLabel(new Date(today.getFullYear(), today.getMonth() + 1, 1)).toLocaleLowerCase("fr-FR")}. Les doublons exacts seront ignorés.`} confirmLabel="Copier le budget" confirmTone="primary" onCancel={() => setAction(undefined)} onConfirm={copyMonth} />
    <Sheet open={action === "rent-payment" && !tenant} title="Choisir un locataire" onClose={() => setAction(undefined)}><div className="dense-picker">{data.tenants.map((item) => <button className="v2-row" key={item.id} onClick={() => { setTenant(item); const existing = data.rentPayments.find((payment) => payment.tenantId === item.id && payment.month === today.getMonth() + 1 && payment.year === today.getFullYear()); setAmount(existing?.amountReceived ?? 0); }}><V2Avatar name={item.name} /><span className="v2-row-main"><strong>{item.name}</strong><span>Échéance le {item.dueDay}</span></span><Banknote size={18} className="accent" /></button>)}</div></Sheet>
    <FormModal open={action === "rent-payment" && Boolean(tenant)} title="Enregistrer un paiement" submitLabel="Enregistrer le paiement" disableSubmit={!tenant || amount < 0} onClose={() => setAction(undefined)} onSubmit={saveRent} icon={Banknote} tone="cyan"><div className="form-grid">{tenant ? <><div className="selected-person"><V2Avatar name={tenant.name} /><span><strong>{tenant.name}</strong><small>{monthLabel(today)}</small></span></div><Field label="Montant reçu"><AmountField size="modal" value={amount} onChange={setAmount} autoFocus /></Field></> : null}</div></FormModal>
    <FormModal open={action === "dubai-sale"} title="Ajouter une vente Dubaï" submitLabel="Enregistrer la vente" disableSubmit={!selectedPart || amount <= 0 || quantity <= 0} onClose={() => setAction(undefined)} onSubmit={saveDubaiSale} icon={PackageCheck} tone="green"><div className="form-grid"><FormSection title="Vente"><Field label="Référence"><select className="select" value={selectedPart} onChange={(event) => setSelectedPart(event.target.value)}><option value="">Choisir une référence</option>{data.dubaiParts.map((part) => <option value={part.id} key={part.id}>{part.name}</option>)}</select></Field><FormRow><Field label="Prix unitaire"><AmountField size="modal" value={amount} onChange={setAmount} suffix={currency} autoFocus /></Field><Field label="Quantité"><input className="input" type="number" inputMode="numeric" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></Field></FormRow><FormRow><Field label="Client"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Devise"><select className="select" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{(["AED", "EUR", "FCFA", "USD"] as Currency[]).map((item) => <option key={item}>{item}</option>)}</select></Field></FormRow></FormSection></div></FormModal>
    <FormModal open={action === "dubai-cash"} title="Ajouter un mouvement cash" submitLabel="Enregistrer le mouvement" disableSubmit={amount <= 0} onClose={() => setAction(undefined)} onSubmit={saveDubaiCash} icon={ArrowLeftRight} tone="orange"><div className="form-grid"><FormSection title="Mouvement"><Field label="Montant"><AmountField size="modal" value={amount} onChange={setAmount} suffix={currency} autoFocus /></Field><Field label="Intitulé"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><FormRow><Field label="Type"><select className="select" value={movementType} onChange={(event) => setMovementType(event.target.value as DubaiMovementType)}><option value="cash_in">Apport / Cash in</option><option value="cash_out">Décaissement / Cash out</option><option value="withdrawal">Retrait</option></select></Field><Field label="Devise"><select className="select" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{(["AED", "EUR", "FCFA", "USD"] as Currency[]).map((item) => <option key={item}>{item}</option>)}</select></Field></FormRow></FormSection></div></FormModal>
    <FormModal open={action === "trip"} title="Ajouter un voyage" submitLabel="Créer le voyage" disableSubmit={!title.trim() || !destination.trim()} onClose={() => setAction(undefined)} onSubmit={saveTrip} icon={Plane} tone="cyan"><div className="form-grid"><FormSection title="Destination"><FormRow><Field label="Nom du voyage"><input className="input" value={title} autoCapitalize="words" onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Destination"><input className="input" value={destination} autoCapitalize="words" onChange={(event) => setDestination(event.target.value)} /></Field></FormRow></FormSection><FormSection title="Dates et budget"><FormRow><Field label="Début"><DateField value={toDateInput(date)} onChange={(v) => setDate(fromDateInput(v))} /></Field><Field label="Fin"><DateField value={toDateInput(endDate)} onChange={(v) => setEndDate(fromDateInput(v))} /></Field></FormRow><FormRow><Field label="Participants"><input className="input" type="number" inputMode="numeric" min="1" value={peopleCount} onChange={(event) => setPeopleCount(Number(event.target.value))} /></Field><Field label="Budget"><AmountField size="compact" value={amount} onChange={setAmount} /></Field></FormRow></FormSection></div></FormModal>
    <FormModal open={action === "subscription"} title="Ajouter un abonnement" submitLabel="Ajouter l’abonnement" disableSubmit={!title.trim() || amount <= 0} onClose={() => setAction(undefined)} onSubmit={saveSubscription} icon={RefreshCcw} tone="rose"><div className="form-grid"><FormSection title="Abonnement"><Field label="Montant mensuel"><AmountField size="modal" value={amount} onChange={setAmount} autoFocus /></Field><Field label="Nom"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><FormRow><Field label="Catégorie"><input className="input" value={category} placeholder="Autre" onChange={(event) => setCategory(event.target.value)} /></Field><Field label="Jour de prélèvement"><input className="input" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} /></Field></FormRow></FormSection></div></FormModal>
  </>;
}
