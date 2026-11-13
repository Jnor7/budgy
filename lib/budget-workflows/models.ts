export interface BudgetEnvelopeView {
  id: string;
  name: string;
  category: string;
  target: number;
  spent: number;
  remaining: number;
  percent: number;
  projection: number;
}
export interface BudgetDetailView {
  id: string;
  name: string;
  beneficiary: string | null;
  plannedAmount: number;
  actualAmount: number;
  status: "PLANNED" | "BOUGHT" | "CANCELLED";
}
