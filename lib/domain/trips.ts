import type { Accommodation, Flight, TripActivity } from "@/types/domain";

export function tripTotals(flights: Flight[], accommodations: Accommodation[], activities: TripActivity[]) {
  const flightsTotal = flights.reduce((sum, item) => sum + item.price, 0);
  const accommodationsTotal = accommodations.reduce((sum, item) => sum + item.price, 0);
  const activitiesTotal = activities.reduce((sum, item) => sum + item.price, 0);
  return { flightsTotal, accommodationsTotal, activitiesTotal, totalBudget: flightsTotal + accommodationsTotal + activitiesTotal };
}
