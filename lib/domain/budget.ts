import type { BudgetEntry } from "@/types/domain";

export const isConfirmed = (entry: BudgetEntry) => entry.status === "recu";
export const displayPotential = (entry: BudgetEntry) => entry.potentialAmount > 0 ? entry.potentialAmount : entry.amount;

export function budgetSummary(entries: BudgetEntry[]) {
  const confirmed = entries.filter(isConfirmed);
  const pending = entries.filter((entry) => !isConfirmed(entry));
  const sum = (items: BudgetEntry[], income: boolean, potential = false) => items
    .filter((entry) => entry.type === (income ? "revenu" : "depense"))
    .reduce((total, entry) => total + (potential ? displayPotential(entry) : entry.amount), 0);

  const confirmedIncome = sum(confirmed, true);
  const pendingIncome = sum(pending, true, true);
  const confirmedExpenses = sum(confirmed, false);
  const pendingExpenses = sum(pending, false, true);
  return {
    confirmedIncome, pendingIncome, confirmedExpenses, pendingExpenses,
    confirmedBalance: confirmedIncome - confirmedExpenses,
    projectedBalance: confirmedIncome + pendingIncome - confirmedExpenses - pendingExpenses,
  };
}

export function entriesForMonth(entries: BudgetEntry[], date: Date) {
  return entries.filter((entry) => {
    const candidate = new Date(entry.date);
    return candidate.getFullYear() === date.getFullYear() && candidate.getMonth() === date.getMonth();
  });
}

// --- V2 : agrégations d'affichage (aucune modification des calculs existants) ---

export interface CategorySlice {
  label: string;
  amount: number;
  share: number;
  count: number;
}

const BUCKET_LABELS: { match: (bucket: string) => boolean; label: string }[] = [
  { match: (bucket) => bucket.toLowerCase().includes("charge") || bucket.toLowerCase().includes("fixe"), label: "Fixes" },
  { match: (bucket) => bucket.toLowerCase().includes("variable"), label: "Variables" },
  { match: (bucket) => bucket.toLowerCase().includes("loyer"), label: "Loyers" },
  { match: (bucket) => bucket.toLowerCase().includes("abonnement"), label: "Abonnements" },
  { match: (bucket) => bucket.toLowerCase().includes("business"), label: "Business" },
  { match: (bucket) => bucket.toLowerCase().includes("voyage"), label: "Voyages" },
];

export const bucketLabel = (bucket: string) =>
  BUCKET_LABELS.find((item) => item.match(bucket))?.label ?? "Autres";

/**
 * Répartition des dépenses du mois, utilisée par le donut et les cartes catégories.
 * Le montant retenu suit exactement la règle d'affichage existante :
 * montant réel si confirmé, montant potentiel sinon.
 */
export function expenseBreakdown(entries: BudgetEntry[], by: "bucket" | "category" = "bucket"): CategorySlice[] {
  const expenses = entries.filter((entry) => entry.type === "depense");
  const totals = new Map<string, { amount: number; count: number }>();
  for (const entry of expenses) {
    const label = by === "bucket" ? bucketLabel(entry.bucket) : entry.category || "Autres";
    const amount = isConfirmed(entry) ? entry.amount : displayPotential(entry);
    const current = totals.get(label) ?? { amount: 0, count: 0 };
    totals.set(label, { amount: current.amount + amount, count: current.count + 1 });
  }
  const total = [...totals.values()].reduce((sum, item) => sum + item.amount, 0);
  return [...totals.entries()]
    .map(([label, item]) => ({
      label,
      amount: item.amount,
      count: item.count,
      share: total > 0 ? item.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Total dépensé du mois, tel qu'affiché au centre du donut. */
export function monthSpent(entries: BudgetEntry[]) {
  return expenseBreakdown(entries).reduce((sum, slice) => sum + slice.amount, 0);
}
