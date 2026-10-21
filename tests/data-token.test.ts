import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { token: mocked.token } }));
vi.mock("@neondatabase/auth/server", () => ({ NEON_AUTH_SESSION_COOKIE_NAME: "neon-auth.session_token" }));

import { __resetTokenCacheForTests, getDataApiToken } from "@/lib/auth/data-token";

const jwt = (expSeconds: number) => `h.${Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url")}.s`;
const cookie = (value = "abc") => `foo=1; neon-auth.session_token=${value}; bar=2`;

beforeEach(() => { mocked.token.mockReset(); __resetTokenCacheForTests(); });

describe("getDataApiToken", () => {
  it("met le JWT en cache : un seul aller-retour Neon Auth pour plusieurs requêtes", async () => {
    const now = 1_000_000;
    mocked.token.mockResolvedValue({ data: { token: jwt(now / 1000 + 900) }, error: null });
    for (let i = 0; i < 5; i += 1) expect(await getDataApiToken(cookie(), now + i)).toMatchObject({ ok: true });
    expect(mocked.token).toHaveBeenCalledTimes(1);
  });

  it("n'utilise jamais le jeton d'une autre session", async () => {
    mocked.token.mockResolvedValueOnce({ data: { token: jwt(9_999_999) }, error: null })
      .mockResolvedValueOnce({ data: { token: jwt(9_999_998) }, error: null });
    const a = await getDataApiToken(cookie("A"), 1000);
    const b = await getDataApiToken(cookie("B"), 1000);
    expect(a).toMatchObject({ ok: true }); expect(b).toMatchObject({ ok: true });
    expect(a.ok && b.ok && a.token !== b.token).toBe(true);
  });

  it("réessaie après un échec ponctuel au lieu de répondre 401", async () => {
    mocked.token.mockResolvedValueOnce({ data: null, error: { status: 500 } })
      .mockResolvedValueOnce({ data: { token: jwt(9_999_999) }, error: null });
    expect(await getDataApiToken(cookie(), 1000)).toMatchObject({ ok: true });
    expect(mocked.token).toHaveBeenCalledTimes(2);
  });

  it("renvoie 503 (réessayable) et non 401 quand Neon Auth est indisponible", async () => {
    mocked.token.mockResolvedValue({ data: null, error: { status: 502 } });
    expect(await getDataApiToken(cookie(), 1000)).toMatchObject({ ok: false, status: 503 });
  });

  it("renvoie 401 seulement quand la session est explicitement refusée, sans insister", async () => {
    mocked.token.mockResolvedValue({ data: null, error: { status: 401 } });
    expect(await getDataApiToken(cookie(), 1000)).toMatchObject({ ok: false, status: 401 });
    expect(mocked.token).toHaveBeenCalledTimes(1);
  });

  it("401 sans cookie de session, sans appeler Neon Auth", async () => {
    expect(await getDataApiToken("foo=1", 1000)).toMatchObject({ ok: false, status: 401 });
    expect(mocked.token).not.toHaveBeenCalled();
  });

  it("n'utilise pas un jeton expiré", async () => {
    mocked.token.mockResolvedValue({ data: { token: jwt(1030) }, error: null });
    await getDataApiToken(cookie(), 1_000_000);
    await getDataApiToken(cookie(), 1_000_000);
    expect(mocked.token).toHaveBeenCalledTimes(2);
  });
});
