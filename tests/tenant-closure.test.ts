import { describe, expect, it } from "vitest";
import { rentYearRows, rentYearSummary, isRentMonthActionable } from "@/lib/domain/rent-history";
import { carryOverForMonth, isAfterTenancy, isTenantActive, lastBillableMonth, totalDueForMonth } from "@/lib/domain/tenants";
import type { RentPayment, Tenant } from "@/types/domain";

const base: Tenant = { id: "t", userId: "u", name: "A", monthlyRent: 500, dueDay: 5, note: "", createdAt: "2026-01-10T12:00:00Z" };
const closed: Tenant = { ...base, endedOn: "2026-04-15" };
const payment = (year: number, month: number, amountReceived: number): RentPayment => ({ id: `${year}-${month}`, userId: "u", tenantId: "t", year, month, amountDue: 500, amountReceived, carryOver: 0, isPaid: amountReceived >= 500, note: "" });
const payments = [payment(2026, 1, 500), payment(2026, 2, 500), payment(2026, 3, 500), payment(2026, 4, 300)];

describe("clôture de location", () => {
  it("distingue actif et ancien locataire", () => {
    const now = new Date(2026, 5, 1);
    expect(isTenantActive(base, now)).toBe(true);
    expect(isTenantActive({ ...base, endedOn: "2026-06-01" }, now)).toBe(true);
    expect(isTenantActive(closed, now)).toBe(false);
  });

  it("lit le mois de fin sans décalage de fuseau", () => {
    expect(lastBillableMonth(closed)).toEqual({ year: 2026, month: 4 });
    expect(lastBillableMonth(base)).toBeUndefined();
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
