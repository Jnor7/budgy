import { describe, expect, it } from "vitest";
import { budgetSummary, buildCarryOver, canCarryOver, carriedCopyOf, carryOverDate, entriesForMonth } from "@/lib/domain/budget";
import { camelToSnake, fromDatabaseRow, toDatabaseRow } from "@/lib/data/entity-map";
import type { BudgetEntry } from "@/types/domain";

const entry = (patch: Partial<BudgetEntry>): BudgetEntry => ({
  id: crypto.randomUUID(), userId: "user", title: "Loyer Mennecy", amount: 900, type: "depense", category: "Logement",
  bucket: "Charge fixe", scope: "Perso", date: new Date(2026, 9, 12, 12).toISOString(), note: "", potentialAmount: 0, status: "non", ...patch,
});

describe("Report au mois suivant", () => {
  it("ne permet de reporter qu'une dépense non payée qui n'est pas déjà un report", () => {
    expect(canCarryOver(entry({}))).toBe(true);
    expect(canCarryOver(entry({ status: "recu" }))).toBe(false);
    expect(canCarryOver(entry({ type: "revenu" }))).toBe(false);
    expect(canCarryOver(entry({ carriedFromId: crypto.randomUUID() }))).toBe(false);
  });

  it("crée la copie en novembre sans toucher à la ligne d'octobre", () => {
    const rent = entry({});
    const snapshot = { ...rent };
    const copy = buildCarryOver(rent);
    expect(rent).toEqual(snapshot);
    expect(copy).toMatchObject({ title: "Loyer Mennecy", amount: 900, status: "non", carriedFromId: rent.id });
    const date = new Date(copy.date);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 12]);
  });

  it("ramène le jour à la fin du mois suivant si besoin", () => {
    const date = carryOverDate(entry({ date: new Date(2026, 0, 31, 12).toISOString() }));
    expect([date.getMonth(), date.getDate()]).toEqual([1, 28]);
    expect(carryOverDate(entry({ date: new Date(2026, 11, 15, 12).toISOString() })).getFullYear()).toBe(2027);
  });

  it("retrouve le report, annulable en retirant la copie", () => {
    const rent = entry({});
    const copy = { ...buildCarryOver(rent), id: crypto.randomUUID(), userId: "user" } as BudgetEntry;
    expect(carriedCopyOf([rent, copy], rent)?.id).toBe(copy.id);
    expect(carriedCopyOf([rent], rent)).toBeUndefined();
  });

  it("compte le montant dans les deux mois", () => {
    const rent = entry({});
    const copy = { ...buildCarryOver(rent), id: crypto.randomUUID(), userId: "user" } as BudgetEntry;
    const all = [rent, copy];
    expect(budgetSummary(entriesForMonth(all, new Date(2026, 9, 1))).pendingExpenses).toBe(900);
    expect(budgetSummary(entriesForMonth(all, new Date(2026, 10, 1))).pendingExpenses).toBe(900);
  });

  it("se persiste dans la colonne carried_from_id", () => {
    expect(camelToSnake("carriedFromId")).toBe("carried_from_id");
    const rent = entry({});
    const row = toDatabaseRow({ ...rent, carriedFromId: "abc" } as BudgetEntry);
    expect(row.carried_from_id).toBe("abc");
    expect((fromDatabaseRow(row) as BudgetEntry).carriedFromId).toBe("abc");
  });
});
