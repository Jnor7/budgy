import { describe, expect, it } from "vitest";
import { rentYearRows, rentYearSummary, isRentMonthActionable } from "@/lib/domain/rent-history";
import {
  activeTenants, carryOverForMonth, closedTenantOutstanding, collectionForMonth, isAfterTenancy, isEndScheduled, isTenantActive,
  lastBillableMonth, parseIsoDate, totalDueForMonth, validateEndDate,
} from "@/lib/domain/tenants";
import type { RentPayment, Tenant, TenantDebt } from "@/types/domain";

const base: Tenant = { id: "t", userId: "u", name: "A", monthlyRent: 500, dueDay: 5, note: "", createdAt: "2026-01-10T12:00:00Z" };
const closed: Tenant = { ...base, endedOn: "2026-04-15" };
const payment = (year: number, month: number, amountReceived: number, tenantId = "t", userId = "u"): RentPayment => ({ id: `${userId}-${tenantId}-${year}-${month}`, userId, tenantId, year, month, amountDue: 500, amountReceived, carryOver: 0, isPaid: amountReceived >= 500, note: "" });
const debt = (year: number, month: number, amount: number, isPaid = false, tenantId = "t", userId = "u"): TenantDebt => ({ id: `d-${userId}-${tenantId}-${year}-${month}-${amount}`, userId, tenantId, label: "Dette", amount, year, month, isPaid, createdAt: "2026-01-01T00:00:00Z" });
const payments = [payment(2026, 1, 500), payment(2026, 2, 500), payment(2026, 3, 500), payment(2026, 4, 300)];

/** Mois consécutifs de (y1,m1) à (y2,m2) inclus. */
function months(y1: number, m1: number, y2: number, m2: number) {
  const out: Array<[number, number]> = [];
  for (let k = y1 * 12 + m1 - 1; k <= y2 * 12 + m2 - 1; k += 1) out.push([Math.floor(k / 12), (k % 12) + 1]);
  return out;
}
/** Un loyer de 500 € intégralement payé chaque mois, sauf les mois `partial` ([année, mois, montant]). */
const paidMonths = (from: [number, number], to: [number, number], partial: Array<[number, number, number]> = [], tenantId = "t") =>
  months(from[0], from[1], to[0], to[1]).map(([y, m]) => payment(y, m, partial.find(([py, pm]) => py === y && pm === m)?.[2] ?? 500, tenantId));

describe("clôture de location", () => {
  it("distingue actif et ancien locataire", () => {
    const now = new Date(2026, 5, 1);
    expect(isTenantActive(base, now)).toBe(true);
    expect(isTenantActive({ ...base, endedOn: "2026-06-01" }, now)).toBe(true);
    expect(isTenantActive(closed, now)).toBe(false);
    expect(activeTenants([base, closed], now).map((tenant) => tenant.endedOn)).toEqual([undefined]);
  });

  it("lit le mois de fin sans décalage de fuseau", () => {
    expect(lastBillableMonth(closed)).toEqual({ year: 2026, month: 4 });
    expect(lastBillableMonth(base)).toBeUndefined();
    expect(lastBillableMonth({ ...base, endedOn: "2026-02-30" })).toBeUndefined();
  });

  it("garde les calculs identiques jusqu'au mois de fin inclus", () => {
    for (const month of [1, 2, 3, 4]) {
      expect(totalDueForMonth(closed, payments, [], 2026, month)).toBe(totalDueForMonth(base, payments, [], 2026, month));
    }
    expect(carryOverForMonth(closed, payments, [], 2026, 4)).toBe(0);
  });

  it("ne génère aucune échéance ni report après la date de fin", () => {
    expect(isAfterTenancy(closed, 2026, 5)).toBe(true);
    expect(totalDueForMonth(closed, payments, [], 2026, 5)).toBe(0);
    expect(carryOverForMonth(closed, payments, [], 2026, 5)).toBe(0);
    expect(totalDueForMonth(closed, payments, [], 2027, 1)).toBe(0);
    expect(totalDueForMonth(base, payments, [], 2026, 5)).toBe(700);
  });

  it("conserve le reste dû encaissable sur le mois de fin", () => {
    const now = new Date(2026, 8, 1);
    const rows = rentYearRows(closed, payments, [], 2026, now);
    expect(rows[3]?.remaining).toBe(200);
    expect(isRentMonthActionable(rows[3]!, now)).toBe(true);
    expect(rows[4]?.status).toBe("closed");
    expect(isRentMonthActionable(rows[4]!, now)).toBe(false);
    expect(rentYearSummary(rows, 2026, now).remaining).toBe(200);
  });
});

