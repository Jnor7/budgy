export interface FinanceAccountView { id:string; name:string; accountType:"BANK"|"CASH"|"MEAL_VOUCHER"; currency:string; balance:number; snapshotDate:string; includeInCash:boolean }
export interface EnvelopeView { id:string; name:string; category:string; target:number; spent:number; remaining:number; percent:number; historicalAverage:number|null; projection:number }
export interface ProvisionItemView { id:string; name:string; beneficiary:string|null; planned:number; actual:number; status:"PLANNED"|"BOUGHT"|"CANCELLED" }
export interface ProvisionView { id:string; name:string; amount:number; targetDate:string; status:string; flexible:boolean; spent:number; remaining:number; items:ProvisionItemView[] }
export interface DebtView { id:string; name:string; principal:number; monthlyPayment:number; remainingMonths:number|null; creditor:string|null; status:string; note:string }
export interface ProjectView { id:string; name:string; kind:string; status:string; plannedAmount:number|null; spent:number; note:string }
export interface MonthView { month:string; income:number; expenses:number; committed:number; provisioned:number; projectedBalance:number }
export interface FinanceOverview {
  snapshotDate:string; realCash:number; committed:number; provisioned:number; freeCash:number;
  recommendedSavings:number; safeToSpend:number; futureIncome:number;
  accounts:FinanceAccountView[]; envelopes:EnvelopeView[]; provisions:ProvisionView[];
  debts:DebtView[]; projects:ProjectView[]; months:MonthView[];
  subscriptions:{active:number;toCheck:number;toCancel:number;monthly:number;renewalAlerts:{title:string;days:number}[]};
  upcoming:{id:string;title:string;amount:number;type:string;date:string;businessProject:string|null}[];
}
