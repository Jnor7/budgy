import type { RentPayment, Tenant, TenantDebt } from "@/types/domain";

const key = (year: number, month: number) => year * 12 + month - 1;
const previousMonth = (year: number, month: number) => month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

/** Date calendaire réelle « AAAA-MM-JJ » (refuse 2026-02-30, 2026-13-01, formats libres). Tolère un suffixe horaire ISO. */
export function parseIsoDate(value: string | undefined | null): { year: number; month: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value ?? "");
  if (!match) return undefined;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? { year, month, day } : undefined;
}

const localDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Dernier mois facturable (celui de la date de fin), ou undefined si la location n'est pas clôturée. */
export function lastBillableMonth(tenant: Tenant): { year: number; month: number } | undefined {
  const ymd = parseIsoDate(tenant.endedOn);
  return ymd ? { year: ymd.year, month: ymd.month } : undefined;
}

/** Vrai si le mois demandé est postérieur au mois de fin : aucune échéance ni report n'y est généré. */
export function isAfterTenancy(tenant: Tenant, year: number, month: number): boolean {
  const last = lastBillableMonth(tenant);
  return last !== undefined && key(year, month) > key(last.year, last.month);
}

/** Actif tant que la date de fin n'est pas dépassée ; ancien locataire ensuite. */
export function isTenantActive(tenant: Tenant, now = new Date()): boolean {
  const end = parseIsoDate(tenant.endedOn);
  return !end || tenant.endedOn!.slice(0, 10) >= localDateString(now);
}

export { localDateString };

/** Fin de location programmée dans le futur : le locataire reste actif et facturé jusqu'à cette date incluse. */
export function isEndScheduled(tenant: Tenant, now = new Date()): boolean {
  return Boolean(tenant.endedOn) && isTenantActive(tenant, now);
}

/** Jour de début de location (jour de création du locataire, heure locale). */
export function tenancyStartDate(tenant: Tenant): string {
  const created = new Date(tenant.createdAt);
  return Number.isNaN(created.getTime()) ? "" : localDateString(created);
}

/** Une fin de location ne peut pas être programmée plus d'un an à l'avance (même borne qu'ATLAS : 366 jours). */
export const MAX_END_DATE_DAYS_AHEAD = 366;

export type EndDateCheck = { ok: true; scheduled: boolean } | { ok: false; error: string };

/**
 * Valide une date de fin de location :
 *  - date calendaire réelle ; jamais antérieure au début de la location ;
 *  - jamais antérieure au dernier mois où un paiement est enregistré (sinon l'historique deviendrait invisible) ;
 *  - passée ou du jour : clôture immédiate (le locataire passe dans « Anciens ») ;
 *  - future (jusqu'à 366 jours) : fin PROGRAMMÉE, le locataire reste actif et facturé jusqu'à cette date incluse.
 * Le mois de fin reste intégralement facturable (aucun prorata).
 */
export function validateEndDate(tenant: Tenant, value: string, payments: RentPayment[], now = new Date()): EndDateCheck {
  const end = parseIsoDate(value);
  if (!end || value.length !== 10) return { ok: false, error: "Date invalide : utilise une date réelle au format JJ/MM/AAAA." };
  const start = tenancyStartDate(tenant);
  if (start && value < start) return { ok: false, error: `La fin de location ne peut pas précéder son début (${start.split("-").reverse().join("/")}).` };
  const lastPaid = payments.filter((payment) => payment.tenantId === tenant.id && payment.amountReceived > 0).reduce((max, payment) => Math.max(max, key(payment.year, payment.month)), -1);
  if (lastPaid > key(end.year, end.month)) return { ok: false, error: "Des paiements sont enregistrés après le mois de fin : choisis une date plus tardive." };
  const today = localDateString(now);
  if (value > today) {
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_END_DATE_DAYS_AHEAD);
    if (value > localDateString(limit)) return { ok: false, error: "La fin de location ne peut pas être programmée à plus d'un an." };
    return { ok: true, scheduled: true };
  }
  return { ok: true, scheduled: false };
}

/**
 * Reste dû d'un locataire clôturé sur TOUT l'historique : échéances, reports et dettes impayés, du début de la location jusqu'au mois de fin,
 * plus les dettes impayées situées hors de cette période (avant le début ou après la fin). Même modèle que `carryOverForMonth`
 * (un trop-perçu d'un mois ne se reporte pas) mais calculé par boucle, donc sans la limite de 36 mois de la récursion.
 * Renvoie 0 si la location n'est pas clôturée.
 */
export function closedTenantOutstanding(tenant: Tenant, payments: RentPayment[], debts: TenantDebt[]): number {
  const last = lastBillableMonth(tenant);
  if (!last) return 0;
  const created = new Date(tenant.createdAt);
  const startKey = Number.isNaN(created.getTime()) ? key(last.year, last.month) : key(created.getFullYear(), created.getMonth() + 1);
  const lastKey = key(last.year, last.month);
  const mine = debts.filter((debt) => debt.tenantId === tenant.id && !debt.isPaid);
  const receivedByMonth = new Map<number, number>();
  for (const payment of payments) {
    if (payment.tenantId !== tenant.id) continue;
    const k = key(payment.year, payment.month);
    receivedByMonth.set(k, (receivedByMonth.get(k) ?? 0) + payment.amountReceived);
  }
  const debtByMonth = new Map<number, number>();
  let outside = 0;
  for (const debt of mine) {
    const k = key(debt.year, debt.month);
    if (k < startKey || k > lastKey) outside += debt.amount;
    else debtByMonth.set(k, (debtByMonth.get(k) ?? 0) + debt.amount);
  }
  let carry = 0;
  for (let k = startKey; k <= lastKey; k += 1) {
    const due = tenant.monthlyRent + carry + (debtByMonth.get(k) ?? 0);
    carry = Math.max(due - (receivedByMonth.get(k) ?? 0), 0);
  }
  return carry + outside;
}

