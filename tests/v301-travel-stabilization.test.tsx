import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TripsPage from "@/app/(app)/trips/page";
import TripDetailPage from "@/app/(app)/trips/[id]/page";
import { TravelCover } from "@/components/travel/travel-cover";
import { TripItineraryPanel } from "@/components/travel/trip-itinerary-panel";
import { ToastProvider } from "@/components/ui/feedback";
import { RowMenu } from "@/components/ui/menu";
import { FormModal } from "@/components/ui/modal";
import { MapPin } from "lucide-react";
import { destinationImageSearchQuery, ServerDestinationImageProvider } from "@/lib/travel/destination-images";
import type { Trip } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
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
    data: mocks.data, ready: true, userId: "owner", create: mocks.create,
    update: mocks.update, remove: mocks.remove, displayName: () => "Moi",
  }),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "trip-1" }) }));

const trip: Trip = {
  id: "trip-1", userId: "owner", title: "Dubaï", destinationSummary: "Émirats arabes unis",
  countryName: "Émirats arabes unis", countryCode: "AE", startDate: "2026-11-06T00:00:00.000Z",
  endDate: "2026-11-15T00:00:00.000Z", peopleCount: 1, targetBudget: 1000, notes: "",
  isCompleted: false, createdAt: "2026-08-19T00:00:00.000Z", coverImageUrl: "",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.remove.mockReset();
  mocks.data.trips.length = 0;
  mocks.data.flights.length = 0;
  mocks.data.accommodations.length = 0;
  mocks.data.tripActivities.length = 0;
});

describe("Budgy V3.0.1 — stabilisation Travel", () => {
  it("normalise les quatre destinations de référence pour Unsplash", () => {
    expect(destinationImageSearchQuery("Dubaï", "Émirats arabes unis")).toBe("Dubai UAE travel skyline");
    expect(destinationImageSearchQuery("Tokyo", "Japon")).toBe("Tokyo Japan travel skyline");
    expect(destinationImageSearchQuery("New York", "États-Unis")).toBe("New York USA travel skyline");
    expect(destinationImageSearchQuery("Paris", "France")).toBe("Paris France travel skyline");
  });

  it("accepte une réponse photo valide et conserve le fallback en cas d'échec", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ provider: "unsplash", photoId: "photo-1", imageUrl: "https://images.unsplash.com/photo-1", photographer: "A", photographerUrl: "https://unsplash.com/@a", attribution: "Photo de A sur Unsplash" }) })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new ServerDestinationImageProvider();

    await expect(provider.findLandscape("Dubaï", "Émirats arabes unis")).resolves.toMatchObject({ provider: "unsplash", photoId: "photo-1" });
    await expect(provider.findLandscape("Dubaï", "Émirats arabes unis")).resolves.toMatchObject({ provider: "fallback", imageUrl: "" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ne rend aucun second drapeau dans le fond de couverture", () => {
    const { container } = render(<TravelCover destination="Dubaï" countryCode="AE"><h1>Dubaï 🇦🇪</h1></TravelCover>);
    expect(container.querySelector(".travel-cover-fallback")?.textContent).toBe("");
    expect(screen.getByRole("heading").textContent).toBe("Dubaï 🇦🇪");
  });

  it("affiche un menu compact avec des actions lisibles", () => {
    render(<RowMenu onEdit={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("menuitem", { name: "Modifier" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Supprimer" })).toBeTruthy();
  });

  it("empile les dates du vol et expose le formulaire logement complet", () => {
    const flightRender = render(<ToastProvider><TripItineraryPanel trip={trip} initialKind="flight" /></ToastProvider>);
    const dateRow = document.querySelector(".travel-datetime-row");
    expect(dateRow).toBeTruthy();
    expect(dateRow?.querySelectorAll('input[type="datetime-local"]')).toHaveLength(2);

    flightRender.unmount();
    render(<ToastProvider><TripItineraryPanel trip={trip} initialKind="stay" /></ToastProvider>);
    expect(screen.getByLabelText("Adresse ou ville")).toBeTruthy();
    expect(screen.getByLabelText("Référence de réservation")).toBeTruthy();
    expect(screen.getByLabelText("Notes")).toBeTruthy();
  });

  it("ferme la modale après création sans navigation ni rechargement", () => {
    vi.useFakeTimers();
    mocks.create.mockReturnValue(trip);
    render(<ToastProvider><TripsPage /></ToastProvider>);
    fireEvent.click(document.querySelector(".travel-fab") as HTMLButtonElement);
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Tokyo" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le voyage" }));
    act(() => vi.advanceTimersByTime(200));

    expect(mocks.create).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "Nouveau voyage" })).toBeNull();
  });

  it("ouvre le bon formulaire depuis une carte d'aperçu vide", () => {
    (mocks.data.trips as Trip[]).push(trip);
    render(<ToastProvider><TripDetailPage /></ToastProvider>);
    fireEvent.click(screen.getByText("Aucun vol").closest("button") as HTMLButtonElement);
    expect(screen.getByRole("dialog", { name: "Nouveau vol" })).toBeTruthy();
  });

  it("conserve le focus du champ pendant les rerendus de saisie", () => {
    function FocusHarness() {
      const [value, setValue] = useState("");
      return <FormModal open title="Focus stable" icon={MapPin} onClose={() => {}} onSubmit={() => {}}>
        <label htmlFor="stable-input">Destination</label>
        <input id="stable-input" value={value} onChange={(event) => setValue(event.target.value)} />
      </FormModal>;
    }
    render(<FocusHarness />);
    const input = screen.getByLabelText("Destination");
    input.focus();
    fireEvent.change(input, { target: { value: "Tokyo" } });
    expect(document.activeElement).toBe(input);
  });
});
