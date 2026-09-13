import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { emptyData } from "@/lib/data/seed";

vi.mock("@/lib/neon/config", () => ({ usesNeon: true, hasInvalidNeonMode: false }));
const mocked = vi.hoisted(() => {
  let session = { data: { user: { id: "neon-auth-user" } }, error: null } as { data: { user: { id: string } | null }; error: Error | null };
  return {
    client: {}, getSession: vi.fn(async () => session),
    setSession: (user: { id: string } | null) => { session = { data: { user }, error: null }; },
    loadAll: vi.fn(async () => structuredClone(emptyData)),
    importArchive: vi.fn(async () => ({ inserted: 3, skipped: 0, alreadyImported: false })),
  };
});
vi.mock("@/lib/auth/client", () => ({ authClient: { getSession: mocked.getSession } }));
vi.mock("@/lib/neon/client", () => ({ getNeonDataClient: () => mocked.client }));
vi.mock("@/lib/data/neon-repository", () => ({ NeonRepository: vi.fn().mockImplementation(function RepositoryMock() { return {
  currentBudgyUserId: async () => "canonical-budgy-user", loadAll: mocked.loadAll, loadTravel: async () => ({}),
  loadProfile: async () => null, loadDirectory: async () => [], importArchive: mocked.importArchive,
}; }) }));

function Probe() { const { ready, localMode, repositoryReady, userId, importArchive } = useBudgyData(); return <div>
  <span data-testid="ready">{String(ready)}</span><span data-testid="local">{String(localMode)}</span>
  <span data-testid="repo-ready">{String(repositoryReady)}</span><span data-testid="user">{userId}</span>
  <button onClick={() => void importArchive(emptyData, "checksum-1")}>import</button>
</div>; }

beforeEach(() => { mocked.setSession({ id: "neon-auth-user" }); mocked.loadAll.mockClear(); mocked.importArchive.mockClear(); });
describe("DataProvider — session Neon et UUID canonique", () => {
  it("attache le repository et expose l'UUID Budgy canonique", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("repo-ready").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("canonical-budgy-user");
  });
  it("reste distant mais indisponible sans session", async () => {
    mocked.setSession(null); render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("local").textContent).toBe("false"); expect(screen.getByTestId("repo-ready").textContent).toBe("false");
  });
  it("importe par la RPC Neon quand le repository est prêt", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("repo-ready").textContent).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "import" }));
    await waitFor(() => expect(mocked.importArchive).toHaveBeenCalledWith(emptyData, "checksum-1"));
  });
});
