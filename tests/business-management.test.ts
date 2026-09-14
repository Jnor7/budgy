import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { businessDashboard, convertBusinessAmount, exchangeRate, paymentSummary, reviseStock, stockValuation } from "@/lib/domain/business";
import type { BusinessItem, BusinessPayment, BusinessTransaction, BusinessTransactionLine } from "@/types/domain";

const userId = "00000000-0000-4000-8000-000000000001";
const businessId = "00000000-0000-4000-8000-000000000002";
const transactionId = "00000000-0000-4000-8000-000000000003";
const item: BusinessItem = { id: "item", userId, businessId, title: "Body Wave 24", kind: "Produit", sku: "BW24", quantity: 10, purchasePrice: 120, salePrice: 250, isActive: true, note: "", purchaseCurrency: "USD", saleCurrency: "EUR", purchaseExchangeRate: exchangeRate("USD", "EUR"), purchasePriceReporting: convertBusinessAmount(120, "USD", "EUR"), saleExchangeRate: 1, salePriceReporting: 250, stockMinimum: 2, trackStock: true };
const transaction: BusinessTransaction = { id: transactionId, userId, businessId, title: "Vente Body Wave", type: "revenu", amount: 500, category: "Vente", date: "2026-09-14", note: "", transactionKind: "sale", originalAmount: 500, originalCurrency: "EUR", exchangeRate: 1, convertedAmount: 500, reportingCurrency: "EUR", discount: 0, paymentStatus: "unpaid", amountPaid: 0, status: "active" };
const payment = (id: string, amount: number): BusinessPayment => ({ id, userId, businessId, transactionId, amountOriginal: amount, currency: "EUR", exchangeRate: 1, amountReporting: amount, reportingCurrency: "EUR", date: "2026-09-14", method: "Virement", note: "", createdAt: "2026-09-14T10:00:00Z" });
const line: BusinessTransactionLine = { id: "line", userId, businessId, transactionId, itemId: item.id, description: item.title, quantity: 2, unitPriceOriginal: 250, originalCurrency: "EUR", exchangeRate: 1, unitPriceReporting: 250, unitCostReporting: convertBusinessAmount(120, "USD", "EUR"), lineTotalReporting: 500, stockEffect: -1, createdAt: "2026-09-14T10:00:00Z" };

describe("Business management — devises et snapshots", () => {
  it("crée un article acheté 120 USD et vendu 250 EUR", () => { expect(item.purchasePrice).toBe(120); expect(item.salePrice).toBe(250); });
  it("convertit le coût USD vers EUR via le pivot existant", () => expect(item.purchasePriceReporting).toBeCloseTo(111.11, 2));
  it("conserve un taux historique explicite", () => expect(convertBusinessAmount(120, "USD", "EUR", 0.85)).toBe(102));
  it("fige le coût de revient sur la ligne historique", () => expect(line.unitCostReporting).toBeCloseTo(111.11, 2));
  it("accepte les devises XAF/XOF sans changer le taux FCFA", () => expect(exchangeRate("XAF", "EUR")).toBeCloseTo(exchangeRate("FCFA", "EUR")));
});

describe("Business management — stock atomique", () => {
  it("vend 2 unités: 10 vers 8", () => expect(reviseStock(10, 0, -2)).toBe(8));
  it("modifie la vente 2 vers 3: 8 vers 7, pas 5", () => expect(reviseStock(8, -2, -3)).toBe(7));
  it("annule la vente et restaure le stock", () => expect(reviseStock(8, -2, 0)).toBe(10));
  it("réapprovisionne le stock", () => expect(reviseStock(10, 0, 4)).toBe(14));
  it("un service reste sans effet stock", () => expect(reviseStock(10, 0, 0)).toBe(10));
});

