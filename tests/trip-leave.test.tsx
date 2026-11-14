import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripMembersPanel } from "@/components/travel/trip-members-panel";
import { ToastProvider } from "@/components/ui/feedback";
import type { Trip } from "@/types/domain";

const mocks = vi.hoisted(() => ({ leaveTrip: vi.fn(), push: vi.fn(), userId: "member" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/data/data-provider", () => ({ useBudgyData: () => ({
  data: { tripMembers: [{ id: "membership", tripId: "trip", userId: "member", role: "editor", status: "accepted", createdAt: "" }], travelFriends: [] },
  userId: mocks.userId, displayName: (id: string) => id, avatarUrl: () => "", inviteToTrip: vi.fn(),
  remove: vi.fn(), leaveTrip: mocks.leaveTrip, localMode: false, registerFastPolling: () => () => undefined,
}) }));

const trip: Trip = { id: "trip", userId: "owner", title: "Paris", destinationSummary: "France", startDate: "2026-01-01", endDate: "2026-01-02", peopleCount: 2, targetBudget: 500, notes: "", isCompleted: false, createdAt: "", coverImageUrl: "" };

describe("quitter un voyage partagé", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.userId = "member"; mocks.leaveTrip.mockResolvedValue(undefined); });
  it("demande confirmation puis retire uniquement la participation", async () => {
    render(<ToastProvider><TripMembersPanel trip={trip} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Quitter le voyage" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitter" }));
    await waitFor(() => expect(mocks.leaveTrip).toHaveBeenCalledWith("trip"));
    expect(mocks.push).toHaveBeenCalledWith("/trips");
  });
  it("ne montre jamais l'action au propriétaire", () => {
    mocks.userId = "owner";
    render(<ToastProvider><TripMembersPanel trip={trip} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: "Quitter le voyage" })).toBeNull();
  });
});
