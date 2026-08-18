import { describe, expect, it } from "vitest";
import { canEditTrip, canManageTripMembers, canViewTrip, tripParticipants, visibleTrips } from "@/lib/domain/permissions";
import type { Trip, TripMember } from "@/types/domain";

const OWNER = "owner-1";
const EDITOR = "editor-1";
const VIEWER = "viewer-1";
const OUTSIDER = "outsider-1";

const trip: Trip = {
  id: "trip-1", userId: OWNER, title: "Japon 2027", destinationSummary: "Japon",
  startDate: "2027-04-01T00:00:00.000Z", endDate: "2027-04-10T00:00:00.000Z",
  peopleCount: 3, targetBudget: 4000, notes: "", isCompleted: false,
  createdAt: "2026-01-01T00:00:00.000Z", coverImageUrl: "",
};

const members: TripMember[] = [
  { id: "m-editor", tripId: trip.id, userId: EDITOR, role: "editor", status: "accepted", createdAt: "" },
  { id: "m-viewer", tripId: trip.id, userId: VIEWER, role: "viewer", status: "accepted", createdAt: "" },
  { id: "m-pending", tripId: trip.id, userId: "pending-1", role: "editor", status: "pending", createdAt: "" },
];

describe("trip collaboration permissions", () => {
  it("l'organisateur peut tout faire", () => {
    expect(canViewTrip(trip, members, OWNER)).toBe(true);
    expect(canEditTrip(trip, members, OWNER)).toBe(true);
    expect(canManageTripMembers(trip, members, OWNER)).toBe(true);
  });

  it("un éditeur peut voir et modifier mais pas gérer les membres", () => {
    expect(canViewTrip(trip, members, EDITOR)).toBe(true);
    expect(canEditTrip(trip, members, EDITOR)).toBe(true);
    expect(canManageTripMembers(trip, members, EDITOR)).toBe(false);
  });

  it("un lecteur peut voir mais pas modifier", () => {
    expect(canViewTrip(trip, members, VIEWER)).toBe(true);
    expect(canEditTrip(trip, members, VIEWER)).toBe(false);
    expect(canManageTripMembers(trip, members, VIEWER)).toBe(false);
  });

  it("un utilisateur extérieur ne voit rien", () => {
    expect(canViewTrip(trip, members, OUTSIDER)).toBe(false);
    expect(canEditTrip(trip, members, OUTSIDER)).toBe(false);
  });

  it("une invitation en attente n'accorde encore aucun droit", () => {
    expect(canViewTrip(trip, members, "pending-1")).toBe(false);
  });

  it("visibleTrips ne retourne que les voyages possédés ou partagés", () => {
    const otherTrip: Trip = { ...trip, id: "trip-2", userId: "someone-else" };
    const all = [trip, otherTrip];
    expect(visibleTrips(all, members, OWNER).map((item) => item.id)).toEqual(["trip-1"]);
    expect(visibleTrips(all, members, EDITOR).map((item) => item.id)).toEqual(["trip-1"]);
    expect(visibleTrips(all, members, OUTSIDER)).toEqual([]);
  });

  it("tripParticipants inclut le propriétaire et les membres acceptés uniquement", () => {
    const participants = tripParticipants(trip, members);
    expect(participants.map((item) => item.userId).sort()).toEqual([EDITOR, OWNER, VIEWER].sort());
  });
});
