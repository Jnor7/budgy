import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { BankingError } from "./errors";
import type { BankAccount, BankBalance, BankConnection, BankProvider, ConnectionStatus, ConsentCallback, ConsentRequest, ConsentSession } from "./provider";

const ORIGIN = "https://api.bridgeapi.io";
const aggregation = "/v3/aggregation";
const bridgeId = z.number().int().positive();
const currency = z.string().regex(/^[A-Z]{3}$/);
const timestamp = z.iso.datetime({ offset: true });
const account = z.object({
  id: bridgeId, item_id: bridgeId, provider_id: bridgeId, name: z.string(), currency_code: currency,
  balance: z.number().nullish(), accounting_balance: z.number().nullish(),
  type: z.string().nullish(), iban: z.string().nullish(), data_access: z.enum(["enabled", "disabled"]),
});
const transaction = z.object({
  id: bridgeId.nullish(), provider_external_id: z.string().nullish(), account_id: bridgeId,
  amount: z.number(), currency_code: currency, date: z.iso.date(),
  booking_date: z.iso.date().nullish(), value_date: z.iso.date().nullish(),
  clean_description: z.string().nullish(), provider_description: z.string().nullish(),
  future: z.boolean(), deleted: z.boolean(), category_id: z.number().nullish(),
});
const user = z.object({ uuid: z.uuid(), external_user_id: z.string() });
const tokenSchema = z.object({ access_token: z.string().min(1), expires_at: timestamp, user });

type Token = z.infer<typeof tokenSchema>;

class BridgeApiError extends BankingError {
  constructor(readonly httpStatus: number, readonly codes: string[]) {
    super(httpStatus === 429 ? "rate_limit" : "bank_unavailable", httpStatus === 429 ? 429 : 503);
  }
}

function decode<T>(schema: z.ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) throw new BankingError("bank_unavailable");
  return result.data;
}

function numericId(id: string) {
  if (!/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) throw new BankingError("invalid", 400);
  return Number(id);
}

function connectionStatus(status: number): ConnectionStatus {
  if (status === 0 || status === 1009) return "active";
  if (status === -2 || status === -3 || status === 1099) return "pending";
  if ([402, 429, 1010].includes(status)) return "expired";
  return "error";
}

export class BridgeBankProvider implements BankProvider {
  readonly id = "bridge";
  private readonly externalUserId: string;
  private token?: Token;
  private tokenRequest?: Promise<Token>;

  constructor(
    private readonly proxyUrl: URL,
    private readonly proxySecret: string,
    canonicalUserId: string,
    private readonly request = fetch,
  ) {
    this.externalUserId = `budgy-${createHash("sha256").update(canonicalUserId).digest("hex")}`;
  }

