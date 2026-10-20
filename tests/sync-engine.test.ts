import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POLL, SyncEngine, isMissingSyncFunction } from "@/lib/sync/sync-engine";
import { keysForDomains } from "@/lib/sync/domains";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const make = (overrides: Partial<ConstructorParameters<typeof SyncEngine>[0]> = {}) => {
  const state = { versions: { finance: "1" } as Record<string, string>, busy: false, visible: true };
  const onChange = vi.fn(async () => true as boolean | void);
  const engine = new SyncEngine({
    fetchVersions: async () => ({ ...state.versions }),
    onChange,
    isBusy: () => state.busy,
    isVisible: () => state.visible,
    isMissingFunction: isMissingSyncFunction,
    ...overrides,
  });
  return { state, onChange, engine };
};

describe("SyncEngine", () => {
  it("ne recharge rien tant que les versions sont identiques", async () => {
    const { engine, onChange } = make();
    await engine.seed(); engine.start();
    await vi.advanceTimersByTimeAsync(POLL.active * 3);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("détecte un changement distant en moins de 2,5 s et ne recharge que le domaine concerné", async () => {
    const { engine, onChange, state } = make();
    state.versions = { finance: "1", rent: "4" };
    await engine.seed(); engine.start();
    state.versions = { finance: "2", rent: "4" };
    await vi.advanceTimersByTimeAsync(2_100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["finance"]);
    await vi.advanceTimersByTimeAsync(POLL.active * 2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ne remplace rien pendant une écriture locale puis rattrape aussitôt après", async () => {
    const { engine, onChange, state } = make();
    await engine.seed(); engine.start();
    state.busy = true;
    state.versions = { finance: "2" };
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onChange).not.toHaveBeenCalled();
    state.busy = false;
    await vi.advanceTimersByTimeAsync(POLL.busyRetry + 50);
    expect(onChange).toHaveBeenCalledWith(["finance"]);
  });

  it("réessaie sans perdre le changement quand onChange renvoie false", async () => {
    const { engine, onChange, state } = make();
    await engine.seed(); engine.start();
    onChange.mockResolvedValueOnce(false);
    state.versions = { finance: "2" };
    await vi.advanceTimersByTimeAsync(2_100 + POLL.busyRetry + 50);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ne sonde pas un onglet caché et reprend immédiatement via kick()", async () => {
    const fetchVersions = vi.fn(async () => ({ finance: "1" }));
    const { engine, state } = make({ fetchVersions });
    await engine.seed(); engine.start();
    fetchVersions.mockClear();
    state.visible = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchVersions).not.toHaveBeenCalled();
    state.visible = true;
    engine.kick();
    await vi.advanceTimersByTimeAsync(5);
    expect(fetchVersions).toHaveBeenCalledTimes(1);
  });

  it("ralentit quand l'utilisateur est inactif", async () => {
    let now = 0;
    const fetchVersions = vi.fn(async () => ({ finance: "1" }));
    const { engine } = make({ fetchVersions, now: () => now });
    await engine.seed(); engine.start();
    now = 400_000;
    fetchVersions.mockClear();
    await vi.advanceTimersByTimeAsync(POLL.active + 10);   // dernier tick programmé avec le délai court
    await vi.advanceTimersByTimeAsync(POLL.idle * 2);
    expect(fetchVersions.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("repart après une coupure réseau (backoff) et rattrape les changements", async () => {
    const { engine, onChange, state } = make();
    await engine.seed(); engine.start();
    let down = true;
    const original = state.versions;
    (engine as unknown as { options: { fetchVersions: () => Promise<Record<string, string>> } }).options.fetchVersions =
      async () => { if (down) throw new Error("offline"); return { ...state.versions }; };
    state.versions = { ...original, finance: "9" };
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onChange).not.toHaveBeenCalled();
    down = false;
    engine.kick();
    await vi.advanceTimersByTimeAsync(10);
    expect(onChange).toHaveBeenCalledWith(["finance"]);
  });

  it("bascule en mode dégradé (rechargement complet) si la migration SQL est absente", async () => {
    const missing = Object.assign(new Error("Could not find the function public.get_sync_versions"), { code: "PGRST202" });
    const { engine, onChange } = make({ fetchVersions: async () => { throw missing; } });
    await engine.seed();
    expect(engine.mode).toBe("degraded");
    engine.start();
    await vi.advanceTimersByTimeAsync(POLL.degraded + 50);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("domaines", () => {
  it("expose les collections de chaque domaine sans doublon", () => {
    const keys = keysForDomains(["finance", "rent", "finance", "inconnu"]);
    expect(keys).toEqual(["budgetEntries", "subscriptions", "tenants", "rentPayments", "tenantDebts"]);
  });
});
