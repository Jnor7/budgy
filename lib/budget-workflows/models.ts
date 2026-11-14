export interface BudgetDetailView {
  id: string;
  entryId: string;
  name: string;
  beneficiary: string | null;
  plannedAmount: number;
  actualAmount: number;
  status: "PLANNED" | "BOUGHT" | "CANCELLED";
}
