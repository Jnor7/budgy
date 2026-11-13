// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/banking/[action]/route";
import { GET as callback } from "@/app/api/banking/callback/route";
import { BankingError } from "@/lib/banking/errors";
import { bankConfig } from "@/lib/banking/http";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: async () => ({ data: { user: { email: "session@example.test" } } }) } }));
vi.mock("@/lib/auth/data-token", () => ({ getDataApiToken: vi.fn() }));
vi.mock("@/lib/banking/repository", () => ({
  BankingRepository: vi.fn(function (userId: string) {
    return { userId, overview: async () => ({ accounts: [], connections: [] }) };
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
const base = "https://budgy-iota-green.vercel.app";
const proxyUrl = "https://budgy-bridge-proxy.onrender.com";
const consentLink = "https://connect.bridgeapi.io/session/test";
const context = (action: string) => ({ params: Promise.resolve({ action }) });
const post = (origin = base) => new Request(`${base}/api/banking/connect`, {
  method: "POST", headers: { origin, "content-type": "application/json", cookie: "fixture=session" },
  body: JSON.stringify({ institutionId: "revolut-fixture", budgy_user_id: "spoofed", email: "spoofed@example.test" }),
});

beforeEach(() => {
  vi.stubEnv("BUDGY_BRIDGE_PROXY_URL", proxyUrl);
  vi.stubEnv("BUDGY_PROXY_SECRET", "test-proxy-secret");
  vi.stubEnv("BRIDGE_REDIRECT_URL", `${base}/api/banking/callback`);
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
  it.each(["BUDGY_BRIDGE_PROXY_URL", "BUDGY_PROXY_SECRET"])("returns an unconfigured page without touching Neon when %s is missing", async (name) => {
    vi.stubEnv(name, "");
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
    expect(connect).toHaveBeenCalledWith("revolut-fixture", "session@example.test");
    expect(await response.json()).toEqual({ link: consentLink });
  });

  it("keeps the production callback on Vercel and rejects the proxy as the callback host", () => {
    expect(bankConfig()?.redirect.href).toBe(`${base}/api/banking/callback`);
    vi.stubEnv("BRIDGE_REDIRECT_URL", `${proxyUrl}/api/banking/callback`);
    expect(bankConfig()).toBeNull();
  });

  it("requires an authenticated session and accepts only a valid callback state", async () => {
    const url = `${base}/api/banking/callback`;
    expect((await callback(new Request(url))).headers.get("location")).toBe("/banking?result=invalid");
    const state = "a".repeat(64);
    const query = `user_uuid=${user}&item_id=4123&success=true`;
    vi.mocked(getDataApiToken).mockResolvedValueOnce({ ok: false, status: 401, reason: "fixture" });
    expect((await callback(new Request(`${url}?state=${state}&${query}`))).headers.get("location")).toBe("/banking?result=session");
    expect(completeConsent).not.toHaveBeenCalled();
    completeConsent.mockRejectedValueOnce(new BankingError("refused", 409));
    expect((await callback(new Request(`${url}?state=${state}&${query}`))).headers.get("location")).toBe("/banking?result=refused");
    expect(completeConsent).toHaveBeenCalledWith(state, { userId: user, connectionId: "4123", success: true, step: undefined });
    const success = await callback(new Request(`${url}?context=${state}&${query}`));
    expect(success.status).toBe(303);
    expect(success.headers.get("location")).toBe("/banking?result=connected");
  });
});