export interface SettlementMonth { year: number; month: number; amount: number; debtLabels: string[] }
export interface ClosedTenantSettlement {
  /** Échéances (loyer + dettes du mois) encore impayées, de la plus ancienne à la plus récente, après imputation des versements. */
  months: SettlementMonth[];
  /** Dettes impayées situées hors de la période de location : elles ne passent pas par un paiement mensuel. */
  outsideDebts: TenantDebt[];
}

/**
 * Détail du reste dû d'un locataire clôturé, par échéance. Le versement d'un mois solde d'abord l'échéance de ce mois, l'excédent éponge les arriérés les plus anciens
 * (même total que `closedTenantOutstanding`) ; un trop-perçu au-delà de tout arriéré n'est pas reporté. Sert à choisir la bonne échéance à encaisser.
 */
export function closedTenantSettlement(tenant: Tenant, payments: RentPayment[], debts: TenantDebt[]): ClosedTenantSettlement {
  const last = lastBillableMonth(tenant);
  if (!last) return { months: [], outsideDebts: [] };
  const created = new Date(tenant.createdAt);
  const lastKey = key(last.year, last.month);
  const startKey = Number.isNaN(created.getTime()) ? lastKey : key(created.getFullYear(), created.getMonth() + 1);
  const mine = debts.filter((debt) => debt.tenantId === tenant.id && !debt.isPaid);
  const outsideDebts = mine.filter((debt) => key(debt.year, debt.month) < startKey || key(debt.year, debt.month) > lastKey);
  const queue: Array<SettlementMonth & { k: number }> = [];
  for (let k = startKey; k <= lastKey; k += 1) {
    const year = Math.floor(k / 12), month = (k % 12) + 1;
    const inMonth = mine.filter((debt) => debt.year === year && debt.month === month);
    queue.push({ k, year, month, amount: tenant.monthlyRent + inMonth.reduce((sum, debt) => sum + debt.amount, 0), debtLabels: inMonth.map((debt) => debt.label) });
    let received = payments.filter((payment) => payment.tenantId === tenant.id && payment.year === year && payment.month === month).reduce((sum, payment) => sum + payment.amountReceived, 0);
    // le versement d'un mois solde d'abord l'échéance de CE mois ; l'excédent éponge les arriérés, du plus ancien au plus récent
    const own = queue[queue.length - 1]!;
    const ownTake = Math.min(own.amount, received);
    own.amount -= ownTake; received -= ownTake;
    for (const item of queue) {
      if (received <= 0) break;
      const take = Math.min(item.amount, received);
      item.amount -= take; received -= take;
    }
    while (queue.length && queue[0]!.amount <= 0) queue.shift();
    for (let i = queue.length - 1; i >= 0; i -= 1) if (queue[i]!.amount <= 0) queue.splice(i, 1);
  }
  return { months: queue.map(({ year, month, amount, debtLabels }) => ({ year, month, amount, debtLabels })), outsideDebts };
}

/** Locataires dont la location est en cours (fin non atteinte). Les anciens ne sont ni comptés ni proposés pour de nouveaux paiements. */
export const activeTenants = (tenants: Tenant[], now = new Date()) => tenants.filter((tenant) => isTenantActive(tenant, now));

/**
 * Indicateurs de collecte d'un mois, calculés sur TOUS les locataires facturables ce mois-là : un locataire clôturé reste compté
 * jusqu'à son mois de fin inclus (mois entièrement facturable) et n'apparaît plus après. Seuls les paiements des locataires fournis comptent.
 */
export function collectionForMonth(tenants: Tenant[], payments: RentPayment[], debts: TenantDebt[], year: number, month: number) {
  let expected = 0, paid = 0, paidTenants = 0;
  for (const tenant of tenants) {
    const total = totalDueForMonth(tenant, payments, debts, year, month);
    const got = payments.filter((payment) => payment.tenantId === tenant.id && payment.year === year && payment.month === month).reduce((sum, payment) => sum + payment.amountReceived, 0);
    expected += total; paid += got;
    if (total > 0 && got >= total) paidTenants += 1;
  }
  return { expected, paid, paidTenants, remaining: Math.max(expected - paid, 0), progress: expected ? Math.min(paid / expected * 100, 100) : 0 };
}

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
  const carry = carryOverForMonth(tenant, payments, debts, year, month, depth);
  const debt = debts
    .filter((item) => item.tenantId === tenant.id && item.year === year && item.month === month && !item.isPaid)
    .reduce((sum, item) => sum + item.amount, 0);
  return tenant.monthlyRent + carry + debt;
}
