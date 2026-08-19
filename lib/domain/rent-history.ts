import { totalDueForMonth } from "@/lib/domain/tenants";
import type { RentPayment, Tenant, TenantDebt } from "@/types/domain";

export type RentMonthStatus = "paid" | "partial" | "overdue" | "upcoming" | "inactive";

export interface RentMonthView {
  month: number;
  year: number;
  due: number;
  received: number;
  remaining: number;
  progress: number;
  status: RentMonthStatus;
  carryOver: number;
  debts: number;
}

const monthKey = (year: number, month: number) => year * 12 + month - 1;

/**
 * Projection d'affichage uniquement. Le montant dû reste calculé par
 * `totalDueForMonth`, source métier historique de Budgy.
 */
export function rentYearRows(
  tenant: Tenant,
  payments: RentPayment[],
  debts: TenantDebt[],
  year: number,
  now = new Date(),
): RentMonthView[] {
  const created = new Date(tenant.createdAt);
  const createdKey = monthKey(created.getFullYear(), created.getMonth() + 1);
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const key = monthKey(year, month);
    if (key < createdKey) {
      return { month, year, due: 0, received: 0, remaining: 0, progress: 0, status: "inactive" as const, carryOver: 0, debts: 0 };
    }

    const due = totalDueForMonth(tenant, payments, debts, year, month);
    const received = payments
      .filter((payment) => payment.tenantId === tenant.id && payment.year === year && payment.month === month)
      .reduce((sum, payment) => sum + payment.amountReceived, 0);
    const debtTotal = debts
      .filter((debt) => debt.tenantId === tenant.id && debt.year === year && debt.month === month && !debt.isPaid)
      .reduce((sum, debt) => sum + debt.amount, 0);
    const remaining = Math.max(due - received, 0);
    const progress = due > 0 ? Math.min(received / due, 1) : 0;
    const pastDue = key < currentKey || (key === currentKey && now.getDate() > tenant.dueDay);
    const status: RentMonthStatus = remaining <= 0 && due > 0
      ? "paid"
      : received > 0
        ? "partial"
        : pastDue
          ? "overdue"
          : "upcoming";

    return {
      month, year, due, received, remaining, progress, status,
      carryOver: Math.max(due - tenant.monthlyRent - debtTotal, 0),
      debts: debtTotal,
    };
  });
}

export function rentYearSummary(rows: RentMonthView[], year: number, now = new Date()) {
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const accountable = rows.filter((row) => row.status !== "inactive" && monthKey(year, row.month) <= currentKey);
  const last = accountable.at(-1);
  return {
    settledMonths: accountable.filter((row) => row.status === "paid").length,
    accountableMonths: accountable.length,
    received: rows.reduce((sum, row) => sum + row.received, 0),
    remaining: last?.remaining ?? 0,
    hasLatePayment: accountable.some((row) => row.status === "overdue" || row.status === "partial") && (last?.remaining ?? 0) > 0,
  };
}

export const isRentMonthActionable = (row: RentMonthView, now = new Date()) =>
  row.status !== "inactive" && row.status !== "paid" && monthKey(row.year, row.month) <= monthKey(now.getFullYear(), now.getMonth() + 1);
