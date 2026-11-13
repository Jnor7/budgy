// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BankingRepository } from "@/lib/banking/repository";
import { BankingService } from "@/lib/banking/service";
import type { BankConnection, BankProvider, BankTransaction, ConsentRequest } from "@/lib/banking/provider";

const url = process.env.BUDGY_BANKING_TEST_DATABASE_URL;
const alice = "8537a128-002e-4d44-a6bf-b1838d462032";
const bob = "a1d67f2b-455f-44fc-871c-91e95be056d4";
const aliceSubject = "neon-auth-user-alice";

function fixtureBank() {
  const transactions: BankTransaction[] = [
    { providerId: null, bookingDate: "2026-11-12", valueDate: null, amount: "-9.99", currency: "EUR",
      description: "Netflix", counterparty: null, reference: null, rawCategory: null, status: "booked" },
    { providerId: "bank-id", bookingDate: "2026-11-12", valueDate: null, amount: "25.00", currency: "GBP",
      description: "Virement", counterparty: null, reference: null, rawCategory: null, status: "booked" },
  ];
  const remoteUserId = randomUUID();
  const link = "https://connect.bridgeapi.io/session/test";
  let consent: BankConnection;
  const institution = { id: "731", name: "Revolut" };
  const createConnection = vi.fn(async (request: ConsentRequest) => {
    consent = { id: "9001", institutionId: request.institution.id, status: "pending", createdAt: new Date().toISOString() };
    return { link, connectionId: null };
  });
  const provider = {
    id: "bridge", listInstitutions: vi.fn(async () => [institution]),
    createConnection,
    refreshConnection: vi.fn(async (_request: ConsentRequest, connectionId: string) => {
      consent.status = "pending";
      return { link, connectionId };
    }),
    verifyCallback: vi.fn(async () => undefined),
    getConnectionStatus: vi.fn(async () => consent),
    listAccounts: vi.fn(async () => [{
      providerId: "810", details: { name: "Revolut", iban: null, resourceId: "account-stable", currency: "EUR", type: "CACC" },
      balances: [
        { amount: "100.01", currency: "EUR", type: "available" as const, priority: 1, date: "2026-11-12" },
        { amount: "34.50", currency: "GBP", type: "current" as const, priority: 1, date: "2026-11-12" },
      ],
    }]),
    getTransactions: vi.fn(async () => transactions),
    disconnectConnection: vi.fn(async () => undefined),
  } satisfies BankProvider;
  return { provider, transactions, institution, remoteUserId, link, get consent() { return consent; } };
}

