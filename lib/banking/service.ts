import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { BankingError } from "./errors";
import { digest } from "./normalize";
import type { BankConsent, BankProvider } from "./provider";
import type { AccountSnapshot, BankingRepository, Connection } from "./repository";

const CONSENT_WINDOW = 45 * 60_000;

export class BankingService {
  constructor(private readonly repo: BankingRepository, private readonly provider: BankProvider, private readonly redirect: URL) {}

  institutions() {
    return this.provider.listInstitutions("FR");
  }

  async connect(institutionId: string) {
    const institution = (await this.institutions()).find((item) => item.id === institutionId);
    if (!institution) throw new BankingError("missing", 404);
    const operation = randomUUID();
    const previous = await this.repo.reserveConsent(this.provider.id, institution, operation);
    const state = randomBytes(32).toString("base64url");
    const redirect = new URL(this.redirect);
    redirect.searchParams.set("state", state);
    let newConsent: BankConsent | undefined;
    try {
      const request = { institution, redirect, reference: state };
      newConsent = previous.requisition_id
        ? await this.provider.refreshConnection(request)
        : await this.provider.createConnection(request);
      if (!newConsent.link || newConsent.reference !== request.reference || newConsent.institutionId !== institution.id) {
        throw new BankingError("bank_unavailable");
      }
      if (previous.requisition_id && previous.requisition_id !== newConsent.id) {
        await this.provider.disconnectConnection(previous.requisition_id);
      }
      await this.repo.saveConsent(previous.id, operation, digest(state), newConsent);
      return newConsent.link;
    } catch (error) {
      if (newConsent) await this.provider.disconnectConnection(newConsent.id).catch(() => undefined);
      await this.repo.finish(previous.id, operation, {
        status: previous.requisition_id ? undefined : "error",
      });
      throw error;
    }
  }

  async callback(state: string, interrupted = false) {
    const hash = digest(state);
    const connection = await this.repo.findByConsent(hash);
    if (!connection || !connection.consent_started_at ||
        Date.now() - connection.consent_started_at.getTime() > CONSENT_WINDOW) {
      throw new BankingError("invalid", 400);
    }
    return this.sync(connection.id, hash, interrupted);
  }

  async sync(connectionId: string, state?: string, interrupted = false) {
    const operation = randomUUID();
    const row = await this.repo.claim(connectionId, operation, state ? "callback" : "sync", state);
    try {
      const consent = await this.readConsent(row);
      const accounts = this.provider.listAccounts(consent);
      if (!accounts.length) throw new BankingError("processing", 409);
      const snapshots: AccountSnapshot[] = [];
      // Bound the provider concurrency while each account's three requests can overlap.
      for (let offset = 0; offset < accounts.length; offset += 3) {
        const batch = await Promise.all(accounts.slice(offset, offset + 3).map(async (providerId) => {
          const [details, balances, transactions] = await Promise.all([
            this.provider.getAccountDetails(providerId),
            this.provider.getBalances(providerId),
            this.provider.getTransactions(providerId),
          ]);
          return { providerId, details, balances, transactions };
        }));
        snapshots.push(...batch);
      }
      await this.repo.storeSnapshot(connectionId, operation, consent, snapshots);
    } catch (error) {
      const code = error instanceof BankingError ? error.code : "unavailable";
      const status = code === "expired" ? "expired" : code === "revoked" || code === "refused" ? "revoked" : undefined;
      const retrySeconds = code === "rate_limit" ? 86_400 : code === "pending" || code === "processing" ? 60 : 300;
      await this.repo.finish(connectionId, operation, { status, error: code, retrySeconds });
      if (code === "pending" && interrupted) throw new BankingError("refused", 409);
      throw error;
    }
  }

  private async readConsent(row: Connection) {
    if (row.provider !== this.provider.id || !row.requisition_id) throw new BankingError("invalid", 400);
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) throw new BankingError("expired", 409);
    const consent = await this.provider.getConnectionStatus(row.requisition_id);
    if (consent.id !== row.requisition_id || consent.institutionId !== row.institution_id ||
        (row.consent_state_hash && digest(consent.reference) !== row.consent_state_hash)) {
      throw new BankingError("invalid", 400);
    }
    switch (consent.status) {
      case "active":
        if (consent.expiresAt && Date.parse(consent.expiresAt) <= Date.now()) throw new BankingError("expired", 409);
        return consent;
      case "expired": throw new BankingError("expired", 409);
      case "revoked": throw new BankingError(row.status === "pending" ? "refused" : "revoked", 409);
      case "pending": throw new BankingError("pending", 409);
      default: throw new BankingError("bank_unavailable");
    }
  }

  async disconnect(connectionId: string) {
    const operation = randomUUID();
    const row = await this.repo.claim(connectionId, operation, "disconnect");
    try {
      if (row.provider !== this.provider.id) throw new BankingError("invalid", 400);
      if (row.requisition_id) await this.provider.disconnectConnection(row.requisition_id);
      await this.repo.finish(connectionId, operation, { status: "revoked", forgetConsent: true });
    } catch (error) {
      await this.repo.finish(connectionId, operation, {});
      throw error;
    }
  }
}
