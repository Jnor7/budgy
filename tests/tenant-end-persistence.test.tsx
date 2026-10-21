import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { fromDatabaseRow, toDatabaseRow } from "@/lib/data/entity-map";
import { emptyData } from "@/lib/data/seed";
import type { AppData, Tenant } from "@/types/domain";

vi.mock("@/lib/neon/config", () => ({ usesNeon: true, hasInvalidNeonMode: false }));
vi.mock("@/lib/auth/use-auth-session", () => ({ useAuthSession: () => ({ status: "authenticated", userId: "neon-user" }) }));

const scheduled: Tenant = { id: "t1", userId: "owner", name: "Locataire programmé", monthlyRent: 500, dueDay: 5, note: "", createdAt: "2026-01-10T12:00:00Z", endedOn: "2026-12-31" };

const mocked = vi.hoisted(() => ({ update: vi.fn(async (...args: [string, string, unknown]) => { void args; }), client: {} }));
vi.mock("@/lib/auth/client", () => ({ authClient: { getSession: async () => ({ data: { user: { id: "neon-user" } }, error: null }) } }));
vi.mock("@/lib/neon/client", () => ({ getNeonDataClient: () => mocked.client }));
vi.mock("@/lib/data/neon-repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/data/neon-repository")>();
  return {
    ...original,
    NeonRepository: vi.fn().mockImplementation(function RepositoryMock() {
      return {
        currentBudgyUserId: async () => "owner",
        loadAll: async () => ({ ...structuredClone(emptyData), tenants: [structuredClone(scheduled)] } as AppData),
        loadProfile: async () => null, loadDirectory: async () => [], loadTravel: async () => ({}), insert: async () => undefined, update: mocked.update,
        setModules: async () => undefined, loadModules: async () => [],
      };
    }),
  };
});

function Probe() {
  const { ready, data, update } = useBudgyData();
  const tenant = data.tenants[0];
  return <div>
    <span data-testid="state">{ready ? `fin=${String(tenant?.endedOn)}` : "chargement"}</span>
    <button disabled={!ready} onClick={() => update("tenants", "t1", { endedOn: null })}>Annuler la fin</button>
  </div>;
}

beforeEach(() => mocked.update.mockClear());

describe("annulation d'une fin de location programmée", () => {
  it("envoie ended_on = NULL à la base (patch nul conservé) et met l'état local à jour", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("fin=2026-12-31"));
    fireEvent.click(screen.getByRole("button", { name: "Annuler la fin" }));
    await waitFor(() => expect(mocked.update).toHaveBeenCalledOnce());
    expect(mocked.update.mock.calls[0]).toEqual(["tenants", "t1", { endedOn: null }]);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("fin=null"));
  });

  it("la ligne envoyée à PostgREST contient ended_on: null (et non une clé omise)", () => {
    const row = toDatabaseRow({ endedOn: null } as unknown as Tenant);
    expect(row).toEqual({ ended_on: null });
    expect("ended_on" in row).toBe(true);
    expect(toDatabaseRow({ endedOn: undefined } as unknown as Tenant)).toEqual({});
    expect(fromDatabaseRow({ id: "t1", ended_on: null })).toMatchObject({ endedOn: null });
    expect(fromDatabaseRow({ id: "t1", ended_on: "2026-12-31" })).toMatchObject({ endedOn: "2026-12-31" });
  });

  it("le dépôt Neon passe bien ended_on: null à la mise à jour et échoue si aucune ligne n'est touchée", async () => {
    const original = await vi.importActual<typeof import("@/lib/data/neon-repository")>("@/lib/data/neon-repository");
    const patches: unknown[] = [];
    const client = (rows: number) => ({
      from: (table: string) => ({
        update: (patch: unknown) => { patches.push([table, patch]); return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: rows ? { id: "t1" } : null, error: null }) }) }) }; },
      }),
    });
    const repository = new original.NeonRepository(client(1) as never);
    await repository.update("tenants", "t1", { endedOn: null });
    expect(patches).toEqual([["tenants", { ended_on: null }]]);
    await expect(new original.NeonRepository(client(0) as never).update("tenants", "t1", { endedOn: null })).rejects.toThrow(/aucune ligne/);
  });
});
