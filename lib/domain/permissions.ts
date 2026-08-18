import type { Trip, TripMember, TripRole, UUID } from "@/types/domain";

/**
 * Miroir côté client des policies RLS créées dans 202608190002_v2_trip_collaboration.sql.
 * La base reste la seule source de vérité : ces helpers servent uniquement à
 * masquer les actions impossibles, jamais à autoriser quoi que ce soit.
 */

export function tripRole(trip: Trip | undefined, members: TripMember[], userId: UUID): TripRole | null {
  if (!trip) return null;
  if (trip.userId === userId) return "owner";
  const membership = members.find(
    (member) => member.tripId === trip.id && member.userId === userId && member.status === "accepted",
  );
  return membership?.role ?? null;
}

export const canViewTrip = (trip: Trip | undefined, members: TripMember[], userId: UUID) =>
  tripRole(trip, members, userId) !== null;

export const canEditTrip = (trip: Trip | undefined, members: TripMember[], userId: UUID) => {
  const role = tripRole(trip, members, userId);
  return role === "owner" || role === "editor";
};

export const canManageTripMembers = (trip: Trip | undefined, members: TripMember[], userId: UUID) =>
  tripRole(trip, members, userId) === "owner";

export const canDeleteTrip = canManageTripMembers;

/** Voyages visibles : les miens + ceux où je suis membre accepté. */
export function visibleTrips(trips: Trip[], members: TripMember[], userId: UUID): Trip[] {
  const shared = new Set(
    members.filter((member) => member.userId === userId && member.status === "accepted").map((member) => member.tripId),
  );
  return trips.filter((trip) => trip.userId === userId || shared.has(trip.id));
}

/** Participants acceptés d'un voyage, propriétaire inclus. */
export function tripParticipants(trip: Trip, members: TripMember[]): { userId: UUID; role: TripRole }[] {
  const list: { userId: UUID; role: TripRole }[] = [{ userId: trip.userId, role: "owner" }];
  for (const member of members) {
    if (member.tripId !== trip.id || member.status !== "accepted") continue;
    if (member.userId === trip.userId) continue;
    list.push({ userId: member.userId, role: member.role });
  }
  return list;
}

export const roleLabel = (role: TripRole) =>
  role === "owner" ? "Organisateur" : role === "editor" ? "Peut modifier" : "Lecture seule";
