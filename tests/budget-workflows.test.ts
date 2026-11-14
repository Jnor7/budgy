import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { budgetSummary } from "@/lib/domain/budget";
import type { BudgetEntry } from "@/types/domain";

const entry = (patch: Partial<BudgetEntry>): BudgetEntry => ({
  id: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  title: "Ligne",
  amount: 100,
  type: "depense",
  category: "Divers",
  bucket: "Variable",
  scope: "Perso",
  date: "2026-11-10",
  note: "",
  potentialAmount: 100,
  status: "non",
  currency: "EUR",
  paymentStatus: "planned",
  affectsProjection: true,
  ...patch,
});

describe("budget line workflows", () => {
  it("shows a family loan as real cash-in but not earned income", () => {
    const summary = budgetSummary([
      entry({
        title: "Salaire",
        type: "revenu",
        amount: 2452.29,
        status: "recu",
        paymentStatus: "received",
        affectsProjection: false,
        countsAsEarnedIncome: true,
      }),
      entry({
        title: "Prêt familial",
        type: "revenu",
        amount: 5000,
        status: "recu",
        paymentStatus: "received",
        affectsProjection: false,
        countsAsEarnedIncome: false,
      }),
    ]);
    expect(summary.confirmedIncome).toBe(7452.29);
    expect(summary.earnedIncome).toBe(2452.29);
  });

  it("keeps missed Destin lines visible while counting their December reports once", () => {
    const summary = budgetSummary([
      entry({
        title: "Destin — loyer novembre",
        type: "revenu",
        amount: 350,
        potentialAmount: 350,
        paymentStatus: "cancelled",
        affectsProjection: false,
        rolloverStatus: "carried_out",
      }),
      entry({
        title: "Destin — ancien arriéré",
        type: "revenu",
        amount: 100,
        potentialAmount: 100,
        paymentStatus: "cancelled",
        affectsProjection: false,
        rolloverStatus: "carried_out",
      }),
      entry({
        title: "Arriéré Destin — loyer novembre",
        type: "revenu",
        amount: 350,
        potentialAmount: 350,
        paymentStatus: "planned",
        affectsProjection: true,
        rolloverStatus: "carried_in",
      }),
      entry({
        title: "Arriéré Destin — ancien arriéré",
        type: "revenu",
        amount: 100,
        potentialAmount: 100,
        paymentStatus: "planned",
        affectsProjection: true,
        rolloverStatus: "carried_in",
      }),
    ]);
    expect(summary.pendingIncome).toBe(450);
    expect(summary.projectedBalance).toBe(450);
  });

  it("keeps planned USD supplier payments out of EUR totals", () => {
    expect(
      budgetSummary([
        entry({ title: "Zhongda — acompte 1", amount: 2925, currency: "USD" }),
      ]).pendingExpenses,
    ).toBe(0);
  });

  it("adds rollover traceability and transaction sub-details additively", () => {
    const sql = readFileSync(
      "supabase/migrations/20261113180914_budget_line_workflows.sql",
      "utf8",
    ).toLowerCase();
    expect(sql).toContain("original_entry_id");
    expect(sql).toContain("budget_entry_id");
    expect(sql).toContain("counts_as_earned_income");
    expect(sql).not.toMatch(/\bdrop\s+table\b|\bdelete\s+from\b/);
  });

  it("removes all banking and standalone finance UI routes", () => {
    expect(existsSync("app/(app)/banking/page.tsx")).toBe(false);
    expect(existsSync("app/(app)/finance/page.tsx")).toBe(false);
    const more = readFileSync("app/(app)/more/page.tsx", "utf8");
    expect(more).not.toContain("/banking");
    const navigation = readFileSync("lib/modules/registry.ts", "utf8");
    expect(navigation).toContain('href: "/budget"');
    expect(navigation).not.toContain("/finance");
    expect(navigation).not.toContain("/banking");
  });

  it("affiche les budgets variables comme des lignes ordinaires avec leurs sous-détails", () => {
    const page = readFileSync("app/(app)/budget/page.tsx", "utf8");
    expect(page).not.toContain("BudgetEnvelopeView");
    expect(page).not.toContain("/api/budget/envelopes");
    expect(page).not.toContain("budget-target-row");
    expect(page).toContain("budget-inline-details");
    expect(page).toContain("aria-expanded={expanded}");
  });

  it("convertit les enveloppes sans supprimer leur archive historique", () => {
    const migration = readFileSync(
      "neon/migrations/202611140001_convert_budget_envelopes_to_expenses.sql",
      "utf8",
    ).toLowerCase();
    expect(migration).toContain("insert into public.budget_entries");
    expect(migration).toContain("restaurants / fast-food");
    expect(migration).toContain("divers / plaisir");
    expect(migration).not.toMatch(/\bdrop\s+table\b|\bdelete\s+from\b/);
  });
});
