/**
 * Import reproductible du dump public OurAirports.
 * Conserve les large/medium airports disposant d'un code IATA.
 * Requiert DATABASE_URL_UNPOOLED (ou DATABASE_URL) dans l'environnement local.
 */
import pg from "pg";

const source = process.env.OURAIRPORTS_CSV_URL || "https://davidmegginson.github.io/ourairports-data/airports.csv";
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL est requis pour l’import.");
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value); value = ""; }
    else value += character;
  }
  values.push(value);
  return values;
}

const response = await fetch(source);
if (!response.ok) throw new Error(`Téléchargement OurAirports impossible (${response.status}).`);
const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines.shift()).map((header) => header.replace(/^\uFEFF/, ""));
const rows = lines.map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
})
  .filter((row) => ["large_airport", "medium_airport"].includes(row.type) && row.iata_code)
  .map((row) => ({
    id: Number(row.id), ident: row.ident, iata_code: row.iata_code || null,
    icao_code: row.gps_code || null, name: row.name, municipality: row.municipality || "",
    country_code: row.iso_country, latitude: Number(row.latitude_deg) || null,
    longitude: Number(row.longitude_deg) || null, type: row.type,
  }));

const client = new pg.Client({ connectionString });
await client.connect();
try {
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    await client.query(`
      insert into public.airports
        (id, ident, iata_code, icao_code, name, municipality, country_code, latitude, longitude, type)
      select id, ident, iata_code, icao_code, name, municipality, country_code, latitude, longitude, type
      from jsonb_to_recordset($1::jsonb) as source(
        id bigint, ident text, iata_code text, icao_code text, name text,
        municipality text, country_code text, latitude double precision,
        longitude double precision, type text
      )
      on conflict (id) do update set
        ident = excluded.ident, iata_code = excluded.iata_code, icao_code = excluded.icao_code,
        name = excluded.name, municipality = excluded.municipality, country_code = excluded.country_code,
        latitude = excluded.latitude, longitude = excluded.longitude, type = excluded.type
    `, [JSON.stringify(batch)]);
    process.stdout.write(`\r${Math.min(offset + batch.length, rows.length)} / ${rows.length} aéroports`);
  }
} finally {
  await client.end();
}
process.stdout.write("\nImport OurAirports terminé.\n");
