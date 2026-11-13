export type ConnectionStatus = "active" | "pending" | "expired" | "revoked" | "error";

export interface Institution {
  id: string;
  name: string;
  consentDays: number;
  historyDays?: number;
}

export interface BankConsent {
  id: string;
  institutionId: string;
  reference: string;
  status: ConnectionStatus;
  agreementId: string | null;
  expiresAt?: string;
  link?: string;
  accounts: string[];
}

export interface BankAccountDetails {
  name: string;
  iban: string | null;
  resourceId: string | null;
  currency: string | null;
  type: string | null;
}

export interface BankBalance {
  currency: string;
  amount: string;
  type: "current" | "available";
  priority: number;
  date: string;
}

export interface BankTransaction {
  providerId: string | null;
  bookingDate: string | null;
  valueDate: string | null;
  amount: string;
  currency: string;
  description: string;
  counterparty: string | null;
  reference: string | null;
  rawCategory: string | null;
  status: "booked" | "pending";
}

export interface ConsentRequest {
  institution: Institution;
  redirect: URL;
  reference: string;
}

export interface BankProvider {
  readonly id: string;
  listInstitutions(country: string): Promise<Institution[]>;
  createConnection(request: ConsentRequest): Promise<BankConsent>;
  getConnectionStatus(id: string): Promise<BankConsent>;
  listAccounts(consent: BankConsent): string[];
  getAccountDetails(id: string): Promise<BankAccountDetails>;
  getBalances(id: string): Promise<BankBalance[]>;
  getTransactions(id: string): Promise<BankTransaction[]>;
  refreshConnection(request: ConsentRequest): Promise<BankConsent>;
  disconnectConnection(id: string): Promise<void>;
}
