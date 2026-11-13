export type ConnectionStatus = "active" | "pending" | "expired" | "revoked" | "error";

export interface Institution {
  id: string;
  name: string;
}

export interface BankConnection {
  id: string;
  institutionId: string;
  status: ConnectionStatus;
  expiresAt?: string;
  createdAt?: string;
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
  deleted?: boolean;
}

export interface ConsentRequest {
  institution: Institution;
  redirect: URL;
  reference: string;
  email: string;
}

export interface ConsentSession {
  link: string;
  connectionId: string | null;
}

export interface ConsentCallback {
  userId: string;
  connectionId?: string;
  success?: boolean;
  step?: string;
}

export interface BankAccount {
  providerId: string;
  details: BankAccountDetails;
  balances: BankBalance[];
}

export interface BankProvider {
  readonly id: string;
  listInstitutions(country: string): Promise<Institution[]>;
  createConnection(request: ConsentRequest): Promise<ConsentSession>;
  refreshConnection(request: ConsentRequest, connectionId: string): Promise<ConsentSession>;
  verifyCallback(callback: ConsentCallback): Promise<void>;
  getConnectionStatus(id: string): Promise<BankConnection>;
  listAccounts(connection: BankConnection): Promise<BankAccount[]>;
  getTransactions(accountId: string): Promise<BankTransaction[]>;
  disconnectConnection(id: string): Promise<void>;
}
