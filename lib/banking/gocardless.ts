import "server-only";

import { z } from "zod";
import { BankingError } from "./errors";
import type { BankBalance, BankConsent, BankProvider, BankTransaction, ConnectionStatus, ConsentRequest } from "./provider";

const API = "https://bankaccountdata.gocardless.com/api/v2/";
const optionalText = z.string().nullish();
const uuid = z.uuid();
const currency = z.string().regex(/^[A-Z]{3}$/);
const amount = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^-?\d+(\.\d+)?$/));
const money = z.object({ currency, amount });
const date = z.iso.date().nullish();
const tokenPair = z.object({
  access: z.string(), access_expires: z.number(),
  refresh: z.string(), refresh_expires: z.number(),
});
const accessToken = tokenPair.pick({ access: true, access_expires: true });
const requisition = z.object({
  id: uuid, institution_id: z.string(), reference: z.string(),
  status: z.string(), agreement: uuid.nullish(), agreements: uuid.nullish(),
  accounts: z.array(uuid).default([]), link: z.url().optional(),
});
const accountDetails = z.object({ account: z.object({
  name: optionalText, product: optionalText, iban: optionalText, resourceId: optionalText,
  currency: currency.nullish(), cashAccountType: optionalText,
}) });
const transaction = z.object({
  transactionId: optionalText, internalTransactionId: optionalText,
  bookingDate: date, valueDate: date, transactionAmount: money,
  remittanceInformationUnstructured: optionalText,
  remittanceInformationUnstructuredArray: z.array(z.string()).nullish(),
  additionalInformation: optionalText, creditorName: optionalText, debtorName: optionalText,
  entryReference: optionalText, endToEndId: optionalText, merchantCategoryCode: optionalText,
});

const balanceTypes: Record<string, [BankBalance["type"], number]> = {
  closingBooked: ["current", 3], interimBooked: ["current", 4], openingBooked: ["current", 1],
  interimAvailable: ["available", 4], closingAvailable: ["available", 3], openingAvailable: ["available", 1],
};
const statusMap: Record<string, ConnectionStatus> = {
  CR: "pending", GC: "pending", UA: "pending", SA: "pending", GA: "pending",
  LN: "active", EX: "expired", RJ: "revoked", SU: "revoked",
};

class GoCardlessResponseError extends BankingError {
  constructor(readonly httpStatus: number, payload: unknown) {
    const error = z.object({ summary: z.string().optional(), type: z.string().optional() }).safeParse(payload);
    const reason = error.success ? [error.data.type, error.data.summary].join(" ") : "";
    if (/AccessExpiredError|End User Agreement.*expired/i.test(reason)) super("expired", 409);
    else if (/AccountInactiveError|AccountAccessForbidden|Account Suspended/i.test(reason)) super("revoked", 409);
    else if (httpStatus === 402) super("provider_quota", 409);
    else if (httpStatus === 429) super("rate_limit", 429);
    else if (httpStatus === 409) super("processing", 409);
    else super("bank_unavailable", 503);
  }
}

function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BankingError("bank_unavailable");
  return result.data;
}

function mapConsent(data: z.infer<typeof requisition>) {
  return {
    id: data.id, institutionId: data.institution_id, reference: data.reference,
    status: statusMap[data.status] ?? "error",
    agreementId: data.agreement ?? data.agreements ?? null,
    accounts: data.accounts, link: data.link,
  };
}

export class GoCardlessBankProvider implements BankProvider {
  readonly id = "gocardless";
  private access?: { value: string; expiresAt: number };
  private refresh?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;
  private institutionCache = new Map<string, { items: InstitutionResult[]; expiresAt: number }>();

  constructor(private readonly secretId: string, private readonly secretKey: string, private readonly request = fetch) {}

