import type { TripExpense, TripExpenseSplit, UUID } from "@/types/domain";

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Division égale au centime près : le reliquat d'arrondi est distribué
 * un centime à la fois, de sorte que la somme des parts égale exactement le total.
 */
export function splitEqually(amount: number, participants: UUID[]): { userId: UUID; amount: number }[] {
  if (participants.length === 0) return [];
  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / participants.length);
  const remainder = totalCents - base * participants.length;
  return participants.map((userId, index) => ({
    userId,
    amount: (base + (index < remainder ? 1 : 0)) / 100,
  }));
}

/** Répartition personnalisée : vérifie que les montants retombent sur le total. */
export function validateCustomSplit(amount: number, parts: { userId: UUID; amount: number }[]) {
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  const difference = round2(amount - total);
  return { valid: Math.abs(difference) < 0.01, difference };
}

export interface TripBalance {
  userId: UUID;
  paid: number;
  owed: number;
  /** Positif : on lui doit de l'argent. Négatif : il doit de l'argent. */
  net: number;
}

export function tripBalances(
  expenses: TripExpense[],
  splits: TripExpenseSplit[],
  participants: UUID[],
): TripBalance[] {
  const paid = new Map<UUID, number>();
  const owed = new Map<UUID, number>();
  const expenseIds = new Set(expenses.map((expense) => expense.id));

  for (const expense of expenses) {
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amount);
  }
  for (const split of splits) {
    if (!expenseIds.has(split.expenseId) || split.isSettled) continue;
    owed.set(split.userId, (owed.get(split.userId) ?? 0) + split.amount);
  }

  const everyone = new Set<UUID>([...participants, ...paid.keys(), ...owed.keys()]);
  return [...everyone].map((userId) => {
    const paidTotal = round2(paid.get(userId) ?? 0);
    const owedTotal = round2(owed.get(userId) ?? 0);
    return { userId, paid: paidTotal, owed: owedTotal, net: round2(paidTotal - owedTotal) };
  });
}

export interface Settlement { from: UUID; to: UUID; amount: number }

/**
 * « Qui doit quoi ? » — minimise le nombre de virements en soldant d'abord
 * le plus gros débiteur avec le plus gros créditeur.
 */
export function settlements(balances: TripBalance[]): Settlement[] {
  const debtors = balances.filter((item) => item.net < -0.009).map((item) => ({ ...item }));
  const creditors = balances.filter((item) => item.net > 0.009).map((item) => ({ ...item }));
  debtors.sort((a, b) => a.net - b.net);
  creditors.sort((a, b) => b.net - a.net);

  const transfers: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!;
    const creditor = creditors[creditorIndex]!;
    const amount = round2(Math.min(-debtor.net, creditor.net));
    if (amount > 0) transfers.push({ from: debtor.userId, to: creditor.userId, amount });
    debtor.net = round2(debtor.net + amount);
    creditor.net = round2(creditor.net - amount);
    if (debtor.net > -0.009) debtorIndex += 1;
    if (creditor.net < 0.009) creditorIndex += 1;
  }
  return transfers;
}

export const tripExpensesTotal = (expenses: TripExpense[]) =>
  round2(expenses.reduce((sum, expense) => sum + expense.amount, 0));
