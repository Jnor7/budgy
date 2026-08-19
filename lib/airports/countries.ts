const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr-FR")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const frenchRegions = new Intl.DisplayNames(["fr"], { type: "region" });
const englishRegions = new Intl.DisplayNames(["en"], { type: "region" });

const COMMON_ALIASES: Record<string, string[]> = {
  AE: ["uae", "emirates"],
  CD: ["drc", "rdc", "republique democratique du congo"],
  CG: ["republique du congo"],
  GB: ["uk", "great britain", "angleterre"],
  KR: ["coree du sud", "south korea"],
  KP: ["coree du nord", "north korea"],
  US: ["usa", "etats unis", "united states"],
};

const TRAVEL_COUNTRY_LABELS: Record<string, string> = {
  CD: "République démocratique du Congo",
  CG: "Congo",
};

export interface AirportCountry {
  code: string;
  name: string;
}

/**
 * Intl fournit le catalogue ISO complet et ses noms localises : aucune liste
 * reduite de destinations n'est entretenue dans l'application.
 */
const regionCodes = Array.from({ length: 26 * 26 }, (_, index) =>
  `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
).filter((code) => frenchRegions.of(code) !== code || englishRegions.of(code) !== code);

const compareCountries = (left: AirportCountry, right: AirportCountry) => left.name.localeCompare(right.name, "fr", { sensitivity: "base" });

export function airportCountryName(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  return frenchRegions.of(code) || code;
}

export function travelCountryName(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  return TRAVEL_COUNTRY_LABELS[code] ?? airportCountryName(code);
}

export function airportCountriesFromCodes(countryCodes: string[]) {
  return [...new Set(countryCodes.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code)))]
    .map((code) => ({ code, name: travelCountryName(code) }))
    .sort(compareCountries);
}

/** Repli local complet fourni par Intl quand Supabase n'est pas disponible. */
export const allAirportCountries = airportCountriesFromCodes(regionCodes);

export function searchAirportCountries(countries: AirportCountry[], query: string, limit = 12) {
  const needle = normalize(query);
  if (!needle) return [];
  return countries
    .filter((country) => normalize(country.name).includes(needle) || normalize(country.code).includes(needle))
    .sort((left, right) => {
      const leftName = normalize(left.name);
      const rightName = normalize(right.name);
      const leftRank = normalize(left.code) === needle ? 0 : leftName === needle ? 1 : leftName.startsWith(needle) ? 2 : 3;
      const rightRank = normalize(right.code) === needle ? 0 : rightName === needle ? 1 : rightName.startsWith(needle) ? 2 : 3;
      return leftRank - rightRank || compareCountries(left, right);
    })
    .slice(0, Math.max(1, limit));
}

export function airportCountryCodesMatching(query: string) {
  const needle = normalize(query);
  if (needle.length < 2) return [];
  const exact: string[] = [];
  const partial: string[] = [];
  for (const code of regionCodes) {
    const candidates = [
      code,
      frenchRegions.of(code) ?? "",
      englishRegions.of(code) ?? "",
      ...(COMMON_ALIASES[code] ?? []),
    ].map(normalize);
    if (candidates.some((candidate) => candidate === needle)) exact.push(code);
    else if (candidates.some((candidate) => candidate.includes(needle))) partial.push(code);
  }
  return [...exact, ...partial].slice(0, 8);
}
