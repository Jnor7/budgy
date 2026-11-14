import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { travelFinancialSummary } from "@/lib/domain/travel-finance";
import { isTripArchived, visibleTrips } from "@/lib/domain/permissions";
import type { Trip } from "@/types/domain";

const trip = (patch: Partial<Trip> = {}): Trip => ({
  id: "trip", userId: "owner", title: "Voyage", destinationSummary: "France",
  startDate: "2026-01-01", endDate: "2026-01-02", peopleCount: 1, targetBudget: 1000,
  notes: "", isCompleted: true, createdAt: "2026-01-01", coverImageUrl: "", ...patch,
});

describe("historique Travel", () => {
  it("masque les voyages archivés sans les supprimer", () => {
    const archived = trip({ id: "archived", notes: "[ARCHIVED] Voyage de démonstration masqué" });
    expect(isTripArchived(archived)).toBe(true);
    expect(visibleTrips([trip(), archived], [], "owner").map((item) => item.id)).toEqual(["trip"]);
  });

  it("distingue total partiel réel, estimation et absence de données", () => {
    expect(travelFinancialSummary(trip({ notes: "[TOTAL_PARTIEL]" }), 0, 1127)).toEqual(expect.objectContaining({ amount: 1127, basis: "known" }));
    expect(travelFinancialSummary(trip({ notes: "[TOTAL_ESTIME]" }), 0, 0)).toEqual(expect.objectContaining({ amount: 1000, basis: "estimated" }));
    expect(travelFinancialSummary(trip({ notes: "[DONNEES_PARTIELLES]" }), 0, 0).basis).toBe("unavailable");
  });

  it("reconstruit Miami uniquement depuis la trace Budget JR de 800 EUR", () => {
    const script = readFileSync("scripts/reconcile-travel-2026.mjs", "utf8");
    expect(script).toContain("dubai_cash_movement_000001");
    expect(script).toContain("Number(miamiTrace.amount) !== 800");
    expect(script).toContain("Dates de séjour et ventilation à compléter");
    expect(script).not.toContain('missingReliableTraces: ["Miami"');
  });
});
