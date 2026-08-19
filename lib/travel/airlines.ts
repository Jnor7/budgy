export interface Airline { name: string; iata: string; icao: string; logoUrl?: string }
export interface AirlineProvider { search(query: string): Airline[] }

const airlines: Airline[] = [
  { name: "Air France", iata: "AF", icao: "AFR" },
  { name: "Emirates", iata: "EK", icao: "UAE" },
  { name: "Qatar Airways", iata: "QR", icao: "QTR" },
  { name: "Turkish Airlines", iata: "TK", icao: "THY" },
  { name: "Transavia", iata: "TO", icao: "TVF" },
  { name: "Royal Air Maroc", iata: "AT", icao: "RAM" },
  { name: "Brussels Airlines", iata: "SN", icao: "BEL" },
  { name: "British Airways", iata: "BA", icao: "BAW" },
  { name: "Lufthansa", iata: "LH", icao: "DLH" },
  { name: "KLM", iata: "KL", icao: "KLM" },
  { name: "easyJet", iata: "U2", icao: "EZY" },
  { name: "Ryanair", iata: "FR", icao: "RYR" },
];

const normalize = (value: string) => value.toLowerCase().trim();

export class InternalAirlineProvider implements AirlineProvider {
  search(query: string) {
    const value = normalize(query);
    if (!value) return airlines.slice(0, 6);
    return airlines.filter((item) => normalize(`${item.name} ${item.iata} ${item.icao}`).includes(value)).slice(0, 6);
  }
}

export const airlineProvider: AirlineProvider = new InternalAirlineProvider();

