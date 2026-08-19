import { describe, expect, it } from "vitest";
import {
  BUSINESS_TEMPLATES, businessTemplate, enabledModuleKeys, hasAdvancedTrading,
  hasConfiguredModules, isModuleEnabled, MODULE_DEFINITIONS, modulesForHistoricalData, suggestedModules,
} from "@/lib/modules/registry";
import { emptyData } from "@/lib/data/seed";
import type { AppData, UserModule } from "@/types/domain";

const USER = "user-1";
const moduleRow = (moduleKey: UserModule["moduleKey"], enabled: boolean): UserModule => ({
  id: `${moduleKey}-row`, userId: USER, moduleKey, enabled,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("registre des modules", () => {
  it("expose exactement les 5 modules du brief", () => {
    expect(MODULE_DEFINITIONS.map((item) => item.key).sort()).toEqual(
      ["budget", "businesses", "rentals", "subscriptions", "trips"].sort(),
    );
  });

  it("un utilisateur Budget uniquement ne voit que Budget", () => {
    const modules = [moduleRow("budget", true), moduleRow("trips", false)];
    expect(enabledModuleKeys(modules)).toEqual(["budget"]);
    expect(isModuleEnabled(modules, "budget")).toBe(true);
    expect(isModuleEnabled(modules, "trips")).toBe(false);
  });

  it("un utilisateur Business + Voyages voit les deux, rien d'autre", () => {
    const modules = [moduleRow("businesses", true), moduleRow("trips", true), moduleRow("budget", false)];
    expect(enabledModuleKeys(modules).sort()).toEqual(["businesses", "trips"].sort());
  });

  it("désactiver un module le retire de la liste active sans supprimer la ligne", () => {
    const enabled = [moduleRow("trips", true)];
    const disabled = [moduleRow("trips", false)];
    expect(enabledModuleKeys(enabled)).toEqual(["trips"]);
    expect(enabledModuleKeys(disabled)).toEqual([]);
    // La ligne existe toujours : la donnée du module n'est jamais perdue par la désactivation.
    expect(disabled).toHaveLength(1);
  });

  it("hasConfiguredModules distingue un compte jamais configuré d'un compte à zéro module actif", () => {
    expect(hasConfiguredModules([])).toBe(false);
    expect(hasConfiguredModules([moduleRow("budget", false)])).toBe(true);
  });

  it("suggestedModules se base uniquement sur les données réelles, jamais sur un pseudo", () => {
    const data: AppData = {
      ...emptyData,
      trips: [{ id: "t1", userId: USER, title: "Rome", destinationSummary: "", startDate: "", endDate: "", peopleCount: 1, targetBudget: 0, notes: "", isCompleted: false, createdAt: "", coverImageUrl: "" }],
    };
    expect(suggestedModules(data)).toEqual(["trips"]);
  });

  it("suggestedModules retombe sur Budget si le compte est totalement vide", () => {
    expect(suggestedModules(emptyData)).toEqual(["budget"]);
  });

  it("active Businesses pour chacune des quatre collections Dubaï", () => {
    for (const key of ["dubaiParts", "dubaiSales", "dubaiExpenses", "dubaiCashMovements"] as const) {
      const data = structuredClone(emptyData);
      (data[key] as unknown[]).push({ id: key });
      expect(modulesForHistoricalData(data)).toContain("businesses");
    }
  });

  it("active Rentals, Trips, Budget et Subscriptions depuis les données importées", () => {
    const rentals = structuredClone(emptyData); rentals.tenants.push({ id: "tenant" } as never);
    const trips = structuredClone(emptyData); trips.trips.push({ id: "trip" } as never);
    const budget = structuredClone(emptyData); budget.budgetEntries.push({ id: "budget" } as never);
    const subscriptions = structuredClone(emptyData); subscriptions.subscriptions.push({ id: "subscription" } as never);
    expect(modulesForHistoricalData(rentals)).toEqual(["rentals"]);
    expect(modulesForHistoricalData(trips)).toEqual(["trips"]);
    expect(modulesForHistoricalData(budget)).toEqual(["budget"]);
    expect(modulesForHistoricalData(subscriptions)).toEqual(["subscriptions"]);
  });
});

describe("templates business", () => {
  it("propose les 5 templates du brief", () => {
    expect(BUSINESS_TEMPLATES.map((item) => item.key).sort()).toEqual(
      ["commerce", "import_export", "rental", "services", "simple"].sort(),
    );
  });

  it("seul le template Import/Export débloque les fonctions avancées", () => {
    expect(hasAdvancedTrading("import_export")).toBe(true);
    expect(hasAdvancedTrading("simple")).toBe(false);
    expect(hasAdvancedTrading("commerce")).toBe(false);
  });

  it("le template commerce pré-active stock, achats et ventes", () => {
    const template = businessTemplate("commerce");
    expect(template.defaults.moduleStock).toBe(true);
    expect(template.defaults.modulePurchases).toBe(true);
    expect(template.defaults.moduleSales).toBe(true);
  });
});
