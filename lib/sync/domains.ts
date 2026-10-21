import type { AppDataKey } from "@/types/domain";

/**
 * Domaines suivis par `public.sync_versions` (migration 20261020120000). Les clés de
 * voyage restent gérées par le sondage collaboratif existant : les données partagées
 * entre plusieurs comptes n'appartiennent pas à un seul `user_id`.
 */
export const SYNC_DOMAINS: Record<string, AppDataKey[]> = {
  finance: ["budgetEntries", "subscriptions"],
  rent: ["tenants", "rentPayments", "tenantDebts"],
  business: [
    "businesses", "businessContacts", "businessItems", "businessTransactions",
    "businessTransactionLines", "businessPayments", "businessStockMovements",
    "businessBookings", "businessTasks", "dubaiParts", "dubaiSales", "dubaiExpenses",
    "dubaiCashMovements",
  ],
};

export const SYNC_KEYS: AppDataKey[] = Object.values(SYNC_DOMAINS).flat();

export const keysForDomains = (domains: Iterable<string>): AppDataKey[] =>
  [...new Set([...domains].flatMap((domain) => SYNC_DOMAINS[domain] ?? []))];
