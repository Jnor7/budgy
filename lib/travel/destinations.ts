export interface DestinationSuggestion {
  city: string;
  country: string;
  countryCode: string;
}

const catalog: DestinationSuggestion[] = [
  { city: "Dubaï", country: "Émirats arabes unis", countryCode: "AE" },
  { city: "Tokyo", country: "Japon", countryCode: "JP" },
  { city: "New York", country: "États-Unis", countryCode: "US" },
  { city: "Paris", country: "France", countryCode: "FR" },
  { city: "Istanbul", country: "Turquie", countryCode: "TR" },
  { city: "Londres", country: "Royaume-Uni", countryCode: "GB" },
  { city: "Rome", country: "Italie", countryCode: "IT" },
  { city: "Barcelone", country: "Espagne", countryCode: "ES" },
  { city: "Marrakech", country: "Maroc", countryCode: "MA" },
  { city: "Abidjan", country: "Côte d’Ivoire", countryCode: "CI" },
  { city: "Kinshasa", country: "République démocratique du Congo", countryCode: "CD" },
  { city: "Montréal", country: "Canada", countryCode: "CA" },
  { city: "Bangkok", country: "Thaïlande", countryCode: "TH" },
  { city: "Bali", country: "Indonésie", countryCode: "ID" },
  { city: "Dakar", country: "Sénégal", countryCode: "SN" },
  { city: "Lisbonne", country: "Portugal", countryCode: "PT" },
];

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function destinationSuggestions(query: string, limit = 5) {
  const value = normalize(query);
  if (value.length < 2) return [];
  return catalog
    .filter((item) => normalize(`${item.city} ${item.country}`).includes(value))
    .sort((a, b) => Number(!normalize(a.city).startsWith(value)) - Number(!normalize(b.city).startsWith(value)))
    .slice(0, limit);
}

export function inferDestination(city: string, country = "") {
  const cityValue = normalize(city);
  const countryValue = normalize(country);
  return catalog.find((item) => normalize(item.city) === cityValue)
    ?? catalog.find((item) => countryValue && normalize(item.country) === countryValue);
}

export function tripCreationDetails(city: string, country = "", countryCode = "") {
  const title = city.trim();
  const inferred = inferDestination(title, country);
  const countryName = country.trim() || inferred?.country || "";
  return {
    title,
    destinationSummary: countryName,
    countryName,
    countryCode: countryCode.trim().toUpperCase() || inferred?.countryCode || "",
  };
}

export function countryCodeToFlag(countryCode?: string) {
  const code = countryCode?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🌍";
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)));
}

export function destinationFlag(destination: string, countryCode?: string) {
  return countryCodeToFlag(countryCode || inferDestination(destination)?.countryCode);
}
