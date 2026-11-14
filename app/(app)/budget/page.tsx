"use client";

import {
  AlertCircle,
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  House,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Smartphone,
  Tag,
  Trash2,
  Upload,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BudgetQuickComplete } from "@/components/budget/budget-quick-complete";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { Field, FormModal, FormRow } from "@/components/ui/modal";
import {
  AmountField,
  AnimatedSegmented,
  DateField,
  FormSection,
} from "@/components/ui/premium";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { SwipeRow } from "@/components/ui/swipe-row";
import { useBudgyData } from "@/lib/data/data-provider";
import {
  budgetSummary,
  displayPotential,
  entriesForMonth,
  transactionCategory,
} from "@/lib/domain/budget";
import {
  eur,
  fromDateInput,
  monthLabel,
  shortDate,
  toDateInput,
} from "@/lib/format";
import type { BudgetDetailView } from "@/lib/budget-workflows/models";
import type { BudgetEntry, Currency, EntryType } from "@/types/domain";

type Draft = Pick<
  BudgetEntry,
  | "title"
  | "amount"
  | "potentialAmount"
  | "type"
  | "category"
  | "bucket"
  | "scope"
  | "date"
  | "note"
  | "status"
  | "paymentStatus"
  | "affectsProjection"
  | "businessProject"
  | "currency"
  | "countsAsEarnedIncome"
>;

const blankDraft = (date: Date, type: EntryType = "depense"): Draft => ({
  title: "",
  amount: 0,
  potentialAmount: 0,
  type,
  category: "",
  bucket: type === "revenu" ? "Rentrée" : "Variable",
  scope: "Perso",
  date: date.toISOString(),
  note: "",
  status: "non",
  paymentStatus: "planned",
  affectsProjection: true,
  businessProject: null,
  currency: "EUR",
  countsAsEarnedIncome: true,
});
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
const money = (amount: number, currency?: Currency) =>
  currency && currency !== "EUR"
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(
        amount,
      )
    : eur.format(amount);
const iconForEntry = (entry: BudgetEntry): LucideIcon => {
  const label =
    `${entry.title} ${entry.category} ${entry.bucket}`.toLocaleLowerCase(
      "fr-FR",
    );
  if (entry.type === "revenu") return Coins;
  if (/loyer|logement|maison|appartement/.test(label)) return House;
  if (/abonnement|téléphone|telephone|internet|stream/.test(label))
    return Smartphone;
  if (/transport|voiture|essence|train|bus/.test(label)) return Car;
  if (/aliment|course|restaurant|repas/.test(label)) return Utensils;
  return WalletCards;
};
const entryState = (entry: BudgetEntry, doneLabel: string) =>
  entry.status === "recu"
    ? doneLabel
    : entry.rolloverStatus === "carried_out"
      ? "Non reçu · reporté"
      : entry.paymentStatus === "cancelled"
        ? "Non passé"
        : entry.rolloverStatus === "carried_in"
          ? "Report d’un mois précédent"
          : "En attente";