describe("mois de fin entièrement facturable (aucun prorata)", () => {
  it("clôture en début, milieu ou fin de mois : le mois de fin est dû en entier", () => {
    const now = new Date(2026, 8, 1);
    const reference = totalDueForMonth(base, payments, [], 2026, 4);
    for (const endedOn of ["2026-04-01", "2026-04-03", "2026-04-15", "2026-04-30"]) {
      const tenant = { ...base, endedOn };
      expect(totalDueForMonth(tenant, payments, [], 2026, 4)).toBe(reference);
      expect(rentYearRows(tenant, payments, [], 2026, now)[3]?.due).toBe(reference);
      expect(totalDueForMonth(tenant, payments, [], 2026, 5)).toBe(0);
    }
    expect(reference).toBe(500);
  });
});

describe("validation de la date de fin", () => {
  const now = new Date(2026, 5, 15);
  const none: RentPayment[] = [];

  it("refuse les dates qui ne sont pas de vraies dates calendaires", () => {
    for (const bad of ["", "abc", "2026-02-30", "2026-13-01", "2026-00-10", "2026/04/15", "2026-4-5", "15/04/2026", "2026-04-15T10:00:00Z"]) {
      expect(validateEndDate(base, bad, none, now).ok, bad).toBe(false);
    }
    expect(parseIsoDate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseIsoDate("2026-02-29")).toBeUndefined();
  });

  it("refuse une fin antérieure au début de la location, accepte le jour du début", () => {
    expect(validateEndDate(base, "2026-01-09", none, now).ok).toBe(false);
    expect(validateEndDate(base, "2026-01-10", none, now)).toEqual({ ok: true, scheduled: false });
  });

  it("refuse une fin qui rendrait invisibles des paiements déjà enregistrés", () => {
    expect(validateEndDate(base, "2026-03-31", payments, now).ok).toBe(false);
    expect(validateEndDate(base, "2026-04-01", payments, now)).toEqual({ ok: true, scheduled: false });
  });

  it("date passée ou du jour : clôture immédiate", () => {
    expect(validateEndDate(base, "2026-05-31", none, now)).toEqual({ ok: true, scheduled: false });
    expect(validateEndDate(base, "2026-06-15", none, now)).toEqual({ ok: true, scheduled: false });
  });

  it("date future : fin programmée (jusqu'à 366 jours), au-delà refusée", () => {
    expect(validateEndDate(base, "2026-06-16", none, now)).toEqual({ ok: true, scheduled: true });
    expect(validateEndDate(base, "2027-06-16", none, now)).toEqual({ ok: true, scheduled: true });
    expect(validateEndDate(base, "2027-06-17", none, now).ok).toBe(false);
    expect(validateEndDate(base, "2030-01-01", none, now).ok).toBe(false);
  });

  it("une fin programmée laisse le locataire actif et facturé jusqu'à la date, puis ancien", () => {
    const scheduled = { ...base, endedOn: "2026-08-10" };
    expect(isTenantActive(scheduled, new Date(2026, 5, 15))).toBe(true);
    expect(isEndScheduled(scheduled, new Date(2026, 5, 15))).toBe(true);
    expect(isTenantActive(scheduled, new Date(2026, 7, 10))).toBe(true);
    expect(isTenantActive(scheduled, new Date(2026, 7, 11))).toBe(false);
    expect(isEndScheduled(scheduled, new Date(2026, 7, 11))).toBe(false);
    expect(totalDueForMonth(scheduled, [], [], 2026, 8)).toBe(totalDueForMonth(base, [], [], 2026, 8));
    expect(totalDueForMonth(scheduled, [], [], 2026, 9)).toBe(0);
    const rows = rentYearRows(scheduled, [], [], 2026, new Date(2026, 5, 15));
    expect(rows[7]?.status).not.toBe("closed");
    expect(rows[8]?.status).toBe("closed");
  });
});

