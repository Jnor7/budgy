import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { quickActionsForContext } from "@/components/quick-actions";
import { rentYearRows, rentYearSummary } from "@/lib/domain/rent-history";
import { navigationLabel, primaryNavigationModules } from "@/lib/modules/registry";
import type { RentPayment, Tenant } from "@/types/domain";

const tenant: Tenant = {
  id: "tenant-1", userId: "user-1", name: "Destin", monthlyRent: 350, dueDay: 12,
  note: "", createdAt: "2026-01-01T12:00:00.000Z",
};
const payment = (month: number, amountReceived: number): RentPayment => ({
  id: `payment-${month}`, userId: "user-1", tenantId: tenant.id, month, year: 2026,
  isPaid: amountReceived >= 350, paidDate: "2026-01-12T12:00:00.000Z",
  amountDue: 350, amountReceived, carryOver: 0, note: "",
});

describe("Budgy V2.5.3 Premium Structure", () => {
  it("ouvre Dépense et Revenu comme actions locales, sans href de navigation", () => {
    const source = readFileSync(path.join(process.cwd(), "components/quick-actions.tsx"), "utf8");
    expect(source).toContain('action === "expense" || action === "income"');
    expect(source).toContain("<button className={`quick-action");
    expect(source).not.toContain("href=");
  });

  it("limite les actions rapides à six et expose les actions Dubaï utiles", () => {
    const actions = quickActionsForContext({
      modules: ["budget", "rentals", "businesses", "trips", "subscriptions"],
      hasTenants: true,
      hasDubaiParts: true,
    });
    expect(actions).toHaveLength(6);
    expect(actions.map((action) => action.key)).toEqual([
      "expense", "income", "copy-budget", "rent-payment", "dubai-sale", "dubai-cash",
    ]);
  });

  it("conserve quatre modules maximum et des labels courts sans ellipse", () => {
    expect(primaryNavigationModules(["budget", "subscriptions", "trips", "rentals", "businesses"])).toHaveLength(4);
    expect(navigationLabel("subscriptions")).toBe("Abos");
    expect(navigationLabel("rentals")).toBe("Loyers");
    expect(navigationLabel("businesses")).toBe("Business");
  });

  it("produit les douze mois et un résumé annuel locatif", () => {
    const now = new Date("2026-04-20T12:00:00.000Z");
    const rows = rentYearRows(tenant, [payment(1, 350), payment(2, 175)], [], 2026, now);
    const summary = rentYearSummary(rows, 2026, now);
    expect(rows).toHaveLength(12);
    expect(rows[0]?.status).toBe("paid");
    expect(rows[1]?.status).toBe("partial");
    expect(rows[2]?.status).toBe("overdue");
    expect(summary.settledMonths).toBe(1);
    expect(summary.received).toBe(525);
    expect(summary.hasLatePayment).toBe(true);
  });

  it("répercute immédiatement un paiement dans le modèle affiché", () => {
    const now = new Date("2026-01-20T12:00:00.000Z");
    const before = rentYearRows(tenant, [], [], 2026, now);
    const after = rentYearRows(tenant, [payment(1, 350)], [], 2026, now);
    expect(before[0]?.status).toBe("overdue");
    expect(after[0]?.status).toBe("paid");
    expect(rentYearSummary(after, 2026, now).received).toBe(350);
  });

  it("branche le détail locataire sur paiement, dette et historique annuel", () => {
    const source = readFileSync(path.join(process.cwd(), "app/(app)/rentals/[id]/page.tsx"), "utf8");
    expect(source).toContain("rentYearRows");
    expect(source).toContain("RentPaymentSheet");
    expect(source).toContain("RentDebtSheet");
    expect(source).toContain("Paiements {year}");
  });

  it("persiste l’ordre réorganisé via la source de données existante", () => {
    const source = readFileSync(path.join(process.cwd(), "app/(app)/settings/modules/page.tsx"), "utf8");
    expect(source).toContain("await setModules(next)");
    expect(source).toContain("setPointerCapture");
    expect(source).toContain("is-drop-target");
  });
});
