import type { Currency, DubaiCashMovement, DubaiExpense, DubaiPart, DubaiSale } from "@/types/domain";

export const FX = { AED: 3.97, EUR: 1, FCFA: 655.957, USD: 1.08 } as const;
export const normalizeCurrency = (currency: string): Currency => currency === "CFA" ? "FCFA" : currency as Currency;
export const convertCurrency = (amount: number, from: Currency | "CFA", to: Currency) => {
  const source = normalizeCurrency(from);
  return amount / FX[source] * FX[to];
};

export function partMetrics(part: DubaiPart, sales: DubaiSale[], expenses: DubaiExpense[]) {
  const partSales = sales.filter((sale) => sale.partId === part.id);
  const partExpenses = expenses.filter((expense) => expense.partId === part.id);
  const realQuantitySoldFromSales = partSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const realRevenueAED = partSales.reduce((sum, sale) => sum + convertCurrency(sale.quantity * sale.unitSalePriceAED, sale.currency, "AED"), 0);
  const linkedExpensesAED = partExpenses.reduce((sum, expense) => sum + convertCurrency(expense.amountAED, expense.currency, "AED"), 0);
  const realGrossMarginAED = realRevenueAED - realQuantitySoldFromSales * part.purchasePriceAED;
  return {
    quantityRemaining: Math.max(part.quantityBought - part.quantitySold, 0),
    totalBoughtAED: part.quantityBought * part.purchasePriceAED,
    totalPotentialRevenueAED: part.quantityBought * part.targetSalePriceAED,
    estimatedPotentialProfitAED: part.quantityBought * (part.targetSalePriceAED - part.purchasePriceAED),
    netProfitAED: part.quantityBought * (part.targetSalePriceAED - part.purchasePriceAED) - part.cashWithdrawnAED,
    realQuantitySoldFromSales,
    realRevenueAED,
    realGrossMarginAED,
    realNetMarginAED: realGrossMarginAED - linkedExpensesAED,
    realRemainingQuantity: Math.max(part.quantityBought - realQuantitySoldFromSales, 0),
    projectedRemainingRevenueAED: Math.max(part.quantityBought - realQuantitySoldFromSales, 0) * part.targetSalePriceAED,
  };
}

export function dubaiCashSummary(sales: DubaiSale[], expenses: DubaiExpense[], movements: DubaiCashMovement[], currency: Currency) {
  const salesTotal = sales.reduce((sum, sale) => sum + convertCurrency(sale.quantity * sale.unitSalePriceAED, sale.currency, currency), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + convertCurrency(expense.amountAED, expense.currency, currency), 0);
  const done = movements.filter((item) => item.status === "done");
  const planned = movements.filter((item) => item.status === "planned");
  const total = (items: DubaiCashMovement[], type: DubaiCashMovement["type"]) => items
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + convertCurrency(item.amount, item.currency, currency), 0);
  const cashIn = total(done, "cash_in");
  const cashOut = total(done, "cash_out");
  const withdrawals = total(done, "withdrawal");
  return {
    salesTotal, expensesTotal, cashIn, cashOut, withdrawals,
    totalDisbursed: expensesTotal + cashOut + withdrawals,
    currentResult: salesTotal + cashIn - expensesTotal - cashOut - withdrawals,
    plannedIncoming: total(planned, "cash_in"),
    plannedOutgoing: total(planned, "cash_out") + total(planned, "withdrawal"),
  };
}