describe("reste dû d'un ancien locataire sur tout l'historique", () => {
  const old: Tenant = { ...base, createdAt: "2024-01-05T12:00:00Z", endedOn: "2026-04-20" };

  it("tout payé : 0", () => {
    expect(closedTenantOutstanding(old, paidMonths([2024, 1], [2026, 4]), [])).toBe(0);
  });

  it("une ancienne échéance partiellement payée reste due jusqu'à la fin (pas seulement le dernier mois)", () => {
    expect(closedTenantOutstanding(old, paidMonths([2024, 1], [2026, 4], [[2024, 6, 300]]), [])).toBe(200);
  });

  it("n'est pas limité à 36 mois d'historique", () => {
    const longOld: Tenant = { ...base, createdAt: "2022-01-05T12:00:00Z", endedOn: "2026-04-20" };
    const history = paidMonths([2022, 1], [2026, 4]).filter((p) => !(p.year === 2022 && p.month === 2));
    expect(closedTenantOutstanding(longOld, history, [])).toBe(500);
  });

  it("cumule reports, versements partiels successifs et dettes impayées", () => {
    const history = [payment(2026, 1, 400), payment(2026, 2, 300), payment(2026, 3, 500), payment(2026, 4, 100)];
    // janvier 500-400=100 ; février 500+100-300=300 ; mars 500+300+dette 150-500=450 ; avril 500+450-100=850
    expect(closedTenantOutstanding(closed, history, [debt(2026, 3, 150)])).toBe(850);
    // une dette marquée payée est ignorée
    expect(closedTenantOutstanding(closed, history, [debt(2026, 3, 150, true)])).toBe(700);
  });

  it("un trop-perçu ne se reporte pas (même modèle que l'application)", () => {
    const history = [payment(2026, 1, 900), payment(2026, 2, 0), payment(2026, 3, 500), payment(2026, 4, 500)];
    // février non payé : 500 reportés, mars 1000-500=500, avril 1000-500=500 ; le trop-perçu de janvier n'est pas déduit
    expect(closedTenantOutstanding(closed, history, [])).toBe(500);
  });

  it("compte aussi les dettes impayées situées avant le début ou après le mois de fin", () => {
    const outside = [debt(2025, 12, 40), debt(2026, 7, 80), debt(2026, 8, 25, true)];
    expect(closedTenantOutstanding(closed, paidMonths([2026, 1], [2026, 4]), outside)).toBe(120);
  });

  it("donne le même résultat que le calcul récursif sur les historiques courts", () => {
    let seed = 12345;
    const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed >>> 8; };
    for (let run = 0; run < 150; run += 1) {
      const span = 1 + (next() % 20);
      const [startYear, startMonth] = months(2025, 1, 2026, 12)[next() % 12]!;
      const startIndex = startYear * 12 + startMonth - 1;
      const range = months(startYear, startMonth, Math.floor((startIndex + span - 1) / 12), ((startIndex + span - 1) % 12) + 1);
      const [endYear, endMonth] = range.at(-1)!;
      const tenant: Tenant = { ...base, createdAt: `${startYear}-${String(startMonth).padStart(2, "0")}-10T12:00:00Z`, endedOn: `${endYear}-${String(endMonth).padStart(2, "0")}-15` };
      const pays: RentPayment[] = [];
      const debts: TenantDebt[] = [];
      for (const [y, m] of range) {
        if (next() % 5 > 0) pays.push(payment(y, m, [0, 200, 500, 700][next() % 4]!));
        if (next() % 4 === 0) debts.push(debt(y, m, 50 + (next() % 200), next() % 3 === 0));
      }
      const last = lastBillableMonth(tenant)!;
      const receivedLast = pays.filter((p) => p.year === last.year && p.month === last.month).reduce((sum, p) => sum + p.amountReceived, 0);
      const recursive = Math.max(totalDueForMonth(tenant, pays, debts, last.year, last.month) - receivedLast, 0);
      expect(closedTenantOutstanding(tenant, pays, debts), `run ${run}`).toBe(recursive);
    }
  });

  it("renvoie 0 pour un locataire non clôturé", () => {
    expect(closedTenantOutstanding(base, [], [])).toBe(0);
  });
});