  private async api(path: string | URL, method = "GET", body?: object, token?: string) {
    let response: Response;
    try {
      const route = new URL(path, ORIGIN);
      const target = new URL(this.proxyUrl);
      target.pathname = route.pathname;
      target.search = route.search;
      response = await this.request(target, {
        method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
        headers: {
          "x-budgy-proxy-secret": this.proxySecret,
          accept: "application/json",
          ...(token && { authorization: `Bearer ${token}` }),
          ...(body && { "content-type": "application/json" }),
        },
        body: body && JSON.stringify(body),
      });
    } catch {
      throw new BankingError("bank_unavailable");
    }
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z.object({ errors: z.array(z.object({ code: z.string() })) }).safeParse(result);
      throw new BridgeApiError(response.status, parsed.data?.errors.map(({ code }) => code) ?? []);
    }
    return result;
  }

  private async issueToken(createUser: boolean) {
    const identity = { external_user_id: this.externalUserId };
    const authenticate = () => this.api(`${aggregation}/authorization/token`, "POST", identity);
    let result: unknown;
    try {
      result = await authenticate();
    } catch (error) {
      if (!createUser || !(error instanceof BridgeApiError) ||
          (error.httpStatus !== 404 && !error.codes.includes("user.authentication.unauthorized"))) throw error;
      try {
        await this.api(`${aggregation}/users`, "POST", identity);
      } catch (creationError) {
        // Another request may have provisioned the same external user concurrently.
        if (!(creationError instanceof BridgeApiError) || ![400, 409].includes(creationError.httpStatus)) throw creationError;
      }
      result = await authenticate();
    }
    const token = decode(tokenSchema, result);
    if (token.user.external_user_id !== this.externalUserId) throw new BankingError("invalid", 400);
    this.token = token;
    return token;
  }

  private authenticate(createUser = false) {
    if (this.token && Date.parse(this.token.expires_at) > Date.now() + 30_000) return Promise.resolve(this.token);
    this.tokenRequest ??= this.issueToken(createUser).finally(() => { this.tokenRequest = undefined; });
    return this.tokenRequest;
  }

  private async userApi(path: string | URL, method = "GET", body?: object) {
    const token = await this.authenticate();
    try {
      return await this.api(path, method, body, token.access_token);
    } catch (error) {
      if (!(error instanceof BridgeApiError) || error.httpStatus !== 401) throw error;
      if (this.token === token) this.token = undefined;
      return this.api(path, method, body, (await this.authenticate()).access_token);
    }
  }

  private async list<T>(path: string, schema: z.ZodType<T>, authenticated: boolean) {
    const pageSchema = z.object({
      resources: z.array(schema),
      pagination: z.object({ next_uri: z.string().nullish() }).nullish(),
    });
    const initial = new URL(path, ORIGIN);
    let page: URL | undefined = initial;
    const visited = new Set<string>();
    const rows: T[] = [];
    while (page) {
      if (page.origin !== ORIGIN || page.username || page.password || page.pathname !== initial.pathname ||
          visited.has(page.href) || visited.size >= 100) throw new BankingError("bank_unavailable");
      visited.add(page.href);
      const payload: unknown = await (authenticated ? this.userApi(page) : this.api(page));
      const result = decode(pageSchema, payload);
      rows.push(...result.resources);
      const next = result.pagination?.next_uri;
      page = next && next !== "null" ? new URL(next, initial) : undefined;
    }
    return rows;
  }

  async listInstitutions(country: string) {
    const params = new URLSearchParams({ country_code: country, capabilities: "aggregation", aggregation_release_status: "active", limit: "500" });
    const providers = await this.list(`/v3/providers?${params}`, z.object({
      id: bridgeId, name: z.string(), country_code: z.string(), capabilities: z.array(z.string()),
    }), false);
    return providers.filter((row) => row.country_code === country && row.capabilities.includes("aggregation"))
      .map(({ id, name }) => ({ id: String(id), name }));
  }

  private async connectSession(request: ConsentRequest, connectionId: string | null): Promise<ConsentSession> {
    const session = decode(z.object({ url: z.url() }), await this.userApi(`${aggregation}/connect-sessions`, "POST", {
      callback_url: request.redirect.href,
      context: request.reference,
      account_types: "payment",
      allow_account_selection: true,
      ...(connectionId
        ? { item_id: numericId(connectionId), force_reauthentication: true }
        : { provider_id: numericId(request.institution.id), user_email: request.email }),
    }));
    const link = new URL(session.url);
    if (link.origin !== "https://connect.bridgeapi.io" || link.username || link.password) throw new BankingError("bank_unavailable");
    return { link: link.href, connectionId };
  }

  async createConnection(request: ConsentRequest) {
    await this.authenticate(true);
    return this.connectSession(request, null);
  }

  async refreshConnection(request: ConsentRequest, connectionId: string) {
    try {
      const item = await this.getConnectionStatus(connectionId);
      if (item.institutionId !== request.institution.id) throw new BankingError("invalid", 400);
    } catch (error) {
      if (!(error instanceof BankingError) || error.code !== "revoked") throw error;
      return this.createConnection(request);
    }
    return this.connectSession(request, connectionId);
  }

  async verifyCallback(callback: ConsentCallback) {
    const token = await this.authenticate();
    if (callback.userId.toLowerCase() !== token.user.uuid.toLowerCase()) throw new BankingError("invalid", 400);
  }

  async getConnectionStatus(id: string): Promise<BankConnection> {
    const data = await this.userApi(`${aggregation}/items/${numericId(id)}`).catch((error: unknown) => {
      if (error instanceof BridgeApiError && error.httpStatus === 404) throw new BankingError("revoked", 409);
      throw error;
    });
    const item = decode(z.object({
      id: bridgeId, provider_id: bridgeId, status: z.number(),
      authentication_expires_at: timestamp.nullish(), created_at: timestamp.nullish(),
    }), data);
    return {
      id: String(item.id), institutionId: String(item.provider_id), status: connectionStatus(item.status),
      expiresAt: item.authentication_expires_at ?? undefined, createdAt: item.created_at ?? undefined,
    };
  }

  async listAccounts(connection: BankConnection): Promise<BankAccount[]> {
    const accounts = await this.list(`${aggregation}/accounts?item_id=${numericId(connection.id)}&limit=500`, account, true);
    if (accounts.some((row) => String(row.item_id) !== connection.id || String(row.provider_id) !== connection.institutionId)) {
      throw new BankingError("invalid", 400);
    }
    if (!accounts.length) throw new BankingError("processing", 409);
    return accounts.filter((row) => row.data_access === "enabled").map((row) => {
      const balances: BankBalance[] = [];
      const booked = row.accounting_balance ?? row.balance;
      if (booked != null) balances.push({ type: "current", amount: String(booked), currency: row.currency_code, date: "", priority: 1 });
      // Bridge distinguishes the booked balance from its projected balance (instant_balance).
      if (row.accounting_balance != null) balances.push({ type: "available", amount: String(row.accounting_balance), currency: row.currency_code, date: "", priority: 1 });
      return {
        providerId: String(row.id),
        details: { name: row.name, iban: row.iban?.replace(/\s/g, "").toUpperCase() ?? null,
          resourceId: null, currency: row.currency_code, type: row.type ?? null },
        balances,
      };
    });
  }

  async getTransactions(accountId: string) {
    const rows = await this.list(`${aggregation}/transactions?account_id=${numericId(accountId)}&limit=500`, transaction, true);
    if (rows.some((row) => String(row.account_id) !== accountId)) throw new BankingError("invalid", 400);
    return rows.map((row) => ({
      providerId: row.id == null ? null : String(row.id),
      bookingDate: row.booking_date ?? row.date, valueDate: row.value_date ?? null,
      amount: String(row.amount), currency: row.currency_code,
      description: (row.clean_description || row.provider_description || "").trim().slice(0, 600),
      counterparty: null, reference: row.provider_external_id ?? null,
      rawCategory: row.category_id == null ? null : String(row.category_id),
      status: row.future ? "pending" as const : "booked" as const, deleted: row.deleted,
    }));
  }

  async disconnectConnection(id: string) {
    try {
      await this.userApi(`${aggregation}/items/${numericId(id)}`, "DELETE");
    } catch (error) {
      if (!(error instanceof BridgeApiError) || error.httpStatus !== 404) throw error;
    }
  }
}
