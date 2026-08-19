import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BudgetPage from "@/app/(app)/budget/page";
import TripsPage from "@/app/(app)/trips/page";
import { GET as destinationImageRoute } from "@/app/api/travel/destination-image/route";
import { TravelProfileSearch } from "@/components/travel/travel-profile-search";
import { ToastProvider } from "@/components/ui/feedback";
import { transactionCategory } from "@/lib/domain/budget";
import type { DirectoryProfile, Trip } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  updateAndWait: vi.fn(),
  remove: vi.fn(),
  reload: vi.fn(),
  data: {
    tenants: [], rentPayments: [], tenantDebts: [], dubaiParts: [], dubaiSales: [], dubaiExpenses: [],
    dubaiCashMovements: [], businesses: [], businessContacts: [], businessItems: [], businessTransactions: [],
    businessBookings: [], businessTasks: [], budgetEntries: [], subscriptions: [], trips: [], flights: [],
    accommodations: [], tripActivities: [], tripChecklistItems: [], attachments: [], userModules: [],
    tripMembers: [], tripInvitations: [], notifications: [], tripExpenses: [], tripExpenseSplits: [],
    travelFriendRequests: [], travelFriends: [],
  },
}));

vi.mock("@/lib/data/data-provider", () => ({
  useBudgyData: () => ({
    data: mocks.data,
    ready: true,
    userId: "owner",
    create: mocks.create,
    update: mocks.update,
    updateAndWait: mocks.updateAndWait,
    remove: mocks.remove,
    reload: mocks.reload,
    displayName: () => "Junior",
    avatarUrl: () => "https://cdn.example/avatar.jpg",
  }),
}));

const trip: Trip = {
  id: "trip-v302", userId: "owner", title: "Tokyo", destinationSummary: "Japon", countryName: "Japon", countryCode: "JP",
  startDate: "2026-11-06T00:00:00.000Z", endDate: "2026-11-15T00:00:00.000Z", peopleCount: 1,
  targetBudget: 1000, notes: "", isCompleted: false, createdAt: "2026-08-19T00:00:00.000Z", coverImageUrl: "",
  coverImageId: "old-photo",
};

beforeEach(() => {
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.updateAndWait.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset();
  mocks.reload.mockReset().mockResolvedValue(undefined);
  mocks.data.trips.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.UNSPLASH_ACCESS_KEY;
});

describe("Budgy V3.0.2 — Unsplash", () => {
  it("retourne un fallback diagnostiqué lorsque la variable serveur manque", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await destinationImageRoute(new Request("http://localhost/api/travel/destination-image?destination=Tokyo&country=Japan&tripId=t1"));
    const body = await response.json();

    expect(body).toMatchObject({ provider: "fallback", diagnostic: { query: "Tokyo Japan travel", errorType: "configuration_missing", resultsCount: 0 } });
    expect(logger).toHaveBeenCalledWith("[travel-image]", {
      provider: "unsplash",
      status: 0,
      code: "configuration_missing",
      message: "UNSPLASH_ACCESS_KEY absente du runtime.",
    });
  });

  it("rend le statut HTTP Unsplash identifiable", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-only";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const response = await destinationImageRoute(new Request("http://localhost/api/travel/destination-image?destination=Paris&country=France&tripId=t2"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.diagnostic).toMatchObject({ query: "Paris France travel", status: 429, errorType: "unsplash_http_429" });
  });

  it("conserve hotlink, attribution et download_location pour un résultat valide", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-only";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [{ id: "photo-2", urls: { raw: "https://images.unsplash.com/photo-2" }, user: { name: "Aiko", links: { html: "https://unsplash.com/@aiko" } }, links: { download_location: "https://api.unsplash.com/photos/photo-2/download" } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const response = await destinationImageRoute(new Request("http://localhost/api/travel/destination-image?destination=Tokyo&country=Japan&tripId=t3"));
    const body = await response.json();

    expect(body).toMatchObject({ provider: "unsplash", photoId: "photo-2", photographer: "Aiko" });
    expect(body.imageUrl).toContain("images.unsplash.com/photo-2");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("orientation=landscape");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("content_filter=high");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.unsplash.com/photos/photo-2/download");
  });

  it("attend la persistance du refresh avant le succès et met la cover à jour", async () => {
    (mocks.data.trips as Trip[]).push({ ...trip });
    mocks.updateAndWait.mockImplementation(async (_key, _id, patch) => Object.assign(mocks.data.trips[0]!, patch));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ provider: "unsplash", photoId: "new-photo", imageUrl: "https://images.unsplash.com/new-photo", photographer: "Aiko", photographerUrl: "https://unsplash.com/@aiko", attribution: "Photo de Aiko sur Unsplash" }) }));

    render(<ToastProvider><TripsPage /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Rafraîchir la photo" }));

    await waitFor(() => expect(mocks.updateAndWait).toHaveBeenCalledWith("trips", "trip-v302", expect.objectContaining({ coverImageId: "new-photo" })));
    expect(mocks.reload).toHaveBeenCalledOnce();
    expect(await screen.findByText("Photo actualisée")).toBeTruthy();
    expect(document.querySelector('.travel-cover.has-image img[src="https://images.unsplash.com/new-photo"]')).toBeTruthy();
  });
});

