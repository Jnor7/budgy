import type { ConnectionStatus } from "./provider";

export interface ConnectionSummary {
  id: string;
  institution_name: string;
  institution_id: string;
  status: ConnectionStatus;
  last_synced_at: string | null;
  expires_at: string | null;
  auto_sync: boolean;
}

export interface AccountSummary {
  id: string;
  bank_connection_id: string;
  display_name: string;
  currency: string;
  current_balance: string | null;
  available_balance: string | null;
  active: boolean;
  last_synced_at: string;
}

export interface BankingOverview {
  configured: boolean;
  connections: ConnectionSummary[];
  accounts: AccountSummary[];
}

export interface TransactionSummary {
  id: string;
  bank_account_id: string;
  date: string | null;
  amount: string;
  currency: string;
  description: string;
  counterparty: string | null;
  status: "booked" | "pending";
  budgy_category: string | null;
  budget_entry_id: string | null;
}

export interface TransactionPage {
  accounts: AccountSummary[];
  categories: string[];
  transactions: TransactionSummary[];
  hasMore: boolean;
}
