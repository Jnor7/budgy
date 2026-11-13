// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/banking/[action]/route";
import { GET as callback } from "@/app/api/banking/callback/route";
import { BankingError } from "@/lib/banking/errors";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/data-token", () => ({ getDataApiToken: vi.fn() }));
vi.mock("@/lib/banking/repository", () => ({
  BankingRepository: vi.fn(function () {
    return { overview: async () => ({ accounts: [], connections: [] }) };
  }),
}));
vi.mock("@/lib/banking/service", () => ({
  BankingService: vi.fn(function () { return { connect, callback: completeConsent }; }),
}));

import { getDataApiToken } from "@/lib/auth/data-token";
import { BankingRepository } from "@/lib/banking/repository";

const connect = vi.fn();
const completeConsent = vi.fn();
const user = "5ec77103-0b90-43b8-bfdc-6e632108fd4c";
const base = "https://budgy.example";
const consentLink = "https://ob.gocardless.com/psd2/start/test";
const context = (action: string) => ({ params: Promise.resolve({ action }) });
const post = (origin = base) => new Request(`${base}/api/banking/connect`, {
  method: "POST", headers: { origin, "content-type": "application/json", cookie: "fixture=session" },
  body: JSON.stringify({ institutionId: "revolut-fixture", budgy_user_id: "spoofed" }),
});

beforeEach(() => {
  vi.stubEnv("GOCARDLESS_BANK_SECRET_ID", "provider-secret-id");
  vi.stubEnv("GOCARDLESS_BANK_SECRET_KEY", "provider-secret-key");
  vi.stubEnv("GOCARDLESS_BANK_REDIRECT_URL", `${base}/api/banking/callback`);
  vi.stubEnv("DATABASE_URL", "postgresql://fixture");
  vi.stubEnv("NEON_DATA_API_URL", "https://data.example");
  vi.mocked(getDataApiToken).mockResolvedValue({ ok: true, token: "user-token" });
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    expect(String(input)).toBe("https://data.example/rpc/current_budgy_user_id");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer user-token");
    return Response.json(user);
  }));
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("banking HTTP routes", () => {
  it("returns an unconfigured page without touching Neon when GoCardless is disabled", async () => {
    vi.stubEnv("GOCARDLESS_BANK_SECRET_KEY", "");
    const response = await GET(new Request(`${base}/api/banking/overview`), context("overview"));
    expect(await response.json()).toEqual({ configured: false, accounts: [], connections: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(getDataApiToken).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes and uses only the session's canonical UUID for consent creation", async () => {
    connect.mockResolvedValue(consentLink);
    expect((await POST(post("https://evil.example"), context("connect"))).status).toBe(403);
    expect(getDataApiToken).not.toHaveBeenCalled();
    const response = await POST(post(), context("connect"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(BankingRepository).toHaveBeenCalledWith(user);
    expect(connect).toHaveBeenCalledWith("revolut-fixture");
    expect(await response.json()).toEqual({ link: consentLink });
  });

  it("requires an authenticated session and accepts only a valid callback state", async () => {
    const url = `${base}/api/banking/callback`;
    expect((await callback(new Request(url))).headers.get("location")).toBe("/banking?result=invalid");
    const state = "X".repeat(43);
    vi.mocked(getDataApiToken).mockResolvedValueOnce({ ok: false, status: 401, reason: "fixture" });
    expect((await callback(new Request(`${url}?state=${state}`))).headers.get("location")).toBe("/banking?result=session");
    expect(completeConsent).not.toHaveBeenCalled();
    completeConsent.mockRejectedValueOnce(new BankingError("refused", 409));
    expect((await callback(new Request(`${url}?state=${state}`))).headers.get("location")).toBe("/banking?result=refused");
    expect(completeConsent).toHaveBeenCalledWith(state, false);
    const success = await callback(new Request(`${url}?ref=${state}`));
    expect(success.status).toBe(303);
    expect(success.headers.get("location")).toBe("/banking?result=connected");
  });
});
