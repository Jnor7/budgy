// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BridgeBankProvider } from "@/lib/banking/bridge";
import type { BankProvider, ConsentRequest } from "@/lib/banking/provider";

const canonicalId = "ef906cac-ab6b-416f-8282-c1654e608008";
const bridgeUser = "f16282d8-0667-45aa-8a0b-c96b7e50d940";
const itemId = 810;
const lcl = { id: "25", name: "LCL" };
const link = "https://connect.bridgeapi.io/session/fixture";
const consent: ConsentRequest = {
  institution: lcl, redirect: new URL("https://budgy.example/api/banking/callback?state=fixture"),
  reference: "fixture", email: "session@example.test",
};

function fixture() {
  let exists = false;
  let status = 0;
  let tokenCount = 0;
  let retryItem = false;
  let maliciousCursor = false;
  const item = () => ({
    id: itemId, provider_id: Number(lcl.id), status,
    created_at: "2026-11-01T10:00:00Z", authentication_expires_at: "2099-01-01T10:00:00Z",
  });
  const request = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    expect(url.origin).toBe("https://api.bridgeapi.io");
    expect(headers.get("bridge-version")).toBe("2025-01-15");
    expect(headers.get("client-id")).toBe("test-client");
    expect(headers.get("client-secret")).toBe("test-secret");
    if (url.pathname === "/v3/providers") {
      expect(url.searchParams.get("country_code")).toBe("FR");
      expect(url.searchParams.get("capabilities")).toBe("aggregation");
      expect(headers.has("authorization")).toBe(false);
      return Response.json({ resources: [
        { id: Number(lcl.id), name: lcl.name, country_code: "FR", capabilities: ["aggregation"] },
        { id: 29, name: "Revolut", country_code: "FR", capabilities: ["aggregation"] },
        { id: 30, name: "Payments only", country_code: "FR", capabilities: ["single_payment"] },
      ] });
    }
    if (url.pathname.endsWith("/users")) {
      expect(body.external_user_id).toMatch(/^budgy-[a-f0-9]{64}$/);
      expect(body.external_user_id).not.toContain(canonicalId);
      exists = true;
      return Response.json({ uuid: bridgeUser, ...body }, { status: 201 });
    }
    if (url.pathname.endsWith("/authorization/token")) {
      if (!exists) return Response.json({ errors: [{ code: "user.authentication.unauthorized" }] }, { status: 401 });
      tokenCount++;
      return Response.json({ access_token: `token-${tokenCount}`, expires_at: "2099-01-01T00:00:00Z", user: { uuid: bridgeUser, ...body } });
    }
    expect(headers.get("authorization")).toBe(`Bearer token-${tokenCount}`);
    if (url.pathname.endsWith("/connect-sessions")) {
      expect(body).toMatchObject({ callback_url: consent.redirect.href, context: consent.reference, account_types: "payment" });
      if (body.item_id) {
        expect(body).toMatchObject({ item_id: itemId, force_reauthentication: true });
        expect(body).not.toHaveProperty("user_email");
      } else {
        expect(body).toMatchObject({ provider_id: 25, user_email: consent.email });
      }
      return Response.json({ id: "session-id", url: link });
    }
    if (url.pathname.endsWith(`/items/${itemId}`)) {
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (retryItem) {
        retryItem = false;
        return Response.json({ errors: [] }, { status: 401 });
      }
      return Response.json(item());
    }
    if (url.pathname.endsWith("/accounts")) {
      expect(url.searchParams.get("item_id")).toBe(String(itemId));
      return Response.json({ resources: [
        { id: 1, item_id: itemId, provider_id: 25, name: "Courant", currency_code: "EUR", balance: 22, accounting_balance: 25, instant_balance: 22, data_access: "enabled" },
        { id: 2, item_id: itemId, provider_id: 25, name: "GBP", currency_code: "GBP", balance: 15, data_access: "enabled" },
        { id: 3, item_id: itemId, provider_id: 25, name: "USD", currency_code: "USD", balance: 13, data_access: "disabled" },
      ] });
    }
    if (url.pathname.endsWith("/transactions")) {
      expect(url.searchParams.get("account_id")).toBe("1");
      const common = { account_id: 1, date: "2026-11-12", currency_code: "EUR", clean_description: "Netflix", amount: -9.99 };
      if (url.searchParams.has("after")) return Response.json({
        resources: [{ ...common, id: 18, future: true, deleted: false }, { ...common, id: 17, future: false, deleted: true }],
        pagination: { next_uri: null },
      });
      return Response.json({
        resources: [{ ...common, id: 16, future: false, deleted: false }],
        pagination: { next_uri: maliciousCursor ? "https://elsewhere.example/transactions" : "/v3/aggregation/transactions?account_id=1&after=first" },
      });
    }
    throw new Error("Unexpected fixture URL");
  });
  return {
    request, provider: new BridgeBankProvider("test-client", "test-secret", canonicalId, request),
    setStatus: (value: number) => { status = value; },
    rejectNextToken: () => { retryItem = true; },
    useMaliciousCursor: () => { maliciousCursor = true; },
  };
}

describe("Bridge aggregation API", () => {
  it("lists the French aggregation catalogue and starts a scoped LCL consent", async () => {
    const { provider, request } = fixture();
    const bank: BankProvider = provider;
    expect(await bank.listInstitutions("FR")).toEqual([lcl, { id: "29", name: "Revolut" }]);
    const session = await bank.createConnection(consent);
    expect(session).toEqual({ link, connectionId: null });
    expect(JSON.stringify(session)).not.toMatch(/test-secret|token-1|session@example/);
    await expect(bank.verifyCallback({ userId: canonicalId })).rejects.toMatchObject({ code: "invalid" });
    await bank.verifyCallback({ userId: bridgeUser });
    expect(request.mock.calls.filter(([input]) => String(input).endsWith("/authorization/token"))).toHaveLength(2);
  });

  it("renews an existing item and recovers a rejected access token", async () => {
    const { provider, rejectNextToken, setStatus } = fixture();
    await provider.createConnection(consent);
    rejectNextToken();
    setStatus(1010);
    expect(await provider.getConnectionStatus(String(itemId))).toMatchObject({ status: "expired" });
    expect(await provider.refreshConnection(consent, String(itemId))).toEqual({ link, connectionId: String(itemId) });
    await provider.disconnectConnection(String(itemId));
  });

  it("imports balances in native currencies and paginates booked, future and deleted transactions", async () => {
    const { provider, useMaliciousCursor } = fixture();
    await provider.createConnection(consent);
    const item = await provider.getConnectionStatus(String(itemId));
    const accounts = await provider.listAccounts(item);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]?.balances).toMatchObject([
      { type: "current", amount: "25", currency: "EUR" }, { type: "available", amount: "25", currency: "EUR" },
    ]);
    expect(accounts[1]?.balances).toMatchObject([{ type: "current", currency: "GBP", amount: "15" }]);
    expect(await provider.getTransactions("1")).toMatchObject([
      { providerId: "16", status: "booked" }, { providerId: "18", status: "pending" }, { providerId: "17", deleted: true },
    ]);
    useMaliciousCursor();
    await expect(provider.getTransactions("1")).rejects.toMatchObject({ code: "bank_unavailable" });
  });
});
