import { describe, expect, it, vi } from "vitest";
import { NeonRepository } from "@/lib/data/neon-repository";

const JNOR7_ID = "5dc4ad8a-6dd1-41df-95a8-2062084f1935";

describe("Neon identity stability", () => {
  it("résout toujours l'identité via le provisioning idempotent", async () => {
    const rpc = vi.fn(async () => ({ data: JNOR7_ID, error: null }));
    const repository = new NeonRepository({ rpc } as never);
    await expect(repository.currentBudgyUserId()).resolves.toBe(JNOR7_ID);
    expect(rpc).toHaveBeenCalledWith("ensure_current_budgy_user", {});
  });

  it("deux résolutions du même subject conservent le même UUID historique", async () => {
    const rpc = vi.fn(async () => ({ data: JNOR7_ID, error: null }));
    const repository = new NeonRepository({ rpc } as never);
    await expect(Promise.all([repository.currentBudgyUserId(), repository.currentBudgyUserId()]))
      .resolves.toEqual([JNOR7_ID, JNOR7_ID]);
  });

  it("refuse une résolution vide au lieu d'afficher un compte sans données", async () => {
    const repository = new NeonRepository({ rpc: vi.fn(async () => ({ data: null, error: null })) } as never);
    await expect(repository.currentBudgyUserId()).rejects.toThrow("UUID Budgy canonique");
  });
});