describe("isolation des données entre utilisateurs et entre locataires", () => {
  const foreignPayments = months(2026, 1, 2026, 4).map(([y, m]) => payment(y, m, 500, "other-tenant", "other-user"));
  const foreignDebts = [debt(2026, 3, 900, false, "other-tenant", "other-user")];

  it("les paiements et dettes d'un autre utilisateur n'influencent ni les échéances ni le reste dû", () => {
    expect(totalDueForMonth(closed, [...payments, ...foreignPayments], foreignDebts, 2026, 4)).toBe(totalDueForMonth(closed, payments, [], 2026, 4));
    expect(closedTenantOutstanding(closed, [...payments, ...foreignPayments], foreignDebts)).toBe(closedTenantOutstanding(closed, payments, []));
    expect(closedTenantOutstanding(closed, payments, [])).toBe(200);
  });

  it("la collecte ne compte que les paiements des locataires fournis", () => {
    const alone = collectionForMonth([closed], [...payments, ...foreignPayments], foreignDebts, 2026, 4);
    expect(alone).toMatchObject({ expected: 500, paid: 300, paidTenants: 0, remaining: 200 });
  });
});

describe("indicateurs de collecte quand un locataire devient ancien", () => {
  const a: Tenant = { ...base, id: "a", monthlyRent: 600 };
  const b: Tenant = { ...base, id: "b", monthlyRent: 500 };
  const bClosed: Tenant = { ...b, endedOn: "2026-04-15" };
  const pays = [
    ...paidMonths([2026, 1], [2026, 4], [], "b"),
    ...months(2026, 1, 2026, 6).map(([y, m]) => ({ ...payment(y, m, 600, "a"), amountDue: 600 })),
  ];

  it("les mois jusqu'au mois de fin inclus sont identiques avant et après la clôture", () => {
    for (const month of [1, 2, 3, 4]) {
      expect(collectionForMonth([a, bClosed], pays, [], 2026, month)).toEqual(collectionForMonth([a, b], pays, [], 2026, month));
    }
  });

  it("après le mois de fin, l'ancien locataire sort de la collecte (aucune échéance fantôme)", () => {
    expect(collectionForMonth([a, bClosed], pays, [], 2026, 5)).toMatchObject({ expected: 600, paid: 600, paidTenants: 1, remaining: 0, progress: 100 });
    expect(collectionForMonth([a, b], pays, [], 2026, 5).expected).toBe(1100);
  });

  it("le nombre de locataires courants ignore les anciens ; une fin programmée reste comptée", () => {
    const now = new Date(2026, 5, 1);
    expect(activeTenants([a, bClosed], now).map((tenant) => tenant.id)).toEqual(["a"]);
    expect(activeTenants([a, { ...b, endedOn: "2026-09-01" }], now).map((tenant) => tenant.id)).toEqual(["a", "b"]);
  });

  it("le dernier mois d'une fin programmée est encore collecté, le suivant non", () => {
    const scheduled: Tenant = { ...b, endedOn: "2026-08-10" };
    expect(collectionForMonth([a, scheduled], [], [], 2026, 8).expected).toBe(totalDueForMonth(a, [], [], 2026, 8) + totalDueForMonth(b, [], [], 2026, 8));
    expect(collectionForMonth([a, scheduled], [], [], 2026, 9).expected).toBe(totalDueForMonth(a, [], [], 2026, 9));
  });
});
