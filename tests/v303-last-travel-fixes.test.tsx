import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as destinationImageRoute } from "@/app/api/travel/destination-image/route";
import { TravelFriendsPanel } from "@/components/travel/travel-friends-panel";
import { TravelProfileSearch } from "@/components/travel/travel-profile-search";
import { ToastProvider } from "@/components/ui/feedback";
import { DateTimeField } from "@/components/ui/premium";
import type { DirectoryProfile } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  send: vi.fn(),
  respond: vi.fn(),
  remove: vi.fn(),
  data: {
    travelFriends: [] as { id: string; userA: string; userB: string }[],
    travelFriendRequests: [] as { id: string; senderId: string; recipientId: string; status: string }[],
  },
}));

vi.mock("@/lib/data/data-provider", () => ({
  useBudgyData: () => ({
    data: mocks.data,
    userId: "owner",
    displayName: (userId: string) => userId,
    avatarUrl: () => "",
    localMode: false,
    sendTravelFriendRequest: mocks.send,
    respondTravelFriendRequest: mocks.respond,
    removeTravelFriend: mocks.remove,
    searchTravelProfiles: mocks.search,
  }),
}));

const kevin: DirectoryProfile = {
  userId: "kevin-id",
  username: "Kevin",
  avatarUrl: "https://cdn.example/kevin.jpg",
};

beforeEach(() => {
  mocks.search.mockReset().mockResolvedValue([kevin]);
  mocks.send.mockReset().mockResolvedValue({ status: "pending" });
  mocks.respond.mockReset();
  mocks.remove.mockReset();
  mocks.data.travelFriends.length = 0;
  mocks.data.travelFriendRequests.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.UNSPLASH_ACCESS_KEY;
});

describe("Budgy V3.0.3 — diagnostic Unsplash", () => {
  it.each([
    ["Tokyo", "Japan", "Tokyo Japan travel"],
    ["Dubai", "UAE", "Dubai UAE travel"],
    ["Paris", "France", "Paris France travel"],
    ["New York", "USA", "New York USA travel"],
  ])("court-circuite %s avant fetch quand la clé runtime manque", async (destination, country, query) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await destinationImageRoute(new Request(`http://localhost/api/travel/destination-image?destination=${encodeURIComponent(destination)}&country=${encodeURIComponent(country)}`));
    const body = await response.json();

    expect(body).toMatchObject({ provider: "fallback", diagnostic: { query, status: 0, errorType: "configuration_missing" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne journalise que provider, status, code et message", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await destinationImageRoute(new Request("http://localhost/api/travel/destination-image?destination=Tokyo&country=Japan"));

    expect(logger).toHaveBeenCalledWith("[travel-image]", {
      provider: "unsplash",
      status: 0,
      code: "configuration_missing",
      message: "UNSPLASH_ACCESS_KEY absente du runtime.",
    });
    expect(Object.keys(logger.mock.calls[0]![1] as object).sort()).toEqual(["code", "message", "provider", "status"]);
  });
});

describe("Budgy V3.0.3 — confirmation ami", () => {
  it("sélectionne le profil sans envoyer, puis exige la confirmation", async () => {
    vi.useFakeTimers();
    render(<ToastProvider><TravelFriendsPanel /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    fireEvent.change(screen.getByLabelText("Pseudo Budgy"), { target: { value: "Ke" } });
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); });

    fireEvent.click(screen.getByRole("option", { name: /Kevin/ }));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Ajouter Kevin à vos amis de voyage ?" })).toBeTruthy();
    expect(document.querySelector('img[src="https://cdn.example/kevin.jpg"]')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }));
      await Promise.resolve();
    });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith("Kevin");
    expect(screen.getByText("Demande envoyée")).toBeTruthy();
  });

  it("bloque les profils déjà amis ou déjà demandés avec le statut attendu", async () => {
    vi.useFakeTimers();
    const profiles = [kevin, { userId: "lea-id", username: "Lea", avatarUrl: "" }];
    render(<TravelProfileSearch value="Le" onChange={() => undefined} onSelect={() => undefined} search={vi.fn().mockResolvedValue(profiles)} statusFor={(profile) => profile.userId === "kevin-id" ? "Déjà ami" : "Demande envoyée"} />);
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); });

    const options = screen.getAllByRole("option") as HTMLButtonElement[];
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.disabled)).toBe(true);
    expect(screen.getByText("Déjà ami")).toBeTruthy();
    expect(screen.getByText("Demande envoyée")).toBeTruthy();
  });
});

describe("Budgy V3.0.3 — dates et heures mobiles", () => {
  it("sépare date et heure sans datetime-local et recompose la valeur", () => {
    let latest = "";
    const { container } = render(<DateTimeField value="2026-08-19T02:00" timeLabel="Heure du test" onChange={(value) => { latest = value; }} />);
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(1);
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    fireEvent.change(screen.getByLabelText("Heure du test"), { target: { value: "03:15" } });
    expect(latest).toBe("2026-08-19T03:15");
  });

  it.each([375, 390, 430])("applique le contrat partagé anti-overflow à %i px", (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const itinerary = readFileSync(join(process.cwd(), "components/travel/trip-itinerary-panel.tsx"), "utf8");
    expect(css).toContain(".date-time-field { width:100%;min-width:0;display:grid;");
    expect(css).toContain(".form-modal .field>* { min-width:0;max-width:100%; }");
    expect(css).toContain(".form-modal .travel-datetime-row { grid-template-columns:minmax(0,1fr); }");
    expect(css).toContain(".form-modal .form-row:has(> .field > .date-field) { grid-template-columns:minmax(0,1fr); }");
    expect(itinerary).not.toContain('type="datetime-local"');
  });
});
