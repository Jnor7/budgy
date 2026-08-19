"use client";

import { Car, Check, ChevronLeft, ChevronRight, Coins, Copy, House, Plus, ReceiptText, Smartphone, Upload, Utensils, WalletCards, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Sheet } from "@/components/ui/modal";
import { AmountField, AnimatedSegmented, DateField, FormSection } from "@/components/ui/premium";
import { SwipeRow } from "@/components/ui/swipe-row";
import { useToast } from "@/components/ui/feedback";
import { useBudgyData } from "@/lib/data/data-provider";
import { budgetSummary, displayPotential, entriesForMonth } from "@/lib/domain/budget";
import { eur, fromDateInput, monthLabel, shortDate, toDateInput } from "@/lib/format";
import type { BudgetEntry, EntryType } from "@/types/domain";

type Draft = Pick<BudgetEntry, "title" | "amount" | "potentialAmount" | "type" | "category" | "bucket" | "scope" | "date" | "note" | "status">;
const blankDraft = (date: Date, type: EntryType = "depense"): Draft => ({
  title: "", amount: 0, potentialAmount: 0, type, category: "Autre",
  bucket: type === "revenu" ? "Rentrée" : "Variable", scope: "Perso",
  date: date.toISOString(), note: "", status: "non",
});

const iconForEntry = (entry: BudgetEntry): LucideIcon => {
  const label = `${entry.title} ${entry.category} ${entry.bucket}`.toLocaleLowerCase("fr-FR");
  if (entry.type === "revenu") return Coins;
  if (/loyer|logement|maison|appartement/.test(label)) return House;
  if (/abonnement|téléphone|telephone|internet|stream/.test(label)) return Smartphone;
  if (/transport|voiture|essence|train|bus/.test(label)) return Car;
  if (/aliment|course|restaurant|repas/.test(label)) return Utensils;
  return WalletCards;
};

