import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("@neondatabase/auth/server", () => ({
  handleAuthProxyRequest: mocked.handle,
  NEON_AUTH_SESSION_COOKIE_NAME: "neon-auth.session_token",
}));
vi.mock("@/lib/neon/config", () => ({ usesNeon: true }));
vi.hoisted(() => {
  process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.NEON_AUTH_COOKIE_SECRET = "x".repeat(40);
});

import { proxy } from "@/proxy";
import { decideAccess } from "@/lib/auth/access";

const withSession = (path: string) =>
  new NextRequest(`http://localhost${path}`, { headers: { cookie: "neon-auth.session_token=abc" } });
const sessionResponse = (body: unknown, init: ResponseInit = {}, cookies: string[] = []) => {
  const headers = new Headers();
  cookies.forEach((c) => headers.append("set-cookie", c));
  return new Response(JSON.stringify(body), { status: 200, ...init, headers });
};

beforeEach(() => mocked.handle.mockReset());

describe("decideAccess", () => {
  it("ne déconnecte jamais sur une erreur transitoire", () => {
    expect(decideAccess({ kind: "unknown" }, false)).toBe("allow");
    expect(decideAccess({ kind: "unknown" }, true)).toBe("allow");
  });
  it("redirige uniquement les sessions explicitement absentes", () => {
    expect(decideAccess({ kind: "anonymous" }, false)).toBe("redirect_login");
    expect(decideAccess({ kind: "anonymous" }, true)).toBe("allow");
    expect(decideAccess({ kind: "authenticated" }, true)).toBe("redirect_home");
  });
});

describe("proxy Neon Auth", () => {
  it("ne redirige jamais les endpoints /api/auth, même avec une session", async () => {
    const response = await proxy(withSession("/api/auth/sign-out"));
    expect(response.status).toBe(200);
    expect(mocked.handle).not.toHaveBeenCalled();
  });

  it("redirige une page privée sans cookie de session vers /auth sans appeler l'amont", async () => {
    const response = await proxy(new NextRequest("http://localhost/trips"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth?next=%2Ftrips");
    expect(mocked.handle).not.toHaveBeenCalled();
  });

  it("redirige si l'amont déclare la session invalide", async () => {
    mocked.handle.mockResolvedValue(sessionResponse(null));
    const response = await proxy(withSession("/trips"));
    expect(response.status).toBe(307);
  });

  it("laisse passer une session valide et recopie les cookies renouvelés", async () => {
    mocked.handle.mockResolvedValue(sessionResponse({ user: { id: "u" } }, {}, ["neon-auth.session_data=renewed; Path=/"]));
    const response = await proxy(withSession("/"));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toContain("neon-auth.session_data=renewed; Path=/");
  });

  it("n'expulse pas l'utilisateur quand l'amont est en erreur", async () => {
    mocked.handle.mockResolvedValue(new Response("boom", { status: 503 }));
    const response = await proxy(withSession("/budget"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("renvoie un compte connecté de /auth vers l'accueil", async () => {
    mocked.handle.mockResolvedValue(sessionResponse({ user: { id: "u" } }));
    const response = await proxy(withSession("/auth"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });
});
