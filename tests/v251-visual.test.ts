import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { quickActionsForContext } from "@/components/quick-actions";
import { categoryColor } from "@/components/ui/v2";

describe("recalibration visuelle V2.5.1", () => {
  it("utilise le slogan officiel sans reconstruire le parcours Auth", () => {
    const source = readFileSync(path.join(process.cwd(), "app/auth/page.tsx"), "utf8");
    expect(source).toContain("Gérez aujourd’hui.");
    expect(source).toContain("Préparez demain.");
    expect(source).toContain("resolvePostSignup");
  });

  it("centralise les couleurs stables des catégories Budget", () => {
    expect(categoryColor("Fixes")).toBe("var(--v2-cat-fixes)");
    expect(categoryColor("Abonnements")).toBe("var(--v2-cat-abonnements)");
    expect(categoryColor("Variables")).toBe("var(--v2-cat-variables)");
    expect(categoryColor("Voyage")).toBe("var(--v2-cat-voyages)");
    expect(categoryColor("Business")).toBe("var(--v2-cat-business)");
  });

  it("ne propose que des actions directes correspondant aux modules actifs", () => {
    const budgetOnly = quickActionsForContext({ budget: true, rentals: false, businesses: false, dubaiStock: false });
    expect(budgetOnly.map((action) => action.key)).toEqual(["expense", "income", "copy-budget"]);
    expect(budgetOnly.every((action) => action.href.includes("action="))).toBe(true);
    const management = quickActionsForContext({ budget: false, rentals: true, businesses: true, dubaiStock: true });
    expect(management.map((action) => action.key)).toEqual(["rent-payment", "dubai-sale", "dubai-expense"]);
    expect(quickActionsForContext({ budget: false, rentals: false, businesses: true, dubaiStock: false }).map((action) => action.key)).toEqual(["dubai-expense"]);
  });

  it("conserve une structure Budget dense et le formulaire montant-first", () => {
    const source = readFileSync(path.join(process.cwd(), "app/(app)/budget/page.tsx"), "utf8");
    expect(source).toContain("budget-balance-card");
    expect(source).toContain("budget-entry-row");
    expect(source.indexOf('label="Montant"')).toBeLessThan(source.indexOf('title="Détails"'));
    expect(source).toContain("onDuplicate");
  });

  it("déclare les trois seuils iPhone du brief", () => {
    const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain("max-width:430px");
    expect(css).toContain("max-width:375px");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });
});
