import type { Accommodation, Flight, TripActivity } from "@/types/domain";

export type ItineraryItem =
  | { id: string; kind: "flight"; date: string; title: string; subtitle: string; flight: Flight }
  | { id: string; kind: "stay"; date: string; title: string; subtitle: string; stay: Accommodation }
  | { id: string; kind: "activity"; date: string; title: string; subtitle: string; activity: TripActivity };

export function buildItinerary(flights: Flight[], stays: Accommodation[], activities: TripActivity[]): ItineraryItem[] {
  return [
    ...flights.map((flight): ItineraryItem => ({
      id: flight.id, kind: "flight", date: flight.departDate,
      title: `${flight.fromCode} → ${flight.toCode}`,
      subtitle: [flight.airline, flight.flightNumber].filter(Boolean).join(" · "), flight,
    })),
    ...stays.map((stay): ItineraryItem => ({
      id: stay.id, kind: "stay", date: stay.startDate, title: `Check-in · ${stay.name}`,
      subtitle: stay.city, stay,
    })),
    ...activities.map((activity): ItineraryItem => ({
      id: activity.id, kind: "activity", date: activity.activityDate,
      title: activity.title, subtitle: activity.city, activity,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

