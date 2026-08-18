import { describe, expect, it } from "vitest";
import { airports, popularAirports, searchAirports } from "@/lib/airports/airports";

describe("catalogue aéroports", () => {
  it("porte la base Swift complète sans code IATA dupliqué", () => {
    expect(airports.length).toBeGreaterThanOrEqual(200);
    expect(new Set(airports.map((airport)=>airport.code)).size).toBe(airports.length);
  });

  it("recherche sans tenir compte des accents", () => {
    expect(searchAirports("abidjan")[0]?.code).toBe("ABJ");
    expect(searchAirports("cote d'ivoire").some((airport)=>airport.code==="ABJ")).toBe(true);
  });

  it("affiche une sélection populaire stable sans recherche", () => {
    expect(popularAirports.map((airport)=>airport.code)).toContain("DXB");
    expect(searchAirports("")).toEqual(popularAirports);
  });
});
