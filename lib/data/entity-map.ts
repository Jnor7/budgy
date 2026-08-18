import type { AppData, AppDataKey, AppEntity } from "@/types/domain";
import type { Json } from "@/types/database";

export const entityTables: { [K in AppDataKey]: string } = {
  tenants: "tenants",
  rentPayments: "rent_payments",
  tenantDebts: "tenant_debts",
  dubaiParts: "dubai_parts",
  dubaiSales: "dubai_sales",
  dubaiExpenses: "dubai_expenses",
  dubaiCashMovements: "dubai_cash_movements",
  businesses: "businesses",
  businessContacts: "business_contacts",
  businessItems: "business_items",
  businessTransactions: "business_transactions",
  businessBookings: "business_bookings",
  businessTasks: "business_tasks",
  budgetEntries: "budget_entries",
  subscriptions: "subscriptions",
  trips: "trips",
  flights: "flights",
  accommodations: "accommodations",
  tripActivities: "trip_activities",
  tripChecklistItems: "trip_checklist_items",
  attachments: "attachments",
  // --- V2 ---
  userModules: "user_modules",
  tripMembers: "trip_members",
  tripInvitations: "trip_invitations",
  notifications: "notifications",
  tripExpenses: "trip_expenses",
  tripExpenseSplits: "trip_expense_splits",
};

/**
 * Tables V2 pilotées par des RPC SECURITY DEFINER ou par des helpers dédiés.
 * Elles sont chargées par `loadAll` mais ne doivent pas passer par `create()`.
 */
export const rpcManagedKeys: AppDataKey[] = ["tripMembers", "tripInvitations", "notifications"];

export const entityKeys = Object.keys(entityTables) as AppDataKey[];
/**
 * Ordre d'import de l'archive Budget JR. NE PAS MODIFIER : il est répliqué
 * à l'identique dans la fonction SQL `import_budgy_archive` (migration 202608180006).
 */
export const importOrder: AppDataKey[] = [
  "tenants", "dubaiParts", "businesses", "budgetEntries", "subscriptions", "trips",
  "rentPayments", "tenantDebts", "dubaiSales", "dubaiExpenses", "dubaiCashMovements",
  "businessContacts", "businessItems", "businessTransactions", "businessBookings",
  "businessTasks", "flights", "accommodations", "tripActivities", "tripChecklistItems",
  "attachments",
];

const numericFields = new Set([
  "monthlyRent", "dueDay", "month", "year", "amountDue", "amountReceived", "carryOver",
  "amount", "quantityBought", "quantitySold", "purchasePriceAED", "targetSalePriceAED",
  "cashWithdrawnAED", "quantity", "unitSalePriceAED", "amountAED", "purchasePrice",
  "salePrice", "price", "potentialAmount", "peopleCount", "targetBudget", "sizeBytes",
]);

export const camelToSnake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
export const snakeToCamel = (value: string) => value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

export function toDatabaseRow(entity: AppEntity): Record<string, Json> {
  return Object.fromEntries(Object.entries(entity).filter(([,value])=>value!==undefined).map(([key, value]) => [camelToSnake(key), value as Json]));
}

export function fromDatabaseRow(row: Record<string, unknown>): AppEntity {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const camelKey = snakeToCamel(key);
    const normalized = numericFields.has(camelKey) && typeof value === "string" ? Number(value) : value;
    return [camelKey, normalized];
  })) as unknown as AppEntity;
}

export function toDatabasePayload(data: AppData): Record<string, Record<string, Json>[]> {
  return Object.fromEntries(importOrder.map((key) => [entityTables[key], data[key].map(toDatabaseRow)]));
}
