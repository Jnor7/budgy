import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: mocked.getSession } }));
vi.mock("@/lib/neon/config", () => ({ usesNeon: true }));

import { proxy } from "@/proxy";

describe("proxy Neon Auth", () => {
  it("ne redirige jamais les endpoints /api/auth, même avec une session", async () => {
    mocked.getSession.mockResolvedValue({ data: { user: { id: "neon-user" } }, error: null });
    const response = await proxy(new NextRequest("http://localhost/api/auth/sign-out"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocked.getSession).not.toHaveBeenCalled();
  });

  it("redirige une page privée sans session vers /auth", async () => {
    mocked.getSession.mockResolvedValue({ data: null, error: null });
    const response = await proxy(new NextRequest("http://localhost/trips"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth?next=%2Ftrips");
  });

  it("ne force plus un compte authentifié vers onboarding", async () => {
    mocked.getSession.mockResolvedValue({ data: { user: { id: "neon-user" } }, error: null });
    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
