import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TripsPage from "@/app/(app)/trips/page";
import { AirportPicker } from "@/components/ui/airport-picker";
import { ToastProvider } from "@/components/ui/feedback";
import { TravelFriendsPanel } from "@/components/travel/travel-friends-panel";
import { airportCountryCodesMatching, airportCountryName } from "@/lib/airports/countries";
import { searchAirports } from "@/lib/airports/airports";
import { SupabaseRepository } from "@/lib/data/supabase-repository";
import type { Airport } from "@/lib/airports/airports";
import type { Trip } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), updateTripCoverAndWait: vi.fn(), remove: vi.fn(), reload: vi.fn(),
  sendTravelFriendRequest: vi.fn(), respondTravelFriendRequest: vi.fn(), removeTravelFriend: vi.fn(),
  searchTravelProfiles: vi.fn(), searchAirportDirectory: vi.fn(),
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
    data: mocks.data, ready: true, userId: "owner", localMode: false,
    create: mocks.create, update: mocks.update, updateTripCoverAndWait: mocks.updateTripCoverAndWait,
    remove: mocks.remove, reload: mocks.reload, sendTravelFriendRequest: mocks.sendTravelFriendRequest,
    respondTravelFriendRequest: mocks.respondTravelFriendRequest, removeTravelFriend: mocks.removeTravelFriend,
    searchTravelProfiles: mocks.searchTravelProfiles, searchAirportDirectory: mocks.searchAirportDirectory,
    displayName: () => "Junior", avatarUrl: () => "",
  }),
}));

const trip: Trip = {
  id: "trip-v304", userId: "owner", title: "Paris", destinationSummary: "France",
  countryName: "France", countryCode: "FR", startDate: "2026-11-06T00:00:00.000Z",
  endDate: "2026-11-15T00:00:00.000Z", peopleCount: 1, targetBudget: 1000,
  notes: "", isCompleted: false, createdAt: "2026-08-19T00:00:00.000Z",
  coverImageUrl: "https://images.unsplash.com/photo-stable", coverImageProvider: "unsplash",
  coverImageId: "photo-stable", coverPhotographer: "Aiko", coverPhotographerUrl: "https://unsplash.com/@aiko",
  coverAttribution: "Photo de Aiko sur Unsplash",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data.trips.length = 0;
  mocks.data.tripMembers.length = 0;
  mocks.data.travelFriendRequests.length = 0;
  mocks.data.travelFriends.length = 0;
  mocks.reload.mockResolvedValue(undefined);
  mocks.updateTripCoverAndWait.mockResolvedValue(undefined);
  mocks.searchTravelProfiles.mockResolvedValue([{ userId: "friend", username: "Junior7", avatarUrl: "" }]);
});

afterEach(() => vi.unstubAllGlobals());

describe("Budgy V3.0.4 — couverture partagee", () => {
  it("declare une ecriture atomique owner/editor et privee", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260819212059_v304_travel_cover_sync.sql"), "utf8");
    expect(sql).toContain("public.can_edit_trip(p_trip_id, v_actor)");
    expect(sql).toContain("cover_updated_at = clock_timestamp()");
    expect(sql).toContain("security definer");
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated");
  });

  it("envoie toute la metadata Unsplash et exige la ligne confirmee", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      id: "trip-v304", cover_image_url: "https://images.unsplash.com/photo-new",
      cover_image_provider: "unsplash", cover_image_id: "photo-new", cover_photographer: "Aiko",
      cover_photographer_url: "https://unsplash.com/@aiko", cover_attribution: "Photo de Aiko sur Unsplash",
      cover_updated_at: "2026-08-19T20:00:00.000Z",
    }], error: null });
    const repository = new SupabaseRepository({ rpc } as never);
    const cover = {
      coverImageUrl: "https://images.unsplash.com/photo-new", coverImageProvider: "unsplash",
      coverImageId: "photo-new", coverPhotographer: "Aiko", coverPhotographerUrl: "https://unsplash.com/@aiko",
      coverAttribution: "Photo de Aiko sur Unsplash",
    };
    await expect(repository.updateTripCover("trip-v304", cover)).resolves.toMatchObject({
      coverImageId: "photo-new", coverUpdatedAt: "2026-08-19T20:00:00.000Z",
    });
    expect(rpc).toHaveBeenCalledWith("update_trip_cover", expect.objectContaining({
      p_trip_id: "trip-v304", p_cover_image_id: "photo-new", p_cover_photographer: "Aiko",
    }));
  });

  it("ne relance pas Unsplash lors d'une simple edition avec cover existante", async () => {
    mocks.data.trips.push({ ...trip } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ToastProvider><TripsPage /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Lyon" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Budgy V3.0.4 — demande d'ami", () => {
  async function selectFriend() {
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    fireEvent.change(screen.getByPlaceholderText("Rechercher un pseudo"), { target: { value: "Ju" } });
    fireEvent.click(await screen.findByRole("option", { name: /Junior7/ }, { timeout: 1200 }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  }

  it("ferme confirmation et recherche apres succes", async () => {
    mocks.sendTravelFriendRequest.mockResolvedValue({ status: "pending" });
    render(<ToastProvider><TravelFriendsPanel /></ToastProvider>);
    await selectFriend();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    await screen.findByText("Demande envoyée");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Ajouter un ami de voyage" })).toBeNull();
  });

  it("garde la recherche ouverte apres erreur", async () => {
    mocks.sendTravelFriendRequest.mockRejectedValue(new Error("duplicate"));
    render(<ToastProvider><TravelFriendsPanel /></ToastProvider>);
    await selectFriend();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    await screen.findByText("Demande impossible");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Ajouter un ami de voyage" })).toBeTruthy();
  });
});

describe("Budgy V3.0.4 — annuaire OurAirports", () => {
  it.each([
    ["France", ["FR"]], ["Congo", ["CG", "CD"]], ["UAE", ["AE"]],
    ["USA", ["US"]], ["Japon", ["JP"]],
  ])("resout le pays %s vers ses codes ISO", (query, expected) => {
    expect(airportCountryCodesMatching(query)).toEqual(expect.arrayContaining(expected));
  });

  it("traduit les pays en francais", () => {
    expect(airportCountryName("AE")).toBe("Émirats arabes unis");
    expect(airportCountryName("JP")).toBe("Japon");
  });

  it("recherche aussi par ville et code IATA", () => {
    expect(searchAirports("Paris").some((airport) => airport.code === "CDG")).toBe(true);
    expect(searchAirports("CDG")[0]?.code).toBe("CDG");
    expect(airportCountryCodesMatching("Paris")).toEqual([]);
    expect(airportCountryCodesMatching("CDG")).toEqual([]);
  });

  it("affiche les resultats distants en priorite et en limite 24", async () => {
    const remote = Array.from({ length: 30 }, (_, index): Airport => ({
      code: index === 0 ? "CDG" : `X${String(index).padStart(2, "0")}`,
      city: index === 0 ? "Paris" : `Ville ${index}`,
      name: index === 0 ? "Charles-de-Gaulle" : `Aéroport ${index}`,
      country: "France", countryCode: "FR", flag: "🇫🇷",
    }));
    mocks.searchAirportDirectory.mockResolvedValue(remote);
    render(<AirportPicker open title="Aéroport de départ" value="" onClose={() => undefined} onSelect={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText("Rechercher une ville, un code, un pays…"), { target: { value: "France" } });
    expect(await screen.findByText("Paris, France · CDG", {}, { timeout: 1200 })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("button").filter((button) => button.textContent?.includes("France"))).toHaveLength(24));
  });
});
