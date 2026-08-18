import type { RentPayment, Tenant, TenantDebt } from "@/types/domain";

const key = (year: number, month: number) => year * 12 + month - 1;
const previousMonth = (year: number, month: number) => month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

export function carryOverForMonth(tenant: Tenant, payments: RentPayment[], debts: TenantDebt[], year: number, month: number, depth = 0): number {
  if (depth >= 36) return 0;
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
  const carry = carryOverForMonth(tenant, payments, debts, year, month, depth);
  const debt = debts
    .filter((item) => item.tenantId === tenant.id && item.year === year && item.month === month && !item.isPaid)
    .reduce((sum, item) => sum + item.amount, 0);
  return tenant.monthlyRent + carry + debt;
}
