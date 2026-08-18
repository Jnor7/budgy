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
