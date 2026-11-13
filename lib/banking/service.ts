import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { BankingError } from "./errors";
import { digest } from "./normalize";
import type { BankConnection, BankProvider, ConsentCallback } from "./provider";
import type { AccountSnapshot, BankingRepository, Connection } from "./repository";

const CONSENT_WINDOW = 45 * 60_000;

export class BankingService {
  constructor(private readonly repo: BankingRepository, private readonly provider: BankProvider, private readonly redirect: URL) {}

  institutions() {
    return this.provider.listInstitutions("FR");
  }

  async connect(institutionId: string, email: string) {
    const institution = (await this.institutions()).find((item) => item.id === institutionId);
    if (!institution) throw new BankingError("missing", 404);
    const operation = randomUUID();
    const previous = await this.repo.reserveConsent(this.provider.id, institution, operation);
    // Hex fits Bridge's documented alphanumeric context.
    const state = randomBytes(32).toString("hex");
    const redirect = new URL(this.redirect);
    redirect.searchParams.set("state", state);
    try {
      const request = { institution, redirect, reference: state, email };
      const consent = previous.requisition_id
        ? await this.provider.refreshConnection(request, previous.requisition_id)
        : await this.provider.createConnection(request);
      await this.repo.saveConsent(previous.id, operation, digest(state), consent.connectionId);
      return consent.link;
    } catch (error) {
      await this.repo.finish(previous.id, operation, { status: previous.requisition_id ? undefined : "error" });
      throw error;
    }
  }

  async callback(state: string, result: ConsentCallback) {
    const hash = digest(state);
    const connection = await this.repo.findByConsent(hash);
    if (!connection || connection.provider !== this.provider.id || !connection.consent_started_at ||
        Date.now() - connection.consent_started_at.getTime() > CONSENT_WINDOW) {
      throw new BankingError("invalid", 400);
    }
    await this.provider.verifyCallback(result);
    if (!result.connectionId) {
      const operation = randomUUID();
      await this.repo.claim(connection.id, operation, "callback", hash);
      await this.repo.finish(connection.id, operation, {
        status: connection.requisition_id ? "expired" : "revoked", error: "refused",
      });
      throw new BankingError("refused", 409);
    }

    if (connection.requisition_id && result.connectionId !== connection.requisition_id) {
      throw new BankingError("invalid", 400);
    }
    // Resolve the browser-supplied item with the authenticated user's Bridge token.
    const item = await this.provider.getConnectionStatus(result.connectionId);
    if (item.id !== result.connectionId || item.institutionId !== connection.institution_id ||
        (!connection.requisition_id && (!item.createdAt ||
          Date.parse(item.createdAt) < connection.consent_started_at.getTime() - 30_000))) {
      throw new BankingError("invalid", 400);
    }
    await this.synchronize(connection.id, { hash, item, interrupted: result.success === false && result.step !== "sync_pending" });
  }

  sync(connectionId: string) {
    return this.synchronize(connectionId);
  }

  private async synchronize(connectionId: string, callback?: { hash: string; item: BankConnection; interrupted: boolean }) {
    const operation = randomUUID();
    const row = await this.repo.claim(connectionId, operation, callback ? "callback" : "sync", callback?.hash, callback?.item.id);
    try {
      const connection = callback?.item ?? await this.readConnection(row);
      if (connection.status === "expired" || (connection.expiresAt && Date.parse(connection.expiresAt) <= Date.now())) {
        throw new BankingError("expired", 409);
      }
      if (connection.status === "revoked") throw new BankingError("revoked", 409);
      if (connection.status === "pending") throw new BankingError(callback?.interrupted ? "refused" : "processing", 409);
      if (connection.status !== "active") throw new BankingError("bank_unavailable");
      const accounts = await this.provider.listAccounts(connection);
      const snapshots: AccountSnapshot[] = [];
      for (let offset = 0; offset < accounts.length; offset += 3) {
        const batch = await Promise.all(accounts.slice(offset, offset + 3).map(async (account) => ({
          ...account,
          transactions: await this.provider.getTransactions(account.providerId),
        })));
        snapshots.push(...batch);
      }
      await this.repo.storeSnapshot(connectionId, operation, connection, snapshots);
    } catch (error) {
      const code = error instanceof BankingError ? error.code : "unavailable";
      const status = code === "expired" ? "expired" : code === "revoked" ? "revoked" : undefined;
      const retrySeconds = code === "rate_limit" ? 86_400 : code === "processing" ? 60 : 300;
      await this.repo.finish(connectionId, operation, { status, error: code, retrySeconds });
      throw error;
    }
  }

  private async readConnection(row: Connection) {
    if (row.provider !== this.provider.id || !row.requisition_id) throw new BankingError("invalid", 400);
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) throw new BankingError("expired", 409);
    const item = await this.provider.getConnectionStatus(row.requisition_id);
    if (item.id !== row.requisition_id || item.institutionId !== row.institution_id) {
      throw new BankingError("invalid", 400);
    }
    return item;
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
