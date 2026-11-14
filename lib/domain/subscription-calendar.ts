import type { Subscription } from "@/types/domain";

const validDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export function subscriptionDayForMonth(subscription: Subscription, month: Date) {
  if (!subscription.isActive || subscription.lifecycleStatus === "CANCELLED") return null;

  const dated = validDate(subscription.nextExpectedPayment) ?? validDate(subscription.expectedDate);
  const oneOff = subscription.lifecycleStatus === "ONE_OFF" || subscription.frequency === "ONE_OFF";
  if (oneOff) {
    if (!dated || dated.getFullYear() !== month.getFullYear() || dated.getMonth() !== month.getMonth()) return null;
    return dated.getDate();
  }

  if (subscription.lifecycleStatus === "API_CREDIT" && !dated) return null;
  if (dated) return Math.min(dated.getDate(), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
  if (!Number.isInteger(subscription.dueDay) || subscription.dueDay < 1 || subscription.dueDay > 31) return null;
  if (subscription.lifecycleStatus === "TO_CHECK" && subscription.amount <= 0) return null;

  return Math.min(subscription.dueDay, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
}

export function calendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
}

export function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}
