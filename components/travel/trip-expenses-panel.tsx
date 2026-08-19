"use client";

import { ArrowLeftRight, Check, Plus, Receipt, Trash2, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { Field, FormModal, FormRow } from "@/components/ui/modal";
import { AmountField, DateField, FormSection } from "@/components/ui/premium";
import { V2Avatar } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { canEditTrip, tripParticipants } from "@/lib/domain/permissions";
import { settlements, splitEqually, tripBalances, tripExpensesTotal, validateCustomSplit } from "@/lib/domain/trip-expenses";
import { eur, fromDateInput, shortDate, toDateInput } from "@/lib/format";
import type { Trip } from "@/types/domain";

type SplitMode = "equal" | "custom";
const categories = ["Transport", "Logement", "Restaurant", "Activité", "Shopping", "Autre"];

export function TripExpensesPanel({ trip }: { trip: Trip }) {
  const { data, userId, displayName, avatarUrl, create, remove } = useBudgyData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString());
  const [category, setCategory] = useState("Restaurant");
  const [payer, setPayer] = useState(userId);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<SplitMode>("equal");
  const [custom, setCustom] = useState<Record<string, number>>({});
  const participants = useMemo(() => tripParticipants(trip, data.tripMembers), [data.tripMembers, trip]);
  const participantIds = participants.map((item) => item.userId);
  const expenses = data.tripExpenses.filter((item) => item.tripId === trip.id);
  const splits = data.tripExpenseSplits.filter((item) => item.tripId === trip.id);
  const balances = tripBalances(expenses, splits, participantIds);
  const transfers = settlements(balances);
  const canEdit = canEditTrip(trip, data.tripMembers, userId);
  const validation = validateCustomSplit(amount, selected.map((id) => ({ userId: id, amount: custom[id] ?? 0 })));

  const start = () => {
    setTitle(""); setAmount(0); setDate(new Date().toISOString()); setCategory("Restaurant");
    setPayer(userId); setSelected(participantIds); setMode("equal"); setCustom({}); setOpen(true);
  };

  const save = () => {
    if (!title.trim() || amount <= 0 || selected.length === 0 || (mode === "custom" && !validation.valid)) return;
    const expense = create("tripExpenses", { tripId: trip.id, paidBy: payer, title: title.trim(), amount, currency: "EUR", date: date.slice(0, 10), category, note: "", createdAt: new Date().toISOString() });
    const parts = mode === "equal" ? splitEqually(amount, selected) : selected.map((id) => ({ userId: id, amount: custom[id] ?? 0 }));
    parts.forEach((part) => create("tripExpenseSplits", { expenseId: expense.id, tripId: trip.id, amount: part.amount, isSettled: false, createdAt: new Date().toISOString() }, { userId: part.userId }));
    showToast({ title: "Dépense ajoutée", detail: mode === "equal" ? `${eur.format(parts[0]?.amount ?? 0)} par personne` : "Répartition personnalisée enregistrée", tone: "success" });
  };

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const total = tripExpensesTotal(expenses);
  const budgetLeft = trip.targetBudget - total;
  const progress = trip.targetBudget > 0 ? Math.min((total / trip.targetBudget) * 100, 100) : 0;

  return <div className="travel-tab-stack">
    <section className="travel-budget-card"><span>Budget voyage</span><div><b>{eur.format(total)}</b><small>dépensés sur {eur.format(trip.targetBudget)}</small></div><div className="travel-progress"><i style={{ width: `${progress}%` }} /></div><footer><span>Reste</span><b className={budgetLeft < 0 ? "negative" : ""}>{eur.format(budgetLeft)}</b></footer></section>
    <section className="travel-panel"><header className="travel-section-head"><div><span className="travel-eyebrow">Dépenses partagées</span><h2>{eur.format(total)}</h2></div>{canEdit ? <button className="travel-button travel-button-soft" onClick={start}><Plus size={16} /> Ajouter</button> : null}</header>
      {expenses.length === 0 ? <TravelInlineEmpty icon={Receipt} title="Aucune dépense" text="Ajoutez un dîner, un taxi ou une réservation et répartissez-la entre les voyageurs." /> : expenses.map((expense) => { const shares = splits.filter((split) => split.expenseId === expense.id); return <div className="travel-expense-row" key={expense.id}><span className={`travel-category-icon category-${expense.category.toLowerCase()}`}><Receipt size={18} /></span><div><strong>{expense.title}</strong><span>Payé par {displayName(expense.paidBy)} · {shortDate(expense.date)}</span><small>{shares.length} participant{shares.length > 1 ? "s" : ""}</small></div><b>{eur.format(expense.amount)}</b>{canEdit ? <button aria-label={`Supprimer ${expense.title}`} onClick={() => { shares.forEach((share) => remove("tripExpenseSplits", share.id)); remove("tripExpenses", expense.id); }}><Trash2 size={16} /></button> : null}</div>; })}
    </section>
    <section className="travel-panel"><header className="travel-section-head"><div><span className="travel-eyebrow">Balances simplifiées</span><h2>Qui doit quoi ?</h2></div><ArrowLeftRight size={22} /></header>
      {transfers.length === 0 ? <TravelInlineEmpty icon={Wallet} title="Tout est équilibré" text="Les propositions de règlement apparaîtront après l’ajout de dépenses." /> : transfers.map((transfer, index) => <div className="travel-settlement" key={`${transfer.from}-${transfer.to}-${index}`}><V2Avatar name={displayName(transfer.from)} url={avatarUrl(transfer.from)} /><div><strong>{displayName(transfer.from)} doit {eur.format(transfer.amount)}</strong><span>à {displayName(transfer.to)}</span></div><Check size={17} /></div>)}
      {transfers.length > 0 ? <p className="travel-hint">Les transferts sont calculés depuis le bilan net pour éviter les virements inutiles. Le schéma actuel stocke le règlement par part de dépense, pas par transfert simplifié : aucun faux état local n’est créé.</p> : null}
    </section>
    <FormModal open={open} title="Nouvelle dépense" submitLabel="Ajouter la dépense" disableSubmit={!title.trim() || amount <= 0 || selected.length === 0 || (mode === "custom" && !validation.valid)} onClose={() => setOpen(false)} onSubmit={save} icon={Receipt} tone="cyan"><div className="form-grid"><FormSection title="Dépense"><Field label="Titre"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Dinner Dubai Marina" /></Field><FormRow><Field label="Montant"><AmountField size="compact" value={amount} onChange={setAmount} /></Field><Field label="Date"><DateField value={toDateInput(date)} onChange={(value) => setDate(fromDateInput(value))} /></Field></FormRow><Field label="Catégorie"><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></Field></FormSection><FormSection title="Qui a payé ?"><div className="travel-person-choices">{participants.map((participant) => <button type="button" className={payer === participant.userId ? "active" : ""} key={participant.userId} onClick={() => setPayer(participant.userId)}><V2Avatar name={displayName(participant.userId)} url={avatarUrl(participant.userId)} /><span>{displayName(participant.userId)}</span></button>)}</div></FormSection><FormSection title="Pour qui ?"><div className="travel-participant-checks">{participants.map((participant) => <button type="button" className={selected.includes(participant.userId) ? "active" : ""} key={participant.userId} onClick={() => toggle(participant.userId)}><span className="travel-split-check">{selected.includes(participant.userId) ? <Check size={14} /> : null}</span><V2Avatar name={displayName(participant.userId)} url={avatarUrl(participant.userId)} />{displayName(participant.userId)}</button>)}</div></FormSection><div className="travel-split-switch"><button type="button" className={mode === "equal" ? "active" : ""} onClick={() => setMode("equal")}>Partage égal</button><button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>Personnalisé</button></div>{mode === "equal" ? <div className="travel-split-preview"><Users size={18} /><span>{selected.length > 0 ? eur.format(amount / selected.length) : eur.format(0)} chacun</span></div> : <div className="travel-custom-split">{selected.map((id) => <div key={id}><span>{displayName(id)}</span><AmountField size="compact" value={custom[id] ?? 0} onChange={(value) => setCustom((current) => ({ ...current, [id]: value }))} /></div>)}<footer><span>Total des parts</span><b>{eur.format(selected.reduce((sum, id) => sum + (custom[id] ?? 0), 0))} / {eur.format(amount)}</b></footer>{!validation.valid ? <p className="error">Il reste {eur.format(Math.abs(validation.difference))} à répartir.</p> : null}</div>}</div></FormModal>
  </div>;
}

function TravelInlineEmpty({ icon: Icon, title, text }: { icon: typeof Receipt; title: string; text: string }) { return <div className="travel-inline-empty"><span><Icon size={22} /></span><div><strong>{title}</strong><p>{text}</p></div></div>; }