export default function BudgetPage() {
  const { data, ready, create, update, remove } = useBudgyData();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(() => blankDraft(new Date()));
  const [hidden, setHidden] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const actionHandled = useRef(false);
  const { showToast } = useToast();

  const entries = useMemo(() => entriesForMonth(data.budgetEntries, selectedMonth), [data.budgetEntries, selectedMonth]);
  const summary = useMemo(() => budgetSummary(entries), [entries]);
  const confirmedCharges = entries.filter((entry) => entry.type === "depense" && entry.status === "recu" && entry.bucket.toLowerCase().includes("charge")).reduce((sum, entry) => sum + entry.amount, 0);
  const confirmedVariables = Math.max(summary.confirmedExpenses - confirmedCharges, 0);
  const balanceSegments = [summary.confirmedIncome, confirmedCharges, confirmedVariables, Math.max(summary.projectedBalance, 0)];
  const balanceSegmentTotal = balanceSegments.reduce((sum, value) => sum + value, 0) || 1;
  const sections = [
    { title: "Rentrées", tone: "income", type: "revenu" as EntryType, bucket: "Rentrée", items: entries.filter((item) => item.type === "revenu") },
    { title: "Charges", tone: "charge", type: "depense" as EntryType, bucket: "Charge fixe", items: entries.filter((item) => item.type === "depense" && item.bucket.toLowerCase().includes("charge")) },
    { title: "Dépenses", tone: "expense", type: "depense" as EntryType, bucket: "Variable", items: entries.filter((item) => item.type === "depense" && !item.bucket.toLowerCase().includes("charge")) },
  ];

  const dateInMonth = () => new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), Math.min(new Date().getDate(), 28), 12);
  const showCreate = (type: EntryType = "depense", bucket?: string) => { setEditing(undefined); setDraft({ ...blankDraft(dateInMonth(), type), bucket: bucket ?? (type === "revenu" ? "Rentrée" : "Variable") }); setOpen(true); };
  const showEdit = (entry: BudgetEntry) => { setEditing(entry.id); setDraft({ ...entry }); setOpen(true); };
  const save = () => {
    if (!draft.title.trim() || draft.amount <= 0) return;
    if (editing) update("budgetEntries", editing, draft); else create("budgetEntries", draft);
    showToast({ title: editing ? "Transaction modifiée" : "Transaction ajoutée", tone: "success" });
    setOpen(false);
  };
  const moveMonth = (offset: number) => setSelectedMonth((value) => new Date(value.getFullYear(), value.getMonth() + offset, 1));
  const copyNext = () => {
    const target = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    const createdIds: string[] = [];
    for (const entry of entries) {
      const source = new Date(entry.date);
      const day = Math.min(source.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
      const duplicateExists = data.budgetEntries.some((candidate) => {
        const date = new Date(candidate.date);
        return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === day && candidate.title.trim().toLowerCase() === entry.title.trim().toLowerCase() && candidate.amount === entry.amount && candidate.type === entry.type && candidate.category === entry.category && candidate.bucket === entry.bucket;
      });
      if (!duplicateExists) {
        const created = create("budgetEntries", { title: entry.title, amount: entry.amount, potentialAmount: entry.potentialAmount, type: entry.type, category: entry.category, bucket: entry.bucket, scope: entry.scope, note: entry.note, status: "non", date: new Date(target.getFullYear(), target.getMonth(), day, 12).toISOString() });
        createdIds.push(created.id);
      }
    }
    const targetLabel = monthLabel(target).toLocaleLowerCase("fr-FR");
    showToast({ title: `Budget copié vers ${targetLabel}`, detail: `${createdIds.length} élément${createdIds.length > 1 ? "s" : ""} ajouté${createdIds.length > 1 ? "s" : ""}.`, tone: "success", actionLabel: createdIds.length ? "Annuler" : undefined, onAction: () => createdIds.forEach((id) => remove("budgetEntries", id)) });
  };
  const scheduleDelete = (entry: BudgetEntry) => {
    if (deleteTimers.current.has(entry.id)) return;
    setHidden((current) => [...current, entry.id]);
    const timer = setTimeout(() => { remove("budgetEntries", entry.id); deleteTimers.current.delete(entry.id); setHidden((current) => current.filter((id) => id !== entry.id)); }, 4300);
    deleteTimers.current.set(entry.id, timer);
    showToast({ title: "Transaction supprimée", detail: entry.title, actionLabel: "Annuler", duration: 4200, onAction: () => { clearTimeout(timer); deleteTimers.current.delete(entry.id); setHidden((current) => current.filter((id) => id !== entry.id)); } });
  };
  const importCsv = async (file: File) => {
    const text = await file.text(); const lines = text.split(/\r?\n/).filter(Boolean); const headers = (lines.shift() ?? "").split(",").map((item) => item.trim().toLowerCase()); let count = 0;
    for (const line of lines) { const values = line.split(","); const value = (...names: string[]) => { const index = headers.findIndex((header) => names.includes(header)); return index >= 0 ? (values[index] ?? "").trim() : ""; }; const raw = Number(value("montant", "amount").replace(",", ".")); const amount = Math.abs(raw); if (amount > 0) { create("budgetEntries", { ...blankDraft(selectedMonth, raw >= 0 ? "revenu" : "depense"), title: value("description", "libellé", "libelle") || "Import Revolut", amount, category: "Import Revolut", date: value("date", "datedefin") ? new Date(value("date", "datedefin")).toISOString() : selectedMonth.toISOString() }); count += 1; } }
    showToast({ title: "Import terminé", detail: `${count} transaction${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}.`, tone: "success" });
  };

  useEffect(() => {
    if (!ready || actionHandled.current) return;
    const timer = window.setTimeout(() => { actionHandled.current = true; const action = new URLSearchParams(window.location.search).get("action"); if (action === "income") showCreate("revenu"); else if (action === "expense") showCreate("depense"); else if (action === "copy") copyNext(); }, 0);
    return () => window.clearTimeout(timer);
    // L'action initiale est volontairement évaluée une seule fois après le chargement des données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return <main className="page finance-page"><div className="skeleton" style={{ height: 70 }} /><div className="skeleton" style={{ height: 180 }} /><div className="skeleton" /></main>;

  return <main className="page finance-page">
    <section className="month-control" aria-label="Mois du budget">
      <button className="icon-button" onClick={() => moveMonth(-1)} aria-label="Mois précédent"><ChevronLeft /></button>
      <strong key={selectedMonth.toISOString()} className="month-label">{monthLabel(selectedMonth)}</strong>
      <button className="icon-button" onClick={() => moveMonth(1)} aria-label="Mois suivant"><ChevronRight /></button>
    </section>

    <section className="budget-balance-card" key={`summary-${selectedMonth.toISOString()}`}>
      <div className="budget-balance-head"><div><span>Solde mensuel</span><strong>{eur.format(summary.confirmedBalance)}</strong></div><div><span>Potentiel</span><strong>{eur.format(summary.projectedBalance)}</strong></div></div>
      <div className="financial-segments budget-financial-segments" aria-label="Répartition financière du mois">{balanceSegments.map((value, index) => <i className={`segment-${index + 1}`} style={{ width: `${value / balanceSegmentTotal * 100}%` }} key={index} />)}</div>
      <div className="budget-balance-kpis"><div className="kpi-income"><strong>{eur.format(summary.confirmedIncome)}</strong><span>Revenus</span></div><div className="kpi-charge"><strong>{eur.format(summary.confirmedExpenses)}</strong><span>Charges</span></div><div className="kpi-expense"><strong>{eur.format(summary.pendingExpenses)}</strong><span>Dépenses à venir</span></div></div>
    </section>

    <button className="copy-month-action" onClick={copyNext}><Copy size={16} /><span><strong>Copier vers le mois suivant</strong><small>Reprendre ce budget sans créer de doublons</small></span><ChevronRight size={17} /></button>

    <div className="budget-sections">
      {sections.map((section) => { const visible = section.items.filter((entry) => !hidden.includes(entry.id)); const expected = visible.reduce((sum, entry) => sum + displayPotential(entry), 0); const completed = visible.filter((entry) => entry.status === "recu").reduce((sum, entry) => sum + entry.amount, 0); const progress = expected ? Math.min(completed / expected * 100, 100) : 0; const addLabel = section.tone === "income" ? "Ajouter une rentrée" : section.tone === "charge" ? "Ajouter une charge" : "Ajouter une dépense"; return <section className={`budget-block budget-${section.tone}`} key={section.title}><header><span><i />{section.title}<small>{visible.length}</small></span><strong>{eur.format(expected)}</strong></header><div className="budget-block-progress"><i style={{ width: `${progress}%` }} /></div>{visible.length === 0 ? <p className="dense-empty">Aucun élément ce mois.</p> : visible.map((entry) => { const EntryIcon = iconForEntry(entry); const doneLabel = section.tone === "income" ? "Reçu" : section.tone === "charge" ? "Payé" : "Réalisé"; return <SwipeRow key={entry.id} label={entry.title} onEdit={() => showEdit(entry)} onDelete={() => scheduleDelete(entry)}><div className="budget-jr-row"><span className="budget-row-icon"><EntryIcon size={16} /></span><span className="list-main"><strong>{entry.title}</strong><small>{entry.category} · {shortDate(entry.date)}</small>{entry.status === "recu" ? <em>{doneLabel}</em> : <em className="pending">En attente</em>}</span><strong>{eur.format(entry.status === "recu" ? entry.amount : displayPotential(entry))}</strong><button className={`entry-status ${entry.status === "recu" ? "done" : ""}`} aria-label={entry.status === "recu" ? "Passer en attente" : `Marquer ${doneLabel.toLocaleLowerCase("fr-FR")}`} onClick={() => update("budgetEntries", entry.id, { status: entry.status === "recu" ? "non" : "recu" })}><Check size={14} /></button></div></SwipeRow>; })}<button className="budget-block-add" onClick={() => showCreate(section.type, section.bucket)}><Plus size={15} /> {addLabel}</button></section>; })}
    </div>

    <section className="utility-row"><div><span className="icon-tile icon-purple"><ReceiptText size={18} /></span><span><strong>Import Revolut</strong><small>CSV : description, montant, date</small></span></div><button className="button button-soft" onClick={() => fileRef.current?.click()}><Upload size={16} /> Importer</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} /></section>

    <Sheet open={open} title={editing ? "Modifier la transaction" : "Nouvelle transaction"} submitLabel={editing ? "Enregistrer" : "Ajouter"} disableSubmit={!draft.title.trim() || draft.amount <= 0} onClose={() => setOpen(false)} onSubmit={save}><div className="transaction-form"><Field label="Montant"><AmountField value={draft.amount} onChange={(amount) => setDraft({ ...draft, amount })} autoFocus /></Field><AnimatedSegmented value={draft.type} options={[{ value: "revenu", label: "Revenu" }, { value: "depense", label: "Dépense" }]} onChange={(type) => setDraft({ ...draft, type, bucket: type === "revenu" ? "Rentrée" : "Variable" })} label="Type de transaction" /><FormSection title="Détails"><Field label="Intitulé"><input className="input" autoCapitalize="sentences" value={draft.title} placeholder="Intitulé de la transaction" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field><Field label="Catégorie"><input className="input" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></Field><div className="grid-2"><Field label="Groupe"><select className="select" value={draft.bucket} onChange={(event) => setDraft({ ...draft, bucket: event.target.value })}><option>Rentrée</option><option>Charge fixe</option><option>Variable</option><option>Voyage</option></select></Field><Field label="Espace"><input className="input" value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} /></Field></div><Field label="Date"><DateField value={toDateInput(draft.date)} onChange={(value) => setDraft({ ...draft, date: fromDateInput(value) })} /></Field><Field label="Commentaire"><textarea className="textarea" value={draft.note} placeholder="Optionnel" onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></Field></FormSection>{editing ? <button className="button button-danger" onClick={() => { const entry = data.budgetEntries.find((item) => item.id === editing); if (entry) scheduleDelete(entry); setOpen(false); }}>Supprimer la transaction</button> : null}</div></Sheet>
  </main>;
}
