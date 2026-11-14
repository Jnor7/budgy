import type { Trip } from "@/types/domain";

export type TravelFinancialBasis = "actual" | "known" | "estimated" | "unavailable";
export interface TravelFinancialSummary { amount: number; basis: TravelFinancialBasis; label: string }

export function travelFinancialSummary(trip: Trip, expenseTotal: number, itineraryTotal: number): TravelFinancialSummary {
  if (expenseTotal > 0) return { amount: expenseTotal, basis: "actual", label: "Dépenses enregistrées" };
  if (itineraryTotal > 0) return {
    amount: itineraryTotal,
    basis: /^\[TOTAL_PARTIEL\]/i.test(trip.notes.trim()) ? "known" : "actual",
    label: /^\[TOTAL_PARTIEL\]/i.test(trip.notes.trim()) ? "Total partiel connu" : "Itinéraire enregistré",
  };
  if (/^\[TOTAL_ESTIME\]/i.test(trip.notes.trim()) && trip.targetBudget > 0) {
    return { amount: trip.targetBudget, basis: "estimated", label: "Total estimé" };
  }
  return { amount: 0, basis: "unavailable", label: "Détail indisponible" };
}
