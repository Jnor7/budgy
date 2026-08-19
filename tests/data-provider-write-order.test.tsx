import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { emptyData } from "@/lib/data/seed";

vi.mock("@/lib/supabase/config", () => ({ usesSupabase: true, hasInvalidSupabaseMode: false }));

const mocked = vi.hoisted(() => {
  let finishInsert: (() => void) | undefined;
  const insert = vi.fn((...args: [string, unknown]) => { void args; return new Promise<void>((resolve) => { finishInsert = resolve; }); });
  const update = vi.fn(async (...args: [string, string, unknown]) => { void args; });
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "owner" } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  };
  return { client, insert, update, finishInsert: () => finishInsert?.() };
});

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mocked.client }));
vi.mock("@/lib/data/supabase-repository", () => ({
  SupabaseRepository: vi.fn().mockImplementation(function RepositoryMock() {
    return {
      loadAll: async () => structuredClone(emptyData), loadProfile: async () => null,
      loadDirectory: async () => [], insert: mocked.insert, update: mocked.update,
    };
  }),
}));

function WriteProbe() {
  const { ready, create, update } = useBudgyData();
  return <button disabled={!ready} onClick={() => {
    const created = create("trips", {
      title: "Dubaï", destinationSummary: "Émirats arabes unis", countryName: "Émirats arabes unis",
      countryCode: "AE", startDate: "2026-11-06", endDate: "2026-11-15", peopleCount: 1,
      targetBudget: 1000, notes: "", isCompleted: false, createdAt: "2026-08-19", coverImageUrl: "",
    });
    update("trips", created.id, { coverImageUrl: "https://images.unsplash.com/photo-1" });
  }}>Créer puis couvrir</button>;
}

beforeEach(() => { mocked.insert.mockClear(); mocked.update.mockClear(); });

describe("DataProvider — ordre des écritures Travel", () => {
  it("attend l'insertion du voyage avant de persister sa couverture", async () => {
    render(<DataProvider><WriteProbe /></DataProvider>);
    const button = await screen.findByRole("button", { name: "Créer puis couvrir" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);

    expect(mocked.insert).toHaveBeenCalledOnce();
    expect(mocked.update).not.toHaveBeenCalled();
    mocked.finishInsert();
    await waitFor(() => expect(mocked.update).toHaveBeenCalledOnce());
    expect(mocked.update.mock.calls[0]?.[2]).toMatchObject({ coverImageUrl: "https://images.unsplash.com/photo-1" });
  });
});
