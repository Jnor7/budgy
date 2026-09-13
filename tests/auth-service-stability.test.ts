import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  signOut: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: mocked.signOut,
    signIn: { email: mocked.signIn }, signUp: { email: vi.fn() }, requestPasswordReset: vi.fn(),
  },
}));

import { signIn, signOut } from "@/services/auth";

describe("Neon Auth logout", () => {
  beforeEach(() => { mocked.signOut.mockReset(); mocked.signIn.mockReset(); });

  it("normalise une exception réseau afin que l'UI puisse arrêter son spinner", async () => {
    mocked.signIn.mockRejectedValue(new Error("Réseau indisponible"));
    await expect(signIn("user@example.com", "secret")).resolves.toMatchObject({ error: { message: "Réseau indisponible" } });
  });

  it("attend l'invalidation officielle de la session", async () => {
    mocked.signOut.mockResolvedValue({ data: { success: true }, error: null });
    await expect(signOut()).resolves.toMatchObject({ error: null });
    expect(mocked.signOut).toHaveBeenCalledOnce();
  });

  it("ne redirige pas silencieusement si l'invalidation échoue", async () => {
    mocked.signOut.mockResolvedValue({ data: null, error: { message: "Session non invalidée" } });
    await expect(signOut()).rejects.toThrow("Session non invalidée");
  });
});
