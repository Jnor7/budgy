import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { emptyData } from "@/lib/data/seed";

vi.mock("@/lib/neon/config", () => ({ usesNeon: true, hasInvalidNeonMode: false }));
const mocked = vi.hoisted(() => ({
  session: { status: "loading", userId: null } as { status: string; userId: string | null },
  listeners: new Set<() => void>(),
  attempts: 0,
  failFirst: 0,
  titles: {} as Record<string, string>,
}));
vi.mock("@/lib/auth/use-auth-session", async () => {
  const { useSyncExternalStore } = await import("react");
  let snapshot = mocked.session;
  return {
    useAuthSession: () => useSyncExternalStore(
      (listener) => { mocked.listeners.add(listener); return () => mocked.listeners.delete(listener); },
      () => { if (snapshot !== mocked.session) snapshot = mocked.session; return snapshot; },
    ),
  };
});
vi.mock("@/lib/neon/client", () => ({ getNeonDataClient: () => ({}) }));
vi.mock("@/lib/data/neon-repository", () => ({ NeonRepository: vi.fn().mockImplementation(function RepositoryMock() {
  return {
    syncVersions: async () => ({}),
    currentBudgyUserId: async () => {
      mocked.attempts += 1;
      if (mocked.attempts <= mocked.failFirst) throw new Error("JWT indisponible");
      return mocked.session.userId as string;
    },
    loadAll: async () => ({ ...structuredClone(emptyData), budgetEntries: [{ id: "e1", userId: mocked.session.userId as string, title: mocked.titles[mocked.session.userId as string] ?? "", amount: 1, potentialAmount: 0, type: "depense", category: "A", bucket: "B", scope: "Perso", date: "2026-01-01", note: "", status: "recu" }] }),
    loadTravel: async () => ({}), loadDirectory: async () => [],
    loadProfile: async (id: string) => ({ userId: id, username: `name-${id}`, avatarUrl: "", createdAt: "", updatedAt: "" }),
    setModules: async () => undefined,
  };
}) }));

const setSession = (status: string, userId: string | null) => act(() => {
  mocked.session = { status, userId };
  mocked.listeners.forEach((listener) => listener());
});

function Probe() {
  const { data, ready, profile, userId } = useBudgyData();
  return <div><span data-testid="ready">{String(ready)}</span><span data-testid="user">{userId}</span>
    <span data-testid="name">{profile?.username ?? "-"}</span><span data-testid="titles">{data.budgetEntries.map((e) => e.title).join(",")}</span></div>;
}

beforeEach(() => {
  mocked.session = { status: "loading", userId: null }; mocked.attempts = 0; mocked.failFirst = 0;
  mocked.titles = { "user-a": "Courses A", "user-b": "Loyer B" };
});

describe("DataProvider — cycle de session", () => {
  it("reste en chargement tant que la session n'est pas résolue, puis affiche profil et données sans rechargement", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(mocked.attempts).toBe(0);
    await setSession("authenticated", "user-a");
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("name").textContent).toBe("name-user-a");
    expect(screen.getByTestId("titles").textContent).toBe("Courses A");
  });

  it("réessaie avec backoff quand le premier chargement échoue (sans recharger la page)", async () => {
    mocked.failFirst = 1;
    mocked.session = { status: "authenticated", userId: "user-a" };
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("name-user-a"), { timeout: 4000 });
    expect(mocked.attempts).toBe(2);
  });

  it("efface les données du compte précédent quand un autre compte se connecte", async () => {
    mocked.session = { status: "authenticated", userId: "user-a" };
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("titles").textContent).toBe("Courses A"));
    await setSession("authenticated", "user-b");
    expect(screen.getByTestId("titles").textContent).not.toContain("Courses A");
    await waitFor(() => expect(screen.getByTestId("titles").textContent).toBe("Loyer B"));
    expect(screen.getByTestId("name").textContent).toBe("name-user-b");
  });

  it("vide tout à la déconnexion", async () => {
    mocked.session = { status: "authenticated", userId: "user-a" };
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign, pathname: "/auth" }, writable: true });
    render(<DataProvider><Probe /></DataProvider>);
    await waitFor(() => expect(screen.getByTestId("titles").textContent).toBe("Courses A"));
    await setSession("anonymous", null);
    await waitFor(() => expect(screen.getByTestId("titles").textContent).toBe(""));
    expect(screen.getByTestId("name").textContent).toBe("-");
  });
});
