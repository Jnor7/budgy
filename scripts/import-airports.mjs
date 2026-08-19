/**
 * Import reproductible du dump public OurAirports.
 * Conserve les large/medium airports disposant d'un code IATA.
 * Requiert SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement local.
 */
const source = process.env.OURAIRPORTS_CSV_URL || "https://davidmegginson.github.io/ourairports-data/airports.csv";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour l’import.");
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

for (let offset = 0; offset < rows.length; offset += 500) {
  const batch = rows.slice(offset, offset + 500);
  const upload = await fetch(`${supabaseUrl}/rest/v1/airports?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(batch),
  });
  if (!upload.ok) throw new Error(`Import interrompu à ${offset}: ${upload.status} ${await upload.text()}`);
  process.stdout.write(`\r${Math.min(offset + batch.length, rows.length)} / ${rows.length} aéroports`);
}
process.stdout.write("\nImport OurAirports terminé.\n");