describe("Budgy V3.0.2 — typeahead amis", () => {
  it("attend deux caractères, debounce 300 ms et limite les profils publics à six", async () => {
    vi.useFakeTimers();
    const profiles = Array.from({ length: 9 }, (_, index) => ({
      userId: `user-${index}`,
      username: `Junior${index}`,
      avatarUrl: `https://cdn.example/avatar-${index}.jpg`,
      email: `private-${index}@example.com`,
    })) as (DirectoryProfile & { email: string })[];
    const search = vi.fn().mockResolvedValue(profiles);
    const { container } = render(<TravelProfileSearch value="" onChange={() => undefined} onSelect={() => undefined} search={search} statusFor={() => undefined} />);
    expect(screen.getByText("Recherchez un ami par son pseudo.")).toBeTruthy();
    expect(search).not.toHaveBeenCalled();

    const { rerender } = render(<TravelProfileSearch value="J" onChange={() => undefined} onSelect={() => undefined} search={search} statusFor={() => undefined} />);
    expect(screen.getByText("Saisissez au moins 2 caractères.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(400));
    expect(search).not.toHaveBeenCalled();

    rerender(<TravelProfileSearch value="Ju" onChange={() => undefined} onSelect={() => undefined} search={search} statusFor={() => undefined} />);
    act(() => vi.advanceTimersByTime(299));
    expect(search).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(search).toHaveBeenCalledWith("Ju");
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(document.querySelector('img[src="https://cdn.example/avatar-0.jpg"]') ?? container.querySelector("img")).toBeTruthy();
    expect(screen.queryByText("private-0@example.com")).toBeNull();
  });

  it("déclare une RPC préfixée authentifiée sans email", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260819200122_travel_friend_search_v302.sql"), "utf8");
    expect(sql).toContain("char_length(v_query) < 2");
    expect(sql).toContain("least(greatest(coalesce(p_limit, 6), 1), 8)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("grant execute on function public.search_travel_profiles(text, integer) to authenticated");
    expect(sql).not.toMatch(/returns\s+table\s*\([^)]*email/iu);
  });
});

describe("Budgy V3.0.2 — dates et catégorie", () => {
  it.each([375, 390, 430])("applique le contrat anti-overflow Travel à %i px", (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain(".form-modal .travel-datetime-row { grid-template-columns:minmax(0,1fr); }");
    expect(css).toContain(".form-modal .form-grid,.form-modal .form-row,.form-modal .form-section,.form-modal .field,.form-modal .date-field,.form-modal .date-time-field,.form-modal .time-field { width:100%;min-width:0;max-width:100%; }");
  });

  it("affiche Autre comme placeholder et n'applique le fallback qu'au submit", () => {
    vi.useFakeTimers();
    render(<ToastProvider><BudgetPage /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une dépense" }));
    const category = screen.getByLabelText("Catégorie") as HTMLInputElement;
    expect(category.value).toBe("");
    expect(category.placeholder).toBe("Autre");
    fireEvent.click(screen.getByRole("button", { name: "Transport" }));
    expect(category.value).toBe("Transport");
    fireEvent.change(category, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Montant"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Intitulé"), { target: { value: "Taxi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la transaction" }));
    act(() => vi.advanceTimersByTime(200));
    expect(mocks.create).toHaveBeenCalledWith("budgetEntries", expect.objectContaining({ category: "Autre" }));
    expect(transactionCategory("  Voyage  ")).toBe("Voyage");
  });
});
