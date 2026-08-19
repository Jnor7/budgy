import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TripsPage from "@/app/(app)/trips/page";
import { ToastProvider } from "@/components/ui/feedback";
import { airportCountriesFromCodes, searchAirportCountries } from "@/lib/airports/countries";
import { SupabaseRepository } from "@/lib/data/supabase-repository";
import type { Trip } from "@/types/domain";

const countryCodes = ["FR", "GA", "CG", "CD", "CM", "SN", "CI", "MA", "DZ", "TN", "AE", "JP", "US", "CA", "BR", "TH", "MY", "SG"];

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), updateTripCoverAndWait: vi.fn(), remove: vi.fn(), reload: vi.fn(),
  loadAirportCountries: vi.fn(),
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
    data: mocks.data, ready: true, userId: "owner", create: mocks.create, update: mocks.update,
    updateTripCoverAndWait: mocks.updateTripCoverAndWait, remove: mocks.remove, reload: mocks.reload,
    loadAirportCountries: mocks.loadAirportCountries, displayName: () => "Moi", avatarUrl: () => "",
  }),
}));

const existingTrip: Trip = {
  id: "trip-country", userId: "owner", title: "Paris", destinationSummary: "France",
  countryName: "France", countryCode: "FR", startDate: "2026-11-06T00:00:00.000Z",
  endDate: "2026-11-15T00:00:00.000Z", peopleCount: 1, targetBudget: 1000,
  notes: "", isCompleted: false, createdAt: "2026-08-19T00:00:00.000Z",
  coverImageUrl: "https://images.unsplash.com/photo-stable",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data.trips.length = 0;
  mocks.data.tripMembers.length = 0;
  mocks.loadAirportCountries.mockResolvedValue(airportCountriesFromCodes(countryCodes));
  mocks.reload.mockResolvedValue(undefined);
  mocks.updateTripCoverAndWait.mockResolvedValue(undefined);
  mocks.create.mockImplementation((_key, payload) => ({ ...existingTrip, ...payload, id: "trip-new" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ provider: "fallback" }) }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Budgy V3.0.4.1 — annuaire pays", () => {
  it("derive les libelles francais depuis les codes OurAirports", () => {
    const countries = airportCountriesFromCodes(countryCodes);
    const byCode = Object.fromEntries(countries.map((country) => [country.code, country.name]));
    expect(byCode).toMatchObject({
      FR: "France", GA: "Gabon", CG: "Congo", CD: "République démocratique du Congo",
      CM: "Cameroun", SN: "Sénégal", CI: "Côte d’Ivoire", MA: "Maroc", DZ: "Algérie",
      TN: "Tunisie", AE: "Émirats arabes unis", JP: "Japon", US: "États-Unis",
      CA: "Canada", BR: "Brésil", TH: "Thaïlande", MY: "Malaisie", SG: "Singapour",
    });
  });

  it("recherche dès un caractère et limite les résultats", () => {
    const results = searchAirportCountries(airportCountriesFromCodes(countryCodes), "g", 12);
    expect(results.some((country) => country.code === "GA")).toBe(true);
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("charge les codes distincts via une RPC security invoker authentifiée", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260819214714_v3041_country_selector.sql"), "utf8");
    expect(sql).toContain("select distinct airport.country_code");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("auth.uid() is not null");
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated");
    expect(sql).not.toContain("security definer");
  });

  it("convertit la réponse Supabase en pays français triés", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ country_code: "GA" }, { country_code: "CD" }], error: null });
    const repository = new SupabaseRepository({ rpc } as never);
    await expect(repository.listAirportCountries()).resolves.toEqual([
      { code: "GA", name: "Gabon" },
      { code: "CD", name: "République démocratique du Congo" },
    ]);
    expect(rpc).toHaveBeenCalledWith("list_airport_country_codes", {});
  });
});

describe("Budgy V3.0.4.1 — sélecteur Nouveau/Modifier voyage", () => {
  it("sélectionne Gabon et enregistre son code dans un nouveau voyage", async () => {
    render(<ToastProvider><TripsPage /></ToastProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un voyage" })[0]!);
    await waitFor(() => expect(mocks.loadAirportCountries).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Libreville" } });
    const country = screen.getByRole("combobox", { name: "Pays" }) as HTMLInputElement;
    fireEvent.change(country, { target: { value: "G" } });
    expect(screen.getAllByRole("option").length).toBeLessThanOrEqual(12);
    fireEvent.change(country, { target: { value: "Gab" } });
    fireEvent.click(await screen.findByRole("option", { name: /Gabon/ }));
    expect(country.value).toBe("Gabon");
    fireEvent.click(screen.getByRole("button", { name: "Créer le voyage" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith("trips", expect.objectContaining({
      title: "Libreville", destinationSummary: "Gabon", countryName: "Gabon", countryCode: "GA",
    })));
  });

  it("fonctionne aussi dans Modifier le voyage", async () => {
    mocks.data.trips.push({ ...existingTrip } as never);
    render(<ToastProvider><TripsPage /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Modifier" }));
    await waitFor(() => expect(mocks.loadAirportCountries).toHaveBeenCalled());
    const country = screen.getByRole("combobox", { name: "Pays" }) as HTMLInputElement;
    expect(country.value).toBe("France");
    fireEvent.change(country, { target: { value: "Gab" } });
    fireEvent.click(await screen.findByRole("option", { name: /Gabon/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("trips", "trip-country", expect.objectContaining({
      countryName: "Gabon", countryCode: "GA",
    })));
  });

  it("borne la liste et le débordement mobile", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain("max-height:min(210px,32dvh)");
    expect(css).toContain("overflow-x:hidden;overflow-y:auto");
    expect(css).toContain("max-width:100%");
  });
});
