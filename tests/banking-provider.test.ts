// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GoCardlessBankProvider } from "@/lib/banking/gocardless";
import type { BankProvider } from "@/lib/banking/provider";

const requisitionId = "2a166f3b-1bd8-4ce4-804d-4b4365c301ea";
const agreementId = "2c166f3b-1bd8-4ce4-804d-4b4365c301ea";
const accountId = "3a166f3b-1bd8-4ce4-804d-4b4365c301ea";
const link = "https://ob.gocardless.com/psd2/start/consent";
const base = "/api/v2/";
const institution = { id: "bank-fr", name: "LCL", consentDays: 90 };
const consent = {
  id: requisitionId, institution_id: institution.id, status: "LN", reference: "fixture",
  agreement: agreementId, accounts: [accountId], link,
};

afterEach(() => vi.useRealTimers());

describe("GoCardless Bank Account Data", () => {
  it("looks up French institutions and creates a scoped consent using a cached server token", async () => {
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://bankaccountdata.gocardless.com");
      if (url.pathname === base + "token/new/") {
        expect(JSON.parse(String(init?.body))).toEqual({ secret_id: "test-id", secret_key: "test-key" });
        return Response.json({ access: "test-access", access_expires: 600, refresh: "test-refresh", refresh_expires: 3600 });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-access");
      if (url.pathname === base + "institutions/") {
        expect(url.searchParams.get("country")).toBe("FR");
        return Response.json([{ id: institution.id, name: institution.name, max_access_valid_for_days: "90" }]);
      }
      if (url.pathname === base + "agreements/enduser/") {
        expect(JSON.parse(String(init?.body))).toMatchObject({ institution_id: institution.id, access_scope: ["details", "balances", "transactions"] });
        return Response.json({ id: agreementId });
      }
      expect(url.pathname).toBe(base + "requisitions/");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        institution_id: institution.id, agreement: agreementId, reference: "fixture",
        redirect: "https://budgy.example/api/banking/callback?state=fixture",
      });
      return Response.json({ ...consent, status: "CR" });
    });
    const provider: BankProvider = new GoCardlessBankProvider("test-id", "test-key", request);
    const [first, second] = await Promise.all([provider.listInstitutions("FR"), provider.listInstitutions("FR")]);
    expect(first).toEqual([institution]);
    expect(second).toEqual(first);
    const connection = await provider.createConnection({
      institution, reference: "fixture", redirect: new URL("https://budgy.example/api/banking/callback?state=fixture"),
    });
    expect(connection).toMatchObject({ id: requisitionId, status: "pending", agreementId, link });
    expect(request.mock.calls.filter(([input]) => String(input).includes("token/new"))).toHaveLength(1);
    expect(JSON.stringify(connection)).not.toMatch(/test-(key|id|access|refresh)/);
  });

  it("refreshes an expired API token and maps actual consent expiration, revocation and account data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T08:00:00Z"));
    let status = "LN";
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname.slice(base.length);
      switch (path) {
        case "token/new/": return Response.json({ access: "first", access_expires: 60, refresh: "refresh", refresh_expires: 3600 });
        case "token/refresh/":
          expect(JSON.parse(String(init?.body))).toEqual({ refresh: "refresh" });
          return Response.json({ access: "second", access_expires: 60 });
        case `requisitions/${requisitionId}/`:
          return init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ ...consent, status });
        case `agreements/enduser/${agreementId}/`:
          return Response.json({ accepted: "2026-11-13T08:00:00Z", access_valid_for_days: 30 });
        case `accounts/${accountId}/details/`: return Response.json({ account: { currency: "EUR", name: "Compte courant" } });
        case `accounts/${accountId}/balances/`: return Response.json({ balances: [
          { balanceType: "closingBooked", balanceAmount: { currency: "GBP", amount: "100.01" } },
          { balanceType: "interimAvailable", balanceAmount: { currency: "EUR", amount: "15" } },
        ] });
        case `accounts/${accountId}/transactions/`: return Response.json({ transactions: { booked: [
          { bookingDate: "2026-11-13", remittanceInformationUnstructured: "Spotify", transactionAmount: { currency: "EUR", amount: "-9.99" } },
        ] } });
        default: throw new Error("Unexpected mock request");
      }
    });
    const provider = new GoCardlessBankProvider("id", "key", request);
    const active = await provider.getConnectionStatus(requisitionId);
    expect(active.expiresAt).toBe("2026-12-13T08:00:00.000Z");
    expect(provider.listAccounts(active)).toEqual([accountId]);
    vi.advanceTimersByTime(45_000);
    status = "EX";
    expect((await provider.getConnectionStatus(requisitionId)).status).toBe("expired");
    status = "SU";
    expect((await provider.getConnectionStatus(requisitionId)).status).toBe("revoked");
    expect(await provider.getAccountDetails(accountId)).toMatchObject({ name: "Compte courant", currency: "EUR" });
    expect(await provider.getBalances(accountId)).toMatchObject([{ type: "current", currency: "GBP" }, { type: "available", currency: "EUR" }]);
    expect(await provider.getTransactions(accountId)).toMatchObject([{ providerId: null, description: "Spotify", status: "booked" }]);
    await provider.disconnectConnection(requisitionId);
    expect(request.mock.calls.filter(([input]) => String(input).includes("token/refresh"))).toHaveLength(1);
  });
});
