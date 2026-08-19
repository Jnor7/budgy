import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { emptyData } from "@/lib/data/seed";
import type { AppData } from "@/types/domain";

/**
 * Ces tests exercent le vrai `DataProvider`, pas une réimplémentation : ils couvrent
 * précisément la régression du bug "L'import distant nécessite le mode Supabase"
 * (repositoryReady non réactif + aucun rattrapage après une session tardive).
 */

vi.mock("@/lib/supabase/config", () => ({
  usesSupabase: true,
  hasInvalidSupabaseMode: false,
}));

type AuthUser = { id: string } | null;
type AuthStateHandler = (event: string, session: { user: { id: string } } | null) => void;

// `vi.mock` est hoisté au tout début du module : toute variable référencée dans une
// factory doit donc être créée via `vi.hoisted()`, sinon elle serait lue avant sa
// propre déclaration (TDZ) et le mock échoue silencieusement / de façon confuse.
const hoisted = vi.hoisted(() => {
  let authStateHandler: AuthStateHandler | undefined;
  const unsubscribeSpy = vi.fn();
  let getUserImpl: () => Promise<{ data: { user: { id: string } | null }; error: Error | null }>;

  const mockClient = {
    auth: {
      getUser: () => getUserImpl(),
      onAuthStateChange: (handler: AuthStateHandler) => {
        authStateHandler = handler;
        return { data: { subscription: { unsubscribe: unsubscribeSpy } } };
      },
    },
  };

  // Forme complète nécessaire : `enabledModuleKeys`/`useMemo` du provider lisent
  // `data.userModules` etc. dès le premier rendu, un objet vide ferait planter le rendu.
  const emptyAppData = () => ({
    tenants: [], rentPayments: [], tenantDebts: [], dubaiParts: [], dubaiSales: [],
    dubaiExpenses: [], dubaiCashMovements: [], businesses: [], businessContacts: [],
    businessItems: [], businessTransactions: [], businessBookings: [], businessTasks: [],
    budgetEntries: [], subscriptions: [], trips: [], flights: [], accommodations: [],
    tripActivities: [], tripChecklistItems: [], attachments: [],
    userModules: [], tripMembers: [], tripInvitations: [],
    notifications: [], tripExpenses: [], tripExpenseSplits: [],
    travelFriendRequests: [], travelFriends: [],
  }) as AppData;

  const loadAllMock = vi.fn(async () => emptyAppData());
  const loadProfileMock = vi.fn(async () => null);
  const loadDirectoryMock = vi.fn(async () => [] as unknown[]);
  const importArchiveMock = vi.fn(async () => ({ inserted: 3, skipped: 0, alreadyImported: false }));

  return {
    setGetUserImpl: (impl: typeof getUserImpl) => { getUserImpl = impl; },
    getAuthStateHandler: () => authStateHandler,
    mockClient, unsubscribeSpy, loadAllMock, loadProfileMock, loadDirectoryMock, importArchiveMock,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => hoisted.mockClient,
}));

vi.mock("@/lib/data/supabase-repository", () => ({
  // Une fonction fléchée n'est pas constructible (`new (() => {})()` lève nativement
  // "is not a constructor") : il faut une function expression classique ici, puisque
  // le provider instancie `new SupabaseRepository(client)`.
  SupabaseRepository: vi.fn().mockImplementation(function SupabaseRepositoryMock() {
    return {
      loadAll: hoisted.loadAllMock,
      loadProfile: hoisted.loadProfileMock,
      loadDirectory: hoisted.loadDirectoryMock,
      importArchive: hoisted.importArchiveMock,
    };
  }),
}));

function Probe() {
  const { ready, localMode, repositoryReady, importArchive } = useBudgyData();
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="local">{String(localMode)}</span>
      <span data-testid="repo-ready">{String(repositoryReady)}</span>
      <button onClick={() => { void importArchive(emptyData, "checksum-1").catch(() => undefined); }}>
        import
      </button>
    </div>
  );
}

const renderProvider = () => render(<DataProvider><Probe /></DataProvider>);
const setGetUser = (user: AuthUser, error: Error | null = null) =>
  hoisted.setGetUserImpl(() => Promise.resolve({ data: { user }, error }));
const setGetUserPending = () => hoisted.setGetUserImpl(() => new Promise(() => { /* jamais résolue */ }));

beforeEach(() => {
  hoisted.unsubscribeSpy.mockClear();
  hoisted.loadAllMock.mockClear();
  hoisted.loadProfileMock.mockClear();
  hoisted.loadDirectoryMock.mockClear();
  hoisted.importArchiveMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataProvider — disponibilité Supabase (régression migration)", () => {
  it("Cas 4 — session en cours de résolution : ready=false, repositoryReady=false", () => {
    setGetUserPending();
    renderProvider();
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(screen.getByTestId("repo-ready").textContent).toBe("false");
  });

  it("Cas 2 — session présente dès le premier essai : repositoryReady bascule à true", async () => {
    setGetUser({ id: "user-1" });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("repo-ready").textContent).toBe("true"));
    expect(hoisted.loadAllMock).toHaveBeenCalledTimes(1);
  });

  it("Cas 3 — session absente au premier essai : ready=true mais repositoryReady=false (pas de faux message Supabase)", async () => {
    setGetUser(null);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("repo-ready").textContent).toBe("false");
    expect(screen.getByTestId("local").textContent).toBe("false");
  });

  it("Rattrapage de session tardive : onAuthStateChange répare repositoryReady sans nécessiter de rechargement", async () => {
    setGetUser(null);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("repo-ready").textContent).toBe("false");

    // La session apparaît juste après (cookies synchronisés avec un léger retard) :
    // c'est exactement le scénario qui laissait repositoryRef.current bloqué à null.
    act(() => { hoisted.getAuthStateHandler()?.("SIGNED_IN", { user: { id: "user-2" } }); });

    await waitFor(() => expect(screen.getByTestId("repo-ready").textContent).toBe("true"));
    expect(hoisted.loadAllMock).toHaveBeenCalledTimes(1);
  });

  it("Cas 5 — repository prêt : importArchive() appelle bien SupabaseRepository.importArchive()", async () => {
    setGetUser({ id: "user-3" });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("repo-ready").textContent).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => expect(hoisted.importArchiveMock).toHaveBeenCalledTimes(1));
    expect(hoisted.importArchiveMock).toHaveBeenCalledWith(emptyData, "checksum-1");
  });

  it("désabonne le listener d'auth au démontage", async () => {
    setGetUser({ id: "user-4" });
    const { unmount } = renderProvider();
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    unmount();
    expect(hoisted.unsubscribeSpy).toHaveBeenCalledTimes(1);
  });
});
