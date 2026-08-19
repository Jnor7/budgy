import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fallbackDestinationImage } from "@/lib/travel/destination-images";
import { airlineProvider } from "@/lib/travel/airlines";
import { buildItinerary } from "@/lib/travel/itinerary";
import { countryCodeToFlag, destinationSuggestions, tripCreationDetails } from "@/lib/travel/destinations";
import type { Accommodation, Flight, TripActivity } from "@/types/domain";

describe("Budgy V3 Travel", () => {
  it("fournit un fallback image sûr sans clé provider", () => {
    expect(fallbackDestinationImage()).toEqual({ provider: "fallback", photoId: "", imageUrl: "", photographer: "", photographerUrl: "", attribution: "" });
  });

  it("reconnaît une destination sans bloquer les valeurs libres", () => {
    expect(destinationSuggestions("tok")[0]).toMatchObject({ city: "Tokyo", countryCode: "JP" });
    expect(tripCreationDetails("Tokyo")).toMatchObject({ title: "Tokyo", countryName: "Japon", countryCode: "JP" });
    expect(tripCreationDetails("Ma destination", "Mon pays")).toMatchObject({ title: "Ma destination", countryName: "Mon pays", countryCode: "" });
    expect(countryCodeToFlag("AE")).toBe("🇦🇪");
  });

  it("propose Emirates sans dépendance aviation payante", () => {
    expect(airlineProvider.search("EK")[0]).toMatchObject({ name: "Emirates", iata: "EK" });
  });

  it("fusionne vols, logements et activités par chronologie", () => {
    const common = { userId: "u", tripId: "t", price: 0 };
    const flights: Flight[] = [{ ...common, id: "f", airline: "Emirates", fromCode: "CDG", toCode: "DXB", departDate: "2026-09-12T14:25:00Z", arriveDate: "2026-09-13T00:15:00Z", bookingLink: "", attachmentNote: "", status: "reserve" }];
    const stays: Accommodation[] = [{ ...common, id: "s", name: "Atlantis", city: "Dubaï", startDate: "2026-09-13", endDate: "2026-09-17", bookingLink: "", attachmentNote: "", status: "reserve" }];
    const activities: TripActivity[] = [{ ...common, id: "a", title: "Dubai Marina", city: "Dubaï", activityDate: "2026-09-13T19:30:00Z", link: "", status: "reserve", note: "" }];
    expect(buildItinerary(flights, stays, activities).map((item) => item.kind)).toEqual(["flight", "stay", "activity"]);
  });

  it("déclare les RPC amis, RLS et notifications structurantes", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260819145454_v3_travel_reimagined.sql"), "utf8");
    expect(sql).toContain("create policy travel_friend_requests_select_concerned");
    expect(sql).toContain("create or replace function public.send_travel_friend_request");
    expect(sql).toContain("create or replace function public.respond_travel_friend_request");
    expect(sql).toContain("trip_expense_notify_members");
    expect(sql).toContain("trip_checklist_notify_assignment");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete).*travel_friend/iu);
  });
});

