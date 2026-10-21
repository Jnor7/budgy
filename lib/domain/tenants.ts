import type { RentPayment, Tenant, TenantDebt } from "@/types/domain";

const key = (year: number, month: number) => year * 12 + month - 1;
const previousMonth = (year: number, month: number) => month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

const localDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Dernier mois facturable (celui de la date de fin), ou undefined si la location n'est pas clôturée. */
export function lastBillableMonth(tenant: Tenant): { year: number; month: number } | undefined {
  const match = /^(\d{4})-(\d{2})/.exec(tenant.endedOn ?? "");
  return match ? { year: Number(match[1]), month: Number(match[2]) } : undefined;
}

/** Vrai si le mois demandé est postérieur au mois de fin : aucune échéance ni report n'y est généré. */
export function isAfterTenancy(tenant: Tenant, year: number, month: number): boolean {
  const last = lastBillableMonth(tenant);
  return last !== undefined && key(year, month) > key(last.year, last.month);
}

/** Actif tant que la date de fin n'est pas dépassée ; ancien locataire ensuite. */
export function isTenantActive(tenant: Tenant, now = new Date()): boolean {
  return !tenant.endedOn || tenant.endedOn.slice(0, 10) >= localDateString(now);
}

export { localDateString };

export function carryOverForMonth(tenant: Tenant, payments: RentPayment[], debts: TenantDebt[], year: number, month: number, depth = 0): number {
  if (depth >= 36) return 0;
  if (isAfterTenancy(tenant, year, month)) return 0;
  const created = new Date(tenant.createdAt);
  const previous = previousMonth(year, month);
  if (key(previous.year, previous.month) < key(created.getFullYear(), created.getMonth() + 1)) return 0;
  const previousDue = totalDueForMonth(tenant, payments, debts, previous.year, previous.month, depth + 1);
  const previousReceived = payments
    .filter((payment) => payment.tenantId === tenant.id && payment.year === previous.year && payment.month === previous.month)
    .reduce((sum, payment) => sum + payment.amountReceived, 0);
  return Math.max(previousDue - previousReceived, 0);
}

export function totalDueForMonth(tenant: Tenant, payments: RentPayment[], debts: TenantDebt[], year: number, month: number, depth = 0): number {
  if (isAfterTenancy(tenant, year, month)) return 0;
  const carry =carryOverForMonth(tenant, payments, debts, year, month, depth);
  const debt = debts
    .filter((item) => item.tenantId === tenant.id && item.year === year && item.month === month && !item.isPaid)
    .reduce((sum, item) => sum + item.amount, 0);
  return tenant.monthlyRent + carry + debt;
}