  private async fetchApi(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.request(new URL(path, API), {
        ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new BankingError("bank_unavailable");
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new GoCardlessResponseError(response.status, body);
    return body;
  }

  private post(path: string, body: unknown, token?: string) {
    return this.fetchApi(path, {
      method: "POST", body: JSON.stringify(body),
      headers: {
        accept: "application/json", "content-type": "application/json",
        ...(token && { authorization: `Bearer ${token}` }),
      },
    });
  }

  private async issueToken() {
    if (this.refresh && this.refresh.expiresAt > Date.now()) {
      try {
        const token = decode(accessToken, await this.post("token/refresh/", { refresh: this.refresh.value }));
        this.access = { value: token.access, expiresAt: Date.now() + token.access_expires * 1000 - 30_000 };
        return token.access;
      } catch (error) {
        if (!(error instanceof GoCardlessResponseError) || error.httpStatus !== 401) throw error;
        this.refresh = undefined;
      }
    }
    const tokens = decode(tokenPair, await this.post("token/new/", { secret_id: this.secretId, secret_key: this.secretKey }));
    const now = Date.now();
    this.refresh = { value: tokens.refresh, expiresAt: now + tokens.refresh_expires * 1000 - 30_000 };
    this.access = { value: tokens.access, expiresAt: now + tokens.access_expires * 1000 - 30_000 };
    return tokens.access;
  }

  private token(): Promise<string> {
    if (this.access && this.access.expiresAt > Date.now()) return Promise.resolve(this.access.value);
    this.tokenRequest ??= this.issueToken().finally(() => { this.tokenRequest = undefined; });
    return this.tokenRequest;
  }

  private async authorized(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const send = (token: string) => body === undefined
      ? this.fetchApi(path, { method, headers: { accept: "application/json", authorization: `Bearer ${token}` } })
      : this.post(path, body, token);
    const token = await this.token();
    try {
      return await send(token);
    } catch (error) {
      if (!(error instanceof GoCardlessResponseError) || error.httpStatus !== 401 || error.code !== "bank_unavailable") throw error;
      if (this.access?.value === token) this.access = undefined;
      return send(await this.token());
    }
  }

  async listInstitutions(country: string) {
    const cached = this.institutionCache.get(country);
    if (cached && cached.expiresAt > Date.now()) return cached.items;
    const result = decode(z.array(institution), await this.authorized(`institutions/?country=${encodeURIComponent(country)}`));
    const items = result.map((item) => ({
      id: item.id, name: item.name, consentDays: item.max_access_valid_for_days ?? 90,
      ...(item.transaction_total_days && { historyDays: item.transaction_total_days }),
    }));
    this.institutionCache.set(country, { items, expiresAt: Date.now() + 5 * 60_000 });
    return items;
  }

  async createConnection({ institution, redirect, reference }: ConsentRequest) {
    const agreement = decode(z.object({ id: uuid }), await this.authorized("agreements/enduser/", "POST", {
      institution_id: institution.id, access_valid_for_days: Math.min(institution.consentDays, 90),
      max_historical_days: Math.min(institution.historyDays ?? 90, 90),
      access_scope: ["details", "balances", "transactions"],
    }));
    let result: z.infer<typeof requisition>;
    try {
      result = decode(requisition, await this.authorized("requisitions/", "POST", {
        institution_id: institution.id, redirect: redirect.href, reference, agreement: agreement.id, user_language: "FR",
      }));
    } catch (error) {
      await this.authorized(`agreements/enduser/${agreement.id}/`, "DELETE").catch(() => undefined);
      throw error;
    }
    const link = result.link ? new URL(result.link) : null;
    if (!link || !["https://ob.gocardless.com", "https://bankaccountdata.gocardless.com"].includes(link.origin) || link.username || link.password) {
      await this.disconnectConnection(result.id).catch(() => undefined);
      throw new BankingError("bank_unavailable");
    }
    return { ...mapConsent(result), agreementId: agreement.id };
  }

  refreshConnection(request: ConsentRequest) {
    return this.createConnection(request);
  }

  async getConnectionStatus(id: string): Promise<BankConsent> {
    const result = await this.authorized(`requisitions/${decode(uuid, id)}/`).catch((error: unknown) => {
      if (error instanceof GoCardlessResponseError && error.httpStatus === 404) throw new BankingError("revoked", 409);
      throw error;
    });
    const consent = mapConsent(decode(requisition, result));
    if (consent.status === "active" && consent.agreementId) {
      const agreement = decode(z.object({
        accepted: z.iso.datetime({ offset: true, local: true }).nullish(), access_valid_for_days: z.number().positive(),
      }), await this.authorized(`agreements/enduser/${consent.agreementId}/`));
      if (agreement.accepted) {
        return { ...consent, expiresAt: new Date(Date.parse(agreement.accepted.match(/Z$|[+-]\d{2}:\d{2}$/) ? agreement.accepted : `${agreement.accepted}Z`) + agreement.access_valid_for_days * 86_400_000).toISOString() };
      }
    }
    return consent;
  }

  listAccounts(consent: Awaited<ReturnType<BankProvider["getConnectionStatus"]>>) {
    return [...new Set(consent.accounts)];
  }

  async getAccountDetails(id: string) {
    const { account } = decode(accountDetails, await this.authorized(`accounts/${decode(uuid, id)}/details/`));
    return {
      name: account.name || account.product || "Compte bancaire",
      iban: account.iban?.replace(/\s/g, "").toUpperCase() || null,
      resourceId: account.resourceId || null,
      currency: account.currency ?? null, type: account.cashAccountType ?? null,
    };
  }

  async getBalances(id: string) {
    const schema = z.object({ balances: z.array(z.object({
      balanceAmount: money, balanceType: z.string(), referenceDate: date,
    })) });
    const { balances } = decode(schema, await this.authorized(`accounts/${decode(uuid, id)}/balances/`));
    return balances.flatMap(({ balanceAmount, balanceType, referenceDate }): BankBalance[] => {
      const entry = Object.hasOwn(balanceTypes, balanceType) ? balanceTypes[balanceType] : undefined;
      if (!entry) return [];
      return [{ ...balanceAmount, type: entry[0], priority: entry[1], date: referenceDate ?? "" }];
    });
  }

  async getTransactions(id: string) {
    const schema = z.object({ transactions: z.object({
      booked: z.array(transaction), pending: z.array(transaction).nullish(),
    }) });
    const { transactions } = decode(schema, await this.authorized(`accounts/${decode(uuid, id)}/transactions/`));
    const map = (item: z.infer<typeof transaction>, status: BankTransaction["status"]): BankTransaction => ({
      providerId: item.transactionId?.trim() || item.internalTransactionId?.trim() || null,
      bookingDate: item.bookingDate ?? null, valueDate: item.valueDate ?? null,
      ...item.transactionAmount,
      description: (item.remittanceInformationUnstructured || item.remittanceInformationUnstructuredArray?.join(" ")
        || item.additionalInformation || "").trim().slice(0, 600),
      counterparty: (item.creditorName || item.debtorName)?.trim().slice(0, 180) || null,
      reference: item.entryReference || item.endToEndId || null,
      rawCategory: item.merchantCategoryCode?.slice(0, 12) ?? null,
      status,
    });
    return [...transactions.booked.map((item) => map(item, "booked")), ...(transactions.pending ?? []).map((item) => map(item, "pending"))];
  }

  async disconnectConnection(id: string) {
    try {
      await this.authorized(`requisitions/${decode(uuid, id)}/`, "DELETE");
    } catch (error) {
      if (!(error instanceof GoCardlessResponseError) || error.httpStatus !== 404) throw error;
    }
  }
}

const institution = z.object({
  id: z.string(), name: z.string(),
  max_access_valid_for_days: z.coerce.number().int().positive().nullish().catch(null),
  transaction_total_days: z.coerce.number().int().positive().nullish().catch(null),
});
type InstitutionResult = Awaited<ReturnType<BankProvider["listInstitutions"]>>[number];