describe.skipIf(!url)("Open Banking with PostgreSQL and mock bank", () => {
  let db: Pool;
  beforeAll(async () => {
    db = new Pool({ connectionString: url });
    // Fixture only. Refuse to touch a nonempty database, including any Budgy deployment.
    const result = await db.query("select count(*)::integer as count from pg_tables where schemaname = 'public'");
    if (result.rows[0].count !== 0) throw new Error("Use an empty disposable PostgreSQL database");
    await db.query(`
      create role anonymous nologin;
      create role authenticated nologin;
      create table public.budgy_auth_identities (subject text primary key, budgy_user_id uuid not null);
      insert into public.budgy_auth_identities values ('${aliceSubject}', '${alice}'), ('neon-auth-user-bob', '${bob}');
      create function public.current_budgy_user_id() returns uuid language sql stable security definer set search_path = ''
        as $$select budgy_user_id from public.budgy_auth_identities where subject = current_setting('request.jwt.claim.sub', true)$$;
      create table public.budget_entries (
        id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null,
        amount numeric(14,2) not null, type text not null, category text not null, bucket text not null,
        scope text not null, date date not null, status text not null
      );
    `);
    await db.query(readFileSync("neon/migrations/202611130001_open_banking.sql", "utf8"));
  });

  afterAll(async () => { await db?.end(); });

  it("binds callbacks to the owner, stores snapshots, reconciles on demand and isolates users under RLS", async () => {
    const fixture = fixtureBank();
    const { provider, transactions } = fixture;
    const repo = new BankingRepository(alice, db);
    const other = new BankingRepository(bob, db);
    const redirect = new URL("https://budgy.example/api/banking/callback");
    const service = new BankingService(repo, provider, redirect);
    const email = "fixture@example.test";
    expect(await service.connect(fixture.institution.id, email)).toBe(fixture.link);
    const request = provider.createConnection.mock.calls[0]![0];
    const state = request.redirect.searchParams.get("state")!;
    expect(request.reference).toBe(state);
    const returned = { userId: fixture.remoteUserId, connectionId: fixture.consent.id };
    await expect(new BankingService(other, provider, redirect).callback(state, returned)).rejects.toMatchObject({ code: "invalid" });
    await expect(service.callback("forged", returned)).rejects.toMatchObject({ code: "invalid" });
    await expect(service.callback(state, { ...returned, connectionId: "9100" })).rejects.toMatchObject({ code: "invalid" });
    await expect(service.callback(state, { ...returned, success: false, step: "sync_pending" })).rejects.toMatchObject({ code: "processing" });
    await expect(service.callback(state, returned)).rejects.toMatchObject({ code: "invalid" });
    fixture.consent.status = "active";
    const saved = await db.query("select id, provider, requisition_id from bank_connections");
    const itemId = saved.rows[0].id;
    expect(saved.rows[0]).toMatchObject({ provider: "bridge", requisition_id: fixture.consent.id });
    await db.query("update bank_connections set next_sync_at = now() where id = $1", [itemId]);
    await service.sync(itemId);
    const overview = await repo.overview(provider.id);
    const connectionId = overview.connections[0]!.id;
    expect(overview.connections[0]!.status).toBe("active");
    expect(overview.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ currency: "EUR", available_balance: "100.01" }),
      expect.objectContaining({ currency: "GBP", current_balance: "34.50" }),
    ]));
    const entries = (await repo.transactions({ page: 0 })).transactions;
    const netflix = entries.find((item) => item.description === "Netflix")!;
    expect(netflix.budgy_category).toBe("Abonnements");
    await repo.setCategory(netflix.id, "Streaming");
    expect((await db.query("select count(*)::int as n from budget_entries")).rows[0].n).toBe(0);
    const budgetId = await repo.linkBudget(netflix.id);
    expect(await repo.linkBudget(netflix.id)).toBe(budgetId);
    expect((await db.query("select user_id, amount from budget_entries")).rows).toEqual([{ user_id: alice, amount: "9.99" }]);
    await expect(service.connect(fixture.institution.id, email)).rejects.toMatchObject({ code: "duplicate" });
    await expect(other.setCategory(netflix.id, "Intrusion")).rejects.toMatchObject({ code: "missing" });

    const makeDue = () => db.query("update bank_connections set next_sync_at = now() where id = $1", [connectionId]);
    transactions[0]!.amount = "-9.990";
    transactions[0]!.description = "  NETFLIX  ";
    await makeDue();
    await service.sync(connectionId);
    await makeDue();
    await service.sync(connectionId);
    const afterSync = (await repo.transactions({ page: 0 })).transactions;
    expect(afterSync).toHaveLength(2);
    expect(afterSync.find((item) => item.id === netflix.id)).toMatchObject({ budgy_category: "Streaming", budget_entry_id: budgetId });

    expect(await other.overview(provider.id)).toEqual({ connections: [], accounts: [] });
    const rls = await db.connect();
    try {
      await rls.query("begin");
      await rls.query("set local session authorization authenticated");
      await rls.query("select set_config('request.jwt.claim.sub', $1, true)", [aliceSubject]);
      for (const table of ["bank_connections", "bank_accounts", "bank_transactions", "bank_sync_runs"]) {
        expect((await rls.query(`select id from ${table}`)).rowCount).toBeGreaterThan(0);
      }
      await rls.query("select set_config('request.jwt.claim.sub', 'neon-auth-user-bob', true)");
      await rls.query("select set_config('budgy.banking_user_id', $1, true)", [alice]);
      for (const table of ["bank_connections", "bank_accounts", "bank_transactions", "bank_sync_runs"]) {
        expect((await rls.query(`select id from ${table}`)).rowCount).toBe(0);
      }
      await expect(rls.query("set local role budgy_banking_server")).rejects.toMatchObject({ code: "42501" });
    } finally {
      await rls.query("rollback");
      rls.release();
    }

    await makeDue();
    fixture.consent.status = "expired";
    await expect(service.sync(connectionId)).rejects.toMatchObject({ code: "expired" });
    expect((await repo.overview(provider.id)).connections[0]!.status).toBe("expired");
    await service.connect(fixture.institution.id, email);
    fixture.consent.status = "active";
    const [renewalRequest, renewedId] = provider.refreshConnection.mock.calls[0]!;
    expect(renewedId).toBe(fixture.consent.id);
    const renewal = renewalRequest.redirect.searchParams.get("state")!;
    await service.callback(renewal, returned);
    expect((await repo.transactions({ page: 0 })).transactions).toHaveLength(2);
    await service.disconnect(connectionId);
    expect((await repo.overview(provider.id)).connections[0]!.status).toBe("revoked");
    expect((await repo.transactions({ page: 0 })).transactions).toHaveLength(2);
  });
});
