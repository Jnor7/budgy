import { describe, expect, it } from "vitest";
import { settlements, splitEqually, tripBalances, tripExpensesTotal, validateCustomSplit } from "@/lib/domain/trip-expenses";
import type { TripExpense, TripExpenseSplit } from "@/types/domain";

const JUNIOR = "junior";
const CHLOE = "chloe";
const ABY = "aby";

describe("splitEqually", () => {
  it("répartit un montant rond entre plusieurs personnes", () => {
    const parts = splitEqually(600, [JUNIOR, CHLOE, ABY]);
    expect(parts).toEqual([
      { userId: JUNIOR, amount: 200 },
      { userId: CHLOE, amount: 200 },
      { userId: ABY, amount: 200 },
    ]);
  });

  it("distribue le reliquat d'arrondi au centime près", () => {
    const parts = splitEqually(100, [JUNIOR, CHLOE, ABY]);
    const total = parts.reduce((sum, part) => sum + part.amount, 0);
    expect(Math.round(total * 100)).toBe(10000);
    expect(parts[0]!.amount).toBeGreaterThanOrEqual(parts[2]!.amount);
  });

  it("retourne un tableau vide sans participant", () => {
    expect(splitEqually(100, [])).toEqual([]);
  });
});

describe("validateCustomSplit", () => {
  it("valide une répartition personnalisée qui retombe sur le total", () => {
    const result = validateCustomSplit(100, [{ userId: JUNIOR, amount: 60 }, { userId: CHLOE, amount: 40 }]);
    expect(result.valid).toBe(true);
  });

  it("rejette une répartition qui ne retombe pas sur le total", () => {
    const result = validateCustomSplit(100, [{ userId: JUNIOR, amount: 60 }, { userId: CHLOE, amount: 30 }]);
    expect(result.valid).toBe(false);
    expect(result.difference).toBeCloseTo(10);
  });
});

describe("tripBalances et settlements", () => {
  const expenses: TripExpense[] = [
    {
      id: "exp-1", userId: JUNIOR, tripId: "trip-1", paidBy: JUNIOR, title: "Hôtel",
      amount: 600, currency: "EUR", date: "2027-04-02", category: "Logement", note: "",
      createdAt: "2027-04-02T10:00:00.000Z",
    },
  ];
  const splits: TripExpenseSplit[] = [
    { id: "split-1", userId: JUNIOR, expenseId: "exp-1", tripId: "trip-1", amount: 200, isSettled: false, createdAt: "" },
    { id: "split-2", userId: CHLOE, expenseId: "exp-1", tripId: "trip-1", amount: 200, isSettled: false, createdAt: "" },
    { id: "split-3", userId: ABY, expenseId: "exp-1", tripId: "trip-1", amount: 200, isSettled: false, createdAt: "" },
  ];

  it("calcule le total des dépenses partagées", () => {
    expect(tripExpensesTotal(expenses)).toBe(600);
  });

  it("calcule des soldes nets cohérents (§34 : qui doit quoi)", () => {
    const balances = tripBalances(expenses, splits, [JUNIOR, CHLOE, ABY]);
    const junior = balances.find((item) => item.userId === JUNIOR)!;
    const chloe = balances.find((item) => item.userId === CHLOE)!;
    const aby = balances.find((item) => item.userId === ABY)!;
    expect(junior.net).toBeCloseTo(400); // a payé 600, doit 200
    expect(chloe.net).toBeCloseTo(-200);
    expect(aby.net).toBeCloseTo(-200);
  });

  it("produit des virements minimaux qui soldent tous les comptes", () => {
    const balances = tripBalances(expenses, splits, [JUNIOR, CHLOE, ABY]);
    const transfers = settlements(balances);
    expect(transfers).toHaveLength(2);
    expect(transfers.every((transfer) => transfer.to === JUNIOR)).toBe(true);
    const totalTransferred = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    expect(totalTransferred).toBeCloseTo(400);
  });

  it("un montant réglé n'apparaît plus dans le solde dû", () => {
    const settled = splits.map((split) => (split.userId === CHLOE ? { ...split, isSettled: true } : split));
    const balances = tripBalances(expenses, settled, [JUNIOR, CHLOE, ABY]);
    const chloe = balances.find((item) => item.userId === CHLOE)!;
    expect(chloe.owed).toBe(0);
  });

  it("aucune dépense : tous les soldes sont à zéro", () => {
    const balances = tripBalances([], [], [JUNIOR, CHLOE]);
    expect(balances.every((item) => item.net === 0)).toBe(true);
    expect(settlements(balances)).toEqual([]);
  });
});