export default function BudgetPage() {
  const { data, ready, create, update, remove, reload } = useBudgyData();
  const { showToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(() => blankDraft(new Date()));
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [actionEntry, setActionEntry] = useState<BudgetEntry>();
  const [reportEntry, setReportEntry] = useState<BudgetEntry>();
  const [reportDate, setReportDate] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [monthDetails, setMonthDetails] = useState<BudgetDetailView[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<string[]>([]);
  const [details, setDetails] = useState<BudgetDetailView[]>([]);
  const [detailName, setDetailName] = useState("");
  const [detailBeneficiary, setDetailBeneficiary] = useState("");
  const [detailAmount, setDetailAmount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const actionHandled = useRef(false);

  const entries = useMemo(
    () => entriesForMonth(data.budgetEntries, selectedMonth),
    [data.budgetEntries, selectedMonth],
  );
  const summary = useMemo(() => budgetSummary(entries), [entries]);
  const confirmedCharges = entries
    .filter(
      (entry) =>
        entry.type === "depense" &&
        entry.status === "recu" &&
        entry.bucket.toLowerCase().includes("charge"),
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
  const confirmedVariables = Math.max(
    summary.confirmedExpenses - confirmedCharges,
    0,
  );
  const balanceSegments = [
    summary.confirmedIncome,
    confirmedCharges,
    confirmedVariables,
    Math.max(summary.projectedBalance, 0),
  ];
  const balanceSegmentTotal =
    balanceSegments.reduce((sum, value) => sum + value, 0) || 1;
  const sections = [
    {
      title: "Rentrées",
      tone: "income",
      type: "revenu" as EntryType,
      bucket: "Rentrée",
      items: entries.filter((item) => item.type === "revenu"),
    },
    {
      title: "Charges",
      tone: "charge",
      type: "depense" as EntryType,
      bucket: "Charge fixe",
      items: entries.filter(
        (item) =>
          item.type === "depense" &&
          item.bucket.toLowerCase().includes("charge"),
      ),
    },
    {
      title: "Dépenses",
      tone: "expense",
      type: "depense" as EntryType,
      bucket: "Variable",
      items: entries.filter(
        (item) =>
          item.type === "depense" &&
          !item.bucket.toLowerCase().includes("charge"),
      ),
    },
  ];

  const dateInMonth = () =>
    new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      Math.min(new Date().getDate(), 28),
      12,
    );
  const showCreate = (type: EntryType = "depense", bucket?: string) => {
    setEditing(undefined);
    setDetails([]);
    setDraft({
      ...blankDraft(dateInMonth(), type),
      bucket: bucket ?? (type === "revenu" ? "Rentrée" : "Variable"),
    });
    setOpen(true);
  };
  const loadDetails = async (entryId: string) => {
    const response = await fetch(`/api/budget/details?entryId=${entryId}`, {
      cache: "no-store",
    });
    setDetails(response.ok ? await response.json() : []);
  };
  const showEdit = (entry: BudgetEntry) => {
    setEditing(entry.id);
    setDraft({ ...blankDraft(new Date(entry.date), entry.type), ...entry });
    setOpen(true);
    void loadDetails(entry.id);
  };

  const loadMonthDetails = async (signal?: AbortSignal) => {
    const month = monthKey(selectedMonth);
    const detailResponse = await fetch(`/api/budget/details?month=${month}`, {
      cache: "no-store",
      signal,
    });
    setMonthDetails(detailResponse.ok ? await detailResponse.json() : []);
  };
  useEffect(() => {
    const controller = new AbortController();
    const month = monthKey(selectedMonth);
    void fetch(`/api/budget/details?month=${month}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        setMonthDetails(response.ok ? await response.json() : []);
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setMonthDetails([]);
        }
      });
    return () => controller.abort();
  }, [selectedMonth]);
  useEffect(() => {
    if (!ready || actionHandled.current) return;
    const timer = window.setTimeout(() => {
      actionHandled.current = true;
      const action = new URLSearchParams(window.location.search).get("action");
      if (action === "income") showCreate("revenu");
      else if (action === "expense") showCreate("depense");
      else if (action === "copy") setCopyConfirm(true);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const save = () => {
    if (!draft.title.trim() || draft.amount <= 0) return;
    const payload = { ...draft, category: transactionCategory(draft.category) };
    if (editing) update("budgetEntries", editing, payload);
    else create("budgetEntries", payload);
    showToast({
      title: editing ? "Transaction modifiée" : "Transaction ajoutée",
      tone: "success",
    });
    setOpen(false);
  };
  const markComplete = (entry: BudgetEntry) => {
    if (entry.status === "recu") {
      setActionEntry(undefined);
      return;
    }
    update("budgetEntries", entry.id, {
      status: "recu",
      paymentStatus: entry.type === "revenu" ? "received" : "paid",
      affectsProjection: false,
    });
    setActionEntry(undefined);
    showToast({
      title:
        entry.type === "revenu"
          ? "Entrée marquée reçue"
          : "Dépense marquée payée",
      tone: "success",
    });
  };
  const markMissed = (entry: BudgetEntry) => {
    update("budgetEntries", entry.id, {
      status: "non",
      paymentStatus: "cancelled",
      affectsProjection: false,
    });
    setActionEntry(undefined);
    showToast({ title: "Ligne marquée non passée" });
  };
  const beginReport = (entry: BudgetEntry) => {
    const source = new Date(entry.date);
    const target = new Date(
      source.getFullYear(),
      source.getMonth() + 1,
      Math.min(source.getDate(), 28),
      12,
    );
    setReportEntry(entry);
    setReportDate(toDateInput(target.toISOString()));
    setReportTitle(`Arriéré ${entry.title}`);
    setActionEntry(undefined);
  };
  const report = async () => {
    if (!reportEntry || !reportDate) return;
    const response = await fetch("/api/budget/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryId: reportEntry.id,
        date: reportDate,
        title: reportTitle,
      }),
    });
    const body = await response.json();
    if (!response.ok)
      return showToast({
        title: "Report impossible",
        detail: body.message,
        tone: "error",
      });
    setReportEntry(undefined);
    await reload();
    showToast({
      title: "Transaction reportée",
      detail: "La ligne d’origine reste visible sans double comptage.",
      tone: "success",
    });
  };
  const addDetail = async () => {
    if (!editing || !detailName.trim()) return;
    const response = await fetch("/api/budget/detail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryId: editing,
        name: detailName,
        beneficiary: detailBeneficiary,
        plannedAmount: detailAmount,
      }),
    });
    if (response.ok) {
      setDetailName("");
      setDetailBeneficiary("");
      setDetailAmount(0);
      await loadDetails(editing);
      await loadMonthDetails();
      showToast({ title: "Détail ajouté", tone: "success" });
    }
  };
  const deleteDetail = async (id: string) => {
    const response = await fetch("/api/budget/remove-detail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok && editing) {
      await loadDetails(editing);
      await loadMonthDetails();
    }
  };
  const scheduleDelete = (entry: BudgetEntry) => {
    if (deleteTimers.current.has(entry.id)) return;
    setHidden((current) => [...current, entry.id]);
    const timer = setTimeout(() => {
      update("budgetEntries", entry.id, {
        isArchived: true,
        paymentStatus: "cancelled",
        affectsProjection: false,
      });
      deleteTimers.current.delete(entry.id);
      setHidden((current) => current.filter((id) => id !== entry.id));
    }, 4300);
    deleteTimers.current.set(entry.id, timer);
    showToast({
      title: "Transaction annulée",
      detail: entry.title,
      actionLabel: "Annuler",
      duration: 4200,
      onAction: () => {
        clearTimeout(timer);
        deleteTimers.current.delete(entry.id);
        setHidden((current) => current.filter((id) => id !== entry.id));
      },
    });
  };
  const copyNext = () => {
    const target = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      1,
    );
    const createdIds: string[] = [];
    for (const entry of entries.filter(
      (item) =>
        item.rolloverStatus !== "carried_out" &&
        item.countsAsEarnedIncome !== false,
    )) {
      const source = new Date(entry.date);
      const day = Math.min(
        source.getDate(),
        new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate(),
      );
      const exists = data.budgetEntries.some((candidate) => {
        const date = new Date(candidate.date);
        return (
          date.getFullYear() === target.getFullYear() &&
          date.getMonth() === target.getMonth() &&
          date.getDate() === day &&
          candidate.title.trim().toLowerCase() ===
            entry.title.trim().toLowerCase() &&
          candidate.amount === entry.amount &&
          candidate.type === entry.type
        );
      });
      if (!exists) {
        const created = create("budgetEntries", {
          title: entry.title,
          amount: entry.amount,
          potentialAmount: entry.potentialAmount,
          type: entry.type,
          category: entry.category,
          bucket: entry.bucket,
          scope: entry.scope,
          date: new Date(
            target.getFullYear(),
            target.getMonth(),
            day,
            12,
          ).toISOString(),
          note: entry.note,
          status: "non",
          paymentStatus: "planned",
          affectsProjection: true,
          businessProject: entry.businessProject,
          currency: entry.currency,
          countsAsEarnedIncome: entry.countsAsEarnedIncome,
          rolloverStatus: "none",
        });
        createdIds.push(created.id);
      }
    }
    showToast({
      title: `Budget copié vers ${monthLabel(target).toLowerCase()}`,
      detail: `${createdIds.length} élément(s) ajouté(s).`,
      tone: "success",
      actionLabel: createdIds.length ? "Annuler" : undefined,
      onAction: () => createdIds.forEach((id) => remove("budgetEntries", id)),
    });
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = (lines.shift() ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase());
    let count = 0;
    for (const line of lines) {
      const values = line.split(",");
      const value = (...names: string[]) => {
        const index = headers.findIndex((header) => names.includes(header));
        return index >= 0 ? (values[index] ?? "").trim() : "";
      };
      const raw = Number(value("montant", "amount").replace(",", "."));
      const amount = Math.abs(raw);
      if (amount > 0) {
        create("budgetEntries", {
          ...blankDraft(selectedMonth, raw >= 0 ? "revenu" : "depense"),
          title: value("description", "libellé", "libelle") || "Import manuel",
          amount,
          category: "Import manuel",
          date: value("date", "datedefin")
            ? new Date(value("date", "datedefin")).toISOString()
            : selectedMonth.toISOString(),
        });
        count++;
      }
    }
    showToast({
      title: "Import terminé",
      detail: `${count} transaction(s) importée(s).`,
      tone: "success",
    });
  };

  if (!ready)
    return (
      <main className="page finance-page">
        <div className="skeleton" style={{ height: 70 }} />
        <div className="skeleton" style={{ height: 180 }} />
        <div className="skeleton" />
      </main>
    );
  return (
    <PullToRefresh onRefresh={reload}>
      <main className="page finance-page">
        <section className="month-control" aria-label="Mois du budget">
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setSelectedMonth(
                (value) =>
                  new Date(value.getFullYear(), value.getMonth() - 1, 1),
              )
            }
            aria-label="Mois précédent"
          >
            <ChevronLeft />
          </button>
          <strong className="month-label">{monthLabel(selectedMonth)}</strong>
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setSelectedMonth(
                (value) =>
                  new Date(value.getFullYear(), value.getMonth() + 1, 1),
              )
            }
            aria-label="Mois suivant"
          >
            <ChevronRight />
          </button>
        </section>
        <section className="budget-balance-card">
          <div className="budget-balance-head">
            <div>
              <span>Flux réalisés</span>
              <strong>{eur.format(summary.confirmedBalance)}</strong>
            </div>
            <div>
              <span>Potentiel</span>
              <strong>{eur.format(summary.projectedBalance)}</strong>
            </div>
          </div>
          <div className="financial-segments budget-financial-segments">
            {balanceSegments.map((value, index) => (
              <i
                className={`segment-${index + 1}`}
                style={{ width: `${(value / balanceSegmentTotal) * 100}%` }}
                key={index}
              />
            ))}
          </div>
          <div className="budget-balance-kpis">
            <div className="kpi-income">
              <strong>{eur.format(summary.earnedIncome)}</strong>
              <span>Revenus gagnés</span>
            </div>
            <div className="kpi-charge">
              <strong>{eur.format(summary.confirmedIncome)}</strong>
              <span>Entrées réelles</span>
            </div>
            <div className="kpi-expense">
              <strong>{eur.format(summary.pendingExpenses)}</strong>
              <span>À venir</span>
            </div>
          </div>
        </section>
        <button
          type="button"
          className="copy-month-action"
          onClick={() => setCopyConfirm(true)}
        >
          <Copy size={16} />
          <span>
            <strong>Copier vers le mois suivant</strong>
            <small>Sans prêts ni lignes déjà reportées</small>
          </span>
          <ChevronRight size={17} />
        </button>
        <div className="budget-sections">
          {sections.map((section) => {
            const visible = section.items.filter(
              (entry) => !hidden.includes(entry.id),
            );
            const expected = visible.reduce(
              (sum, entry) => sum + displayPotential(entry),
              0,
            );
            const completed = visible
              .filter((entry) => entry.status === "recu")
              .reduce((sum, entry) => sum + entry.amount, 0);
            const progress = expected
              ? Math.min((completed / expected) * 100, 100)
              : 0;
            const addLabel =
              section.tone === "income"
                ? "Ajouter une rentrée"
                : section.tone === "charge"
                  ? "Ajouter une charge"
                  : "Ajouter une dépense";
            return (
              <section
                className={`budget-block budget-${section.tone}`}
                key={section.title}
              >
                <header>
                  <span>
                    <i />
                    {section.title}
                    <small>{visible.length}</small>
                  </span>
                  <strong>{eur.format(expected)}</strong>
                </header>
                <div className="budget-block-progress">
                  <i style={{ width: `${progress}%` }} />
                </div>
                {visible.length === 0 ? (
                  <p className="dense-empty">Aucun élément ce mois.</p>
                ) : (
                  visible.map((entry) => {
                    const EntryIcon = iconForEntry(entry);
                    const doneLabel =
                      section.tone === "income"
                        ? "Reçu"
                        : section.tone === "charge"
                          ? "Payé"
                          : "Réalisé";
                    const entryDetails = monthDetails.filter((detail) => detail.entryId === entry.id);
                    const expanded = expandedEntries.includes(entry.id);
                    return (
                      <Fragment key={entry.id}>
                      <SwipeRow
                        label={entry.title}
                        onEdit={() => showEdit(entry)}
                        onDelete={() => scheduleDelete(entry)}
                      >
                        <div className="budget-jr-row">
                          <span className="budget-row-icon">
                            <EntryIcon size={16} />
                          </span>
                          <span className="list-main">
                            <strong>{entry.title}</strong>
                            <small>
                              {entry.category} · {shortDate(entry.date)}
                            </small>
                            <span className="budget-row-badges">
                              {entry.businessProject ? (
                                <em className="business">
                                  <Tag size={10} />
                                  {entry.businessProject}
                                </em>
                              ) : null}
                              <em
                                className={
                                  entry.status === "recu" ? "" : "pending"
                                }
                              >
                                {entryState(entry, doneLabel)}
                              </em>
                              {entry.countsAsEarnedIncome === false ? (
                                <em className="financing">Financement</em>
                              ) : null}
                            </span>
                          </span>
                          <strong>
                            {money(
                              entry.status === "recu"
                                ? entry.amount
                                : displayPotential(entry),
                              entry.currency,
                            )}
                          </strong>
                          <BudgetQuickComplete entry={entry} onComplete={markComplete} />
                          <button
                            type="button"
                            className="entry-actions"
                            aria-label={`Actions pour ${entry.title}`}
                            onClick={() => setActionEntry(entry)}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {entryDetails.length ? <button
                            type="button"
                            className="budget-detail-toggle"
                            aria-label={`${expanded ? "Masquer" : "Afficher"} ${entryDetails.length} sous-détail(s) pour ${entry.title}`}
                            aria-expanded={expanded}
                            onClick={(event) => { event.stopPropagation(); setExpandedEntries((current) => expanded ? current.filter((id) => id !== entry.id) : [...current, entry.id]); }}
                          ><span>{entryDetails.length}</span><ChevronDown size={15} /></button> : null}
                        </div>
                      </SwipeRow>
                      {expanded ? <div className="budget-inline-details">
                        {entryDetails.map((detail) => <div key={detail.id}>
                          <span><strong>{detail.beneficiary || detail.name}</strong><small>{detail.beneficiary ? detail.name : "Sous-détail"}</small></span>
                          <b>{eur.format(detail.actualAmount || detail.plannedAmount)}</b>
                        </div>)}
                      </div> : null}
                      </Fragment>
                    );
                  })
                )}
                <button
                  type="button"
                  className="budget-block-add"
                  onClick={() => showCreate(section.type, section.bucket)}
                >
                  <Plus size={15} /> {addLabel}
                </button>
              </section>
            );
          })}
        </div>
        <section className="utility-row">
          <div>
            <span className="icon-tile icon-purple">
              <ReceiptText size={18} />
            </span>
            <span>
              <strong>Import manuel</strong>
              <small>CSV : description, montant, date</small>
            </span>
          </div>
          <button
            type="button"
            className="button button-soft"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} /> Importer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCsv(file);
            }}
          />
        </section>
        <ConfirmDialog
          open={copyConfirm}
          title={`Copier le budget de ${monthLabel(selectedMonth).toLowerCase()} ?`}
          detail="Les doublons exacts, prêts et lignes reportées sont ignorés."
          confirmLabel="Copier le budget"
          confirmTone="primary"
          onCancel={() => setCopyConfirm(false)}
          onConfirm={() => {
            setCopyConfirm(false);
            copyNext();
          }}
        />
        <FormModal
          open={Boolean(actionEntry)}
          title={actionEntry?.title ?? "Actions"}
          submitLabel="Fermer"
          onClose={() => setActionEntry(undefined)}
          onSubmit={() => setActionEntry(undefined)}
          icon={WalletCards}
          tone="purple"
        >
          <div className="budget-action-list">
            {actionEntry && actionEntry.status !== "recu" ? (
              <button type="button" onClick={() => markComplete(actionEntry)}>
                <Check />
                Marquer {actionEntry.type === "revenu" ? "reçu" : "payé"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => actionEntry && markMissed(actionEntry)}
            >
              <AlertCircle />
              Marquer non passé
            </button>
            <button
              type="button"
              onClick={() => actionEntry && beginReport(actionEntry)}
            >
              <CalendarClock />
              Reporter
            </button>
            <button
              type="button"
              onClick={() => {
                if (actionEntry) showEdit(actionEntry);
                setActionEntry(undefined);
              }}
            >
              <WalletCards />
              Modifier et voir les détails
            </button>
            <button
              type="button"
              className="negative"
              onClick={() => {
                if (actionEntry) scheduleDelete(actionEntry);
                setActionEntry(undefined);
              }}
            >
              <Trash2 />
              Annuler la ligne
            </button>
          </div>
        </FormModal>
        <FormModal
          open={Boolean(reportEntry)}
          title="Reporter la transaction"
          submitLabel="Confirmer le report"
          disableSubmit={!reportDate || !reportTitle.trim()}
          onClose={() => setReportEntry(undefined)}
          onSubmit={() => void report()}
          icon={CalendarClock}
          tone="purple"
        >
          <div className="form-grid">
            <p className="muted small">
              La ligne restera dans son mois d’origine avec le statut « Non reçu
              · reporté ». Une seule nouvelle occurrence sera créée.
            </p>
            <Field label="Nouvel intitulé">
              <input
                className="input"
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
              />
            </Field>
            <Field label="Nouvelle date">
              <DateField value={reportDate} onChange={setReportDate} />
            </Field>
          </div>
        </FormModal>
        <FormModal
          open={open}
          title={editing ? "Modifier la transaction" : "Nouvelle transaction"}
          submitLabel={
            editing
              ? "Enregistrer les modifications"
              : "Enregistrer la transaction"
          }
          disableSubmit={!draft.title.trim() || draft.amount <= 0}
          onClose={() => setOpen(false)}
          onSubmit={save}
          icon={draft.type === "revenu" ? Coins : WalletCards}
          tone={draft.type === "revenu" ? "green" : "red"}
        >
          <div className="form-grid">
            <FormSection title="Type">
              <AnimatedSegmented
                value={draft.type}
                options={[
                  { value: "depense", label: "↓ Dépense" },
                  { value: "revenu", label: "↑ Entrée" },
                ]}
                onChange={(type) =>
                  setDraft({
                    ...draft,
                    type,
                    bucket: type === "revenu" ? "Rentrée" : "Variable",
                  })
                }
                label="Type"
              />
            </FormSection>
            <FormSection title="Détails">
              <FormRow>
                <Field label="Montant">
                  <AmountField
                    size="modal"
                    value={draft.amount}
                    onChange={(amount) => setDraft({ ...draft, amount })}
                    autoFocus
                  />
                </Field>
                <Field label="Devise">
                  <select
                    className="select"
                    value={draft.currency ?? "EUR"}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        currency: event.target.value as Currency,
                      })
                    }
                  >
                    <option>EUR</option>
                    <option>USD</option>
                    <option>GBP</option>
                    <option>XAF</option>
                  </select>
                </Field>
              </FormRow>
              <Field label="Intitulé">
                <input
                  className="input"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </Field>
              <FormRow>
                <Field label="Catégorie">
                  <input
                    className="input"
                    value={draft.category}
                    placeholder="Autre"
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                  />
                </Field>
                <Field label="Date">
                  <DateField
                    value={toDateInput(draft.date)}
                    onChange={(value) =>
                      setDraft({ ...draft, date: fromDateInput(value) })
                    }
                  />
                </Field>
              </FormRow>
              <div
                className="form-choice-chips"
                aria-label="Catégories rapides"
              >
                {[
                  "Logement",
                  "Alimentation",
                  "Transport",
                  "Voyage",
                  "Abonnement",
                ].map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={draft.category === category ? "selected" : ""}
                    onClick={() => setDraft({ ...draft, category })}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <Field label="Tag / projet">
                <input
                  className="input"
                  value={draft.businessProject ?? ""}
                  placeholder="Business / Zhongda"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      businessProject: event.target.value || null,
                    })
                  }
                />
              </Field>
              <FormRow>
                <Field label="Compte">
                  <input
                    className="input"
                    value={draft.scope}
                    onChange={(event) =>
                      setDraft({ ...draft, scope: event.target.value })
                    }
                  />
                </Field>
                <Field label="Groupe">
                  <select
                    className="select"
                    value={draft.bucket}
                    onChange={(event) =>
                      setDraft({ ...draft, bucket: event.target.value })
                    }
                  >
                    <option>Rentrée</option>
                    <option>Charge fixe</option>
                    <option>Variable</option>
                    <option>Voyage</option>
                  </select>
                </Field>
              </FormRow>
              {draft.type === "revenu" ? (
                <button
                  type="button"
                  className="card-flat spread"
                  aria-pressed={draft.countsAsEarnedIncome !== false}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      countsAsEarnedIncome:
                        draft.countsAsEarnedIncome === false,
                    })
                  }
                >
                  <span>Compter comme revenu gagné</span>
                  <span
                    className={`status-dot ${draft.countsAsEarnedIncome !== false ? "active" : ""}`}
                  >
                    {draft.countsAsEarnedIncome !== false ? (
                      <Check size={14} />
                    ) : null}
                  </span>
                </button>
              ) : null}
              <Field label="Note">
                <textarea
                  className="textarea"
                  value={draft.note}
                  onChange={(event) =>
                    setDraft({ ...draft, note: event.target.value })
                  }
                />
              </Field>
            </FormSection>
            {editing ? (
              <FormSection title="Sous-détails">
                <div className="budget-detail-list">
                  {details.map((item) => (
                    <div key={item.id}>
                      <span>
                        <strong>{item.beneficiary || item.name}</strong>
                        <small>{item.beneficiary ? item.name : "Détail"}</small>
                      </span>
                      <b>{eur.format(item.plannedAmount)}</b>
                      <button
                        type="button"
                        aria-label={`Supprimer ${item.name}`}
                        onClick={() => void deleteDetail(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <FormRow>
                  <Field label="Bénéficiaire">
                    <input
                      className="input"
                      value={detailBeneficiary}
                      placeholder="Maman"
                      onChange={(event) =>
                        setDetailBeneficiary(event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Détail">
                    <input
                      className="input"
                      value={detailName}
                      placeholder="Cadeau 1"
                      onChange={(event) => setDetailName(event.target.value)}
                    />
                  </Field>
                </FormRow>
                <Field label="Montant prévu">
                  <AmountField
                    size="modal"
                    value={detailAmount}
                    onChange={setDetailAmount}
                  />
                </Field>
                <button
                  type="button"
                  className="button button-soft"
                  disabled={!detailName.trim()}
                  onClick={() => void addDetail()}
                >
                  <Plus size={15} />
                  Ajouter le détail
                </button>
              </FormSection>
            ) : null}
          </div>
        </FormModal>
      </main>
    </PullToRefresh>
  );
}
