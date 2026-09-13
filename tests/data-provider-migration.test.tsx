import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { emptyData } from "@/lib/data/seed";
import type { AppData } from "@/types/domain";

vi.mock("@/lib/neon/config", () => ({ usesNeon: true, hasInvalidNeonMode: false }));
const mocked = vi.hoisted(() => {
  let loadedData: AppData;
  return {
    client: {},
    setLoadedData: (data: AppData) => { loadedData = data; },
    loadAll: vi.fn(async () => structuredClone(loadedData)),
    setModules: vi.fn(async () => undefined),
    importArchive: vi.fn(async () => ({ inserted: 3, skipped: 0, alreadyImported: false })),
  };
});
vi.mock("@/lib/neon/client", () => ({ getNeonDataClient: () => mocked.client }));
vi.mock("@/lib/data/neon-repository", () => ({ NeonRepository: vi.fn().mockImplementation(function RepositoryMock() { return {
  currentBudgyUserId: async () => "5dc4ad8a-6dd1-41df-95a8-2062084f1935", loadAll: mocked.loadAll, loadTravel: async () => ({}),
  loadProfile: async () => ({ userId: "5dc4ad8a-6dd1-41df-95a8-2062084f1935", username: "Jnor7", avatarUrl: "avatar", createdAt: "2026-01-01", updatedAt: "2026-01-01" }),
  loadDirectory: async () => [], setModules: mocked.setModules, importArchive: mocked.importArchive,
}; }) }));

function Probe() { const { data, ready, localMode, modulesConfigured, repositoryReady, userId, importArchive } = useBudgyData(); return <div>
  <span data-testid="ready">{String(ready)}</span><span data-testid="local">{String(localMode)}</span>
  <span data-testid="repo-ready">{String(repositoryReady)}</span><span data-testid="user">{userId}</span>
  <span data-testid="budget-count">{data.budgetEntries.length}</span><span data-testid="modules-configured">{String(modulesConfigured)}</span>
  <button onClick={() => void importArchive(emptyData, "checksum-1")}>import</button>
</div>; }

beforeEach(() => { mocked.setLoadedData(structuredClone(emptyData)); mocked.loadAll.mockClear(); mocked.setModules.mockClear(); mocked.importArchive.mockClear(); });
describe("DataProvider — session Neon et UUID canonique", () => {
  it("attache le repository et expose l'UUID Budgy canonique", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("repo-ready").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("5dc4ad8a-6dd1-41df-95a8-2062084f1935");
  });
  it("importe par la RPC Neon quand le repository est prêt", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("repo-ready").textContent).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "import" }));
    await waitFor(() => expect(mocked.importArchive).toHaveBeenCalledWith(emptyData, "checksum-1"));
  });
  it("conserve 112 écritures et reconstruit les modules d'un compte historique", async () => {
    const historical = structuredClone(emptyData);
    historical.budgetEntries = Array.from({ length: 112 }, (_, index) => ({
      id: `entry-${index}`, userId: "5dc4ad8a-6dd1-41df-95a8-2062084f1935", title: `Écriture ${index}`,
      amount: 10, potentialAmount: 0, type: "depense" as const, category: "Autre", bucket: "Variable",
      scope: "Perso", date: "2026-09-01", note: "", status: "recu" as const,
    }));
    mocked.setLoadedData(historical);
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("repo-ready").textContent).toBe("true"));
    expect(screen.getByTestId("budget-count").textContent).toBe("112");
    expect(screen.getByTestId("modules-configured").textContent).toBe("true");
    expect(mocked.setModules).toHaveBeenCalledWith("5dc4ad8a-6dd1-41df-95a8-2062084f1935", ["budget"]);
  });
});