describe("Business management — paiements et dashboard", () => {
  it("gère un paiement partiel de 200 sur 600", () => expect(paymentSummary({ ...transaction, amount: 600, convertedAmount: 600 }, [payment("p1", 200)])).toMatchObject({ paid: 200, remaining: 400, status: "partial" }));
  it("cumule un second paiement de 150", () => expect(paymentSummary({ ...transaction, amount: 600, convertedAmount: 600 }, [payment("p1", 200), payment("p2", 150)])).toMatchObject({ paid: 350, remaining: 250 }));
  it("passe payé quand le total est atteint", () => expect(paymentSummary(transaction, [payment("p1", 200), payment("p2", 300)])).toMatchObject({ remaining: 0, status: "paid" }));
  it("charge une transaction historique sans nouveaux champs", () => expect(paymentSummary({ id: "old", userId, businessId, title: "Ancienne", type: "revenu", amount: 50, category: "Vente", date: "2025-01-01", note: "" }, [])).toMatchObject({ total: 50, remaining: 50 }));
  it("calcule CA, dépenses, coût vendu et bénéfice", () => expect(businessDashboard([transaction, { ...transaction, id: "expense", type: "depense", transactionKind: "expense", amount: 100, convertedAmount: 100 }], [payment("p1", 200)], [item], [line])).toMatchObject({ revenue: 500, expenses: 100, costOfGoodsSold: expect.closeTo(222.22, 2), profit: expect.closeTo(177.78, 2), received: 200, outstanding: 300 }));
  it("calcule valeur et marge potentielle du stock", () => expect(stockValuation([item])).toMatchObject({ cost: expect.closeTo(1111.1, 1), potentialSale: 2500 }));
  it("classe les top articles", () => expect(businessDashboard([transaction], [], [item], [line]).topItems[0]).toMatchObject({ quantity: 2, revenue: 500 }));
  it("valide le scénario Get Charlie de bout en bout", () => {
    const dashboard = businessDashboard([transaction], [payment("p1", 200), payment("p2", 300)], [item], [line]);
    expect(reviseStock(10, 0, -2)).toBe(8);
    expect(dashboard).toMatchObject({ revenue: 500, received: 500, outstanding: 0, costOfGoodsSold: expect.closeTo(222.22, 2), profit: expect.closeTo(277.78, 2) });
    expect(paymentSummary(transaction, [payment("p1", 200), payment("p2", 300)])).toMatchObject({ status: "paid", remaining: 0 });
  });
});

describe("Business management — contrat SQL", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260914175916_expand_business_management.sql"), "utf8");
  it("reste additif et ne supprime aucune donnée", () => { expect(sql).not.toMatch(/drop\s+table|truncate|delete\s+from\s+public\.business_transactions/i); expect(sql).toContain("add column if not exists"); });
  it("verrouille les articles et écrit chaque mouvement", () => { expect(sql).toMatch(/business_items[\s\S]+for update/i); expect(sql).toContain("insert into public.business_stock_movements"); });
  it("interdit toute correction de stock silencieuse", () => { expect(sql).toContain("function public.adjust_business_stock"); expect(sql).toMatch(/adjust_business_stock[\s\S]+for update[\s\S]+business_stock_movements/i); });
  it("protège les nouvelles tables par RLS et l'UUID Budgy", () => { expect(sql.match(/enable row level security/g)).toHaveLength(3); expect(sql).toContain("public.current_budgy_user_id()"); expect(sql).toContain("references public.budgy_users"); });
  it("calcule le total côté serveur et refuse les relations externes", () => { expect(sql).toContain("jsonb_array_length"); expect(sql).toMatch(/select round\(greatest\(coalesce\(sum/i); expect(sql).toContain("Contact inaccessible"); });
  it("accepte une ligne libre sans article", () => expect(sql).toContain("nullif(v_line->>'item_id','')::uuid"));
  it("révoque PUBLIC et limite les RPC au rôle authentifié", () => { expect(sql).toContain("revoke all on function public.save_business_transaction"); expect(sql).toContain("grant execute on function public.record_business_payment"); });
});
