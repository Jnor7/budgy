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

/**
 * Intl fournit le catalogue ISO complet et ses noms localises : aucune liste
 * reduite de destinations n'est entretenue dans l'application.
 */
const regionCodes = Array.from({ length: 26 * 26 }, (_, index) =>
  `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
).filter((code) => frenchRegions.of(code) !== code || englishRegions.of(code) !== code);

export function airportCountryName(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  return frenchRegions.of(code) || code;
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
