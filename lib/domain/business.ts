import type {
  BusinessItem, BusinessPayment, BusinessTransaction, BusinessTransactionLine, Currency,
} from "@/types/domain";
import { FX } from "@/lib/domain/dubai";

/** Units of each currency for one EUR. Existing Dubai rates remain unchanged. */
export const BUSINESS_FX = FX;

export const BUSINESS_CURRENCIES = Object.keys(BUSINESS_FX) as Currency[];
export const BUSINESS_ITEM_TYPES = ["Produit", "Service", "Accessoire", "Consommable", "Matière première", "Équipement", "Autre"] as const;
export const BUSINESS_CATEGORIES = ["Beauté", "Mode", "Électronique", "Alimentaire", "Événementiel", "Automobile", "Maison", "Fournitures", "Service", "Autre"] as const;
export const BUSINESS_PAYMENT_METHODS = ["Espèces", "Carte", "Virement", "PayPal", "Lydia", "Paylib", "Mobile Money", "Autre"] as const;
export const BUSINESS_STOCK_MOVEMENT_TYPES = [
  ["correction", "Correction inventaire"], ["restock", "Réapprovisionnement"],
  ["customer_return", "Retour client"], ["supplier_return", "Retour fournisseur"],
  ["damage", "Perte / casse"], ["other", "Autre"],
] as const;

export function exchangeRate(from: Currency, to: Currency) {
  return BUSINESS_FX[to] / BUSINESS_FX[from];
}

export function convertBusinessAmount(amount: number, from: Currency, to: Currency, rate = exchangeRate(from, to)) {
  return Math.round(amount * rate * 100) / 100;
}

/** Reverts the previously persisted variation before applying its replacement. */
export function reviseStock(current: number, previousVariation = 0, nextVariation = 0) {
  return current - previousVariation + nextVariation;
}

export function transactionAmount(transaction: BusinessTransaction) {
  return transaction.convertedAmount ?? transaction.amount;
}

export function paymentSummary(transaction: BusinessTransaction, payments: BusinessPayment[]) {
  const total = transactionAmount(transaction);
  const paid = payments.filter((payment) => payment.transactionId === transaction.id)
    .reduce((sum, payment) => sum + payment.amountReporting, 0);
  const remaining = Math.max(total - paid, 0);
  return { total, paid, remaining, status: paid <= 0 ? "unpaid" : remaining <= 0.01 ? "paid" : "partial" } as const;
}

export function stockValuation(items: BusinessItem[]) {
  return items.filter((item) => item.isActive && item.trackStock !== false).reduce((totals, item) => {
    const cost = item.purchasePriceReporting ?? item.purchasePrice;
    const sale = item.salePriceReporting ?? item.salePrice;
    totals.cost += item.quantity * cost;
    totals.potentialSale += item.quantity * sale;
    return totals;
  }, { cost: 0, potentialSale: 0, potentialMargin: 0 });
}

export function businessDashboard(
  transactions: BusinessTransaction[], payments: BusinessPayment[], items: BusinessItem[], lines: BusinessTransactionLine[],
) {
  const active = transactions.filter((transaction) => transaction.status !== "cancelled");
  const revenue = active.filter((transaction) => transaction.type === "revenu").reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
  const expenses = active.filter((transaction) => transaction.type === "depense").reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
  const received = payments.filter((payment) => active.some((transaction) => transaction.id === payment.transactionId && transaction.type === "revenu"))
    .reduce((sum, payment) => sum + payment.amountReporting, 0);
  const outstanding = active.filter((transaction) => transaction.type === "revenu")
    .reduce((sum, transaction) => sum + paymentSummary(transaction, payments).remaining, 0);
  const stock = stockValuation(items);
  stock.potentialMargin = stock.potentialSale - stock.cost;
  const costOfGoodsSold = lines.reduce((sum, line) => {
    const transaction = active.find((candidate) => candidate.id === line.transactionId);
    const item = items.find((candidate) => candidate.id === line.itemId);
    return transaction?.transactionKind === "sale" && item
      ? sum + line.quantity * (line.unitCostReporting ?? item.purchasePriceReporting ?? item.purchasePrice)
      : sum;
  }, 0);
  const operatingExpenses = active.filter((transaction) => transaction.type === "depense" && transaction.transactionKind !== "purchase")
    .reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
  const topItems = [...new Map(items.map((item) => [item.id, { item, quantity: 0, revenue: 0 }])).values()];
  for (const line of lines) {
    const transaction = active.find((candidate) => candidate.id === line.transactionId);
    const top = topItems.find((candidate) => candidate.item.id === line.itemId);
    if (top && transaction?.transactionKind === "sale") {
      top.quantity += line.quantity;
      top.revenue += line.lineTotalReporting;
    }
  }
  return {
    revenue, received, outstanding, expenses, costOfGoodsSold, profit: revenue - operatingExpenses - costOfGoodsSold,
    marginPercent: revenue ? (revenue - operatingExpenses - costOfGoodsSold) / revenue * 100 : 0,
    stock,
    lowStock: items.filter((item) => item.isActive && item.trackStock !== false && item.quantity <= (item.stockMinimum ?? 0)),
    topItems: topItems.filter((item) => item.quantity > 0).sort((a, b) => b.revenue - a.revenue),
  };
}
