export type UUID = string;
export type ISODate = string;
export type Currency = "AED" | "EUR" | "FCFA" | "USD";
export type EntryType = "revenu" | "depense";
export type BudgetStatus = "recu" | "peu" | "non";
export type DubaiMovementType = "cash_in" | "cash_out" | "withdrawal";
export type DubaiMovementStatus = "done" | "planned";

export interface EntityMeta {
  id: UUID;
  userId: UUID;
  legacyId?: string;
  migrationBatchId?: UUID;
}

export interface Tenant extends EntityMeta {
  name: string; monthlyRent: number; dueDay: number; note: string; createdAt: ISODate;
}
export interface RentPayment extends EntityMeta {
  tenantId: UUID; month: number; year: number; isPaid: boolean; paidDate?: ISODate;
  amountDue: number; amountReceived: number; carryOver: number; note: string;
}
export interface TenantDebt extends EntityMeta {
  tenantId: UUID; label: string; amount: number; month: number; year: number;
  isPaid: boolean; createdAt: ISODate;
}
export interface DubaiPart extends EntityMeta {
  name: string; category: string; quantityBought: number; quantitySold: number;
  purchasePriceAED: number; targetSalePriceAED: number; note: string;
  createdAt: ISODate; cashWithdrawnAED: number;
}
export interface DubaiSale extends EntityMeta {
  partId: UUID; quantity: number; unitSalePriceAED: number; currency: Currency;
  date: ISODate; customerName: string; note: string;
}
export interface DubaiExpense extends EntityMeta {
  partId?: UUID; title: string; amountAED: number; currency: Currency;
  date: ISODate; category: string; note: string;
}
export interface DubaiCashMovement extends EntityMeta {
  title: string; amount: number; currency: Currency; date: ISODate;
  type: DubaiMovementType; category: string; note: string; status: DubaiMovementStatus;
}
export interface Business extends EntityMeta {
  name: string; type: string; icon: string; colorHex: string; note: string;
  isActive: boolean; createdAt: ISODate;
  moduleClients: boolean; moduleSuppliers: boolean; moduleStock: boolean;
  modulePurchases: boolean; moduleSales: boolean; moduleReservations: boolean;
  moduleServices: boolean; moduleTasks: boolean; modulePayments: boolean;
  moduleDocuments: boolean; moduleKPI: boolean;
}
export interface BusinessContact extends EntityMeta {
  businessId: UUID; name: string; role: string; phone: string; email: string; note: string;
}
export interface BusinessItem extends EntityMeta {
  businessId: UUID; title: string; kind: string; sku: string; quantity: number;
  purchasePrice: number; salePrice: number; isActive: boolean; note: string;
}
export interface BusinessTransaction extends EntityMeta {
  businessId: UUID; title: string; type: EntryType; amount: number;
  category: string; date: ISODate; note: string;
}
export interface BusinessBooking extends EntityMeta {
  businessId: UUID; title: string; customerName: string; startDate: ISODate;
  endDate: ISODate; price: number; status: string; note: string;
}
export interface BusinessTask extends EntityMeta {
  businessId: UUID; title: string; dueDate: ISODate; isDone: boolean;
  priority: "basse" | "moyenne" | "haute"; note: string;
}
export interface BudgetEntry extends EntityMeta {
  title: string; amount: number; type: EntryType; category: string; bucket: string;
  scope: string; date: ISODate; note: string; potentialAmount: number; status: BudgetStatus;
}
export interface Subscription extends EntityMeta {
  title: string; amount: number; dueDay: number; category: string; systemImage: string;
  colorHex: string; scope: string; isActive: boolean; note: string;
}
export interface Trip extends EntityMeta {
  title: string; destinationSummary: string; startDate: ISODate; endDate: ISODate;
  peopleCount: number; targetBudget: number; notes: string; isCompleted: boolean; createdAt: ISODate;
}
export interface Flight extends EntityMeta {
  tripId: UUID; airline: string; fromCode: string; toCode: string; departDate: ISODate;
  arriveDate: ISODate; price: number; bookingLink: string; attachmentNote: string; status: string;
}
export interface Accommodation extends EntityMeta {
  tripId: UUID; name: string; city: string; startDate: ISODate; endDate: ISODate;
  price: number; bookingLink: string; attachmentNote: string; status: string;
}
export interface TripActivity extends EntityMeta {
  tripId: UUID; title: string; city: string; activityDate: ISODate; price: number;
  link: string; status: string; note: string;
}
export interface TripChecklistItem extends EntityMeta {
  tripId: UUID; title: string; category: string; isDone: boolean;
}
export interface Attachment extends EntityMeta {
  fileName: string; mimeType: string; storagePath: string; sizeBytes: number;
  createdAt: ISODate; dubaiPartId?: UUID; businessId?: UUID;
}
export interface Profile { userId: UUID; username: string; createdAt: ISODate; updatedAt: ISODate; }
export interface UserPreferences { userId: UUID; dubaiDisplayCurrency: Currency; }

export interface AppData {
  tenants: Tenant[]; rentPayments: RentPayment[]; tenantDebts: TenantDebt[];
  dubaiParts: DubaiPart[]; dubaiSales: DubaiSale[]; dubaiExpenses: DubaiExpense[];
  dubaiCashMovements: DubaiCashMovement[]; businesses: Business[];
  businessContacts: BusinessContact[]; businessItems: BusinessItem[];
  businessTransactions: BusinessTransaction[]; businessBookings: BusinessBooking[];
  businessTasks: BusinessTask[]; budgetEntries: BudgetEntry[]; subscriptions: Subscription[];
  trips: Trip[]; flights: Flight[]; accommodations: Accommodation[];
  tripActivities: TripActivity[]; tripChecklistItems: TripChecklistItem[]; attachments: Attachment[];
}

export type AppDataKey = keyof AppData;
export type AppEntity = AppData[AppDataKey][number];
