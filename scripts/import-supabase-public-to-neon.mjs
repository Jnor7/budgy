import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
const backupPath = process.env.SUPABASE_BACKUP_PATH;

if (!databaseUrl || !backupPath) {
  throw new Error("DATABASE_URL and SUPABASE_BACKUP_PATH are required");
}

let dump = "";
await pipeline(
  createReadStream(backupPath),
  createGunzip(),
  new Writable({
    write(chunk, _encoding, callback) {
      dump += chunk.toString("utf8");
      callback();
    },
  }),
);

const header = /^-- (?:Data for )?Name: (.*?); Type: (.*?); Schema: (.*?); Owner: (.*?)$/gm;
const matches = [...dump.matchAll(header)];
const sections = matches.map((match, index) => ({
  name: match[1],
  type: match[2],
  schema: match[3],
  body: dump.slice(match.index + match[0].length, matches[index + 1]?.index ?? dump.length),
}));

const publicSections = sections.filter((section) => section.schema === "public");
const byType = (type) => publicSections.filter((section) => section.type === type);
const cleanSql = (body) => body
  .replace(/^--\s*$/gm, "")
  .replace(/^ALTER (?:TABLE|FUNCTION) .* OWNER TO .*;\s*$/gm, "")
  .replaceAll("extensions.gen_random_bytes", "public.gen_random_bytes")
  .trim();

const safeFunctions = new Set([
  "set_updated_at()",
]);
const safeTriggers = new Set([
  "user_preferences preferences_updated_at",
  "profiles profiles_updated_at",
  "user_modules user_modules_updated_at",
]);

function parseCopy(section) {
  const body = section.body.replace(/^--\s*\r?\n/gm, "").trimStart();
  const firstNewline = body.indexOf("\n");
  const command = body.slice(0, firstNewline).trim();
  const end = body.lastIndexOf("\\.");
  if (!command.startsWith("COPY public.") || end < 0) {
    throw new Error(`Unexpected COPY block for ${section.name}`);
  }
  return { command, data: body.slice(firstNewline + 1, end) };
}

function decodeCopy(value) {
  if (value === "\\N") return null;
  return value.replace(/\\([btnrfv\\])/g, (_match, escaped) => ({
    b: "\b", t: "\t", n: "\n", r: "\r", f: "\f", v: "\v", "\\": "\\",
  })[escaped]);
}

function sourceRows(section) {
  const { command, data } = parseCopy(section);
  const columns = command.match(/^COPY public\.[^(]+ \((.*)\) FROM stdin;$/)?.[1]
    .split(", ")
    .map((column) => column.replaceAll('"', ""));
  if (!columns) throw new Error(`Cannot parse columns for ${section.name}`);
  if (!data.trim()) return [];
  return data.replace(/\r?\n$/, "").split(/\r?\n/).map((line) => {
    const values = line.split("\t").map(decodeCopy);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

const report = { tables: {}, deferredAuthFks: [], samples: {}, relationChecks: {} };

try {
  await client.query("BEGIN");

  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public");

  const existing = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const collisions = existing.rows.map((row) => row.tablename);
  if (collisions.length) throw new Error(`Public schema is not empty: ${collisions.join(", ")}`);

  for (const section of byType("TABLE")) {
    await client.query(cleanSql(section.body));
  }

  for (const section of byType("TABLE DATA")) {
    const { command, data } = parseCopy(section);
    const stream = client.query(copyFrom(command));
    stream.end(data ? (data.endsWith("\n") ? data : `${data}\n`) : "");
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  }

  for (const section of byType("CONSTRAINT")) {
    await client.query(cleanSql(section.body));
  }

  for (const section of byType("INDEX")) {
    await client.query(cleanSql(section.body));
  }

  for (const section of byType("FK CONSTRAINT")) {
    const sql = cleanSql(section.body);
    if (/REFERENCES\s+auth\.users/i.test(sql)) {
      report.deferredAuthFks.push(section.name);
      continue;
    }
    await client.query(sql);
  }

  for (const section of byType("FUNCTION").filter((item) => safeFunctions.has(item.name))) {
    await client.query(cleanSql(section.body));
  }

  for (const section of byType("TRIGGER").filter((item) => safeTriggers.has(item.name))) {
    await client.query(cleanSql(section.body));
  }

  for (const section of byType("TABLE DATA")) {
    const expected = sourceRows(section).length;
    const result = await client.query(`SELECT count(*)::int AS count FROM public.${section.name}`);
    report.tables[section.name] = { source: expected, neon: result.rows[0].count };
    if (result.rows[0].count !== expected) throw new Error(`Row-count mismatch for ${section.name}`);
  }

  const sampleColumns = {
    profiles: ["user_id", "username", "avatar_url"],
    budget_entries: ["id", "user_id", "amount", "date", "title"],
    trips: ["id", "user_id", "target_budget", "start_date", "end_date", "title"],
    trip_members: ["id", "trip_id", "user_id"],
    trip_expenses: ["id", "user_id", "trip_id", "paid_by", "amount", "date", "title"],
    trip_checklist_items: ["id", "user_id", "trip_id", "assigned_to", "title"],
    travel_friend_requests: ["id", "sender_id", "recipient_id", "status"],
    travel_friends: ["id", "user_a", "user_b"],
    tenants: ["id", "user_id", "monthly_rent", "name"],
    businesses: ["id", "user_id", "name"],
    attachments: ["id", "user_id", "file_name", "storage_path"],
  };

  for (const [table, columns] of Object.entries(sampleColumns)) {
    const section = byType("TABLE DATA").find((item) => item.name === table);
    const rows = sourceRows(section);
    const chosen = rows.length < 2 ? rows : [rows[0], rows.at(-1)];
    let checked = 0;
    for (const source of chosen) {
      const pk = table === "profiles" ? "user_id" : "id";
      const result = await client.query(
        `SELECT ${columns.map((column) => `${column}::text AS ${column}`).join(", ")} FROM public.${table} WHERE ${pk} = $1::uuid`,
        [source[pk]],
      );
      if (result.rowCount !== 1) throw new Error(`Missing sample row in ${table}`);
      for (const column of columns) {
        const expected = source[column] === "" ? "" : source[column];
        const actual = result.rows[0][column];
        if (actual !== expected) throw new Error(`Sample mismatch ${table}.${column}`);
      }
      checked += 1;
    }
    report.samples[table] = checked;
  }

  const relationQueries = {
    trip_members_trip: "SELECT count(*)::int AS count FROM public.trip_members c LEFT JOIN public.trips p ON p.id=c.trip_id WHERE p.id IS NULL",
    trip_expenses_trip: "SELECT count(*)::int AS count FROM public.trip_expenses c LEFT JOIN public.trips p ON p.id=c.trip_id WHERE p.id IS NULL",
    checklist_trip: "SELECT count(*)::int AS count FROM public.trip_checklist_items c LEFT JOIN public.trips p ON p.id=c.trip_id WHERE p.id IS NULL",
    rentals_tenant: "SELECT count(*)::int AS count FROM public.rent_payments c LEFT JOIN public.tenants p ON p.id=c.tenant_id WHERE p.id IS NULL",
    business_contacts_business: "SELECT count(*)::int AS count FROM public.business_contacts c LEFT JOIN public.businesses p ON p.id=c.business_id WHERE p.id IS NULL",
    user_refs_profiles: `SELECT count(*)::int AS count FROM (
      SELECT user_id FROM public.budget_entries UNION ALL SELECT user_id FROM public.trips
      UNION ALL SELECT user_id FROM public.tenants UNION ALL SELECT user_id FROM public.businesses
      UNION ALL SELECT user_id FROM public.attachments
    ) refs LEFT JOIN public.profiles p ON p.user_id=refs.user_id WHERE p.user_id IS NULL`,
  };
  for (const [name, sql] of Object.entries(relationQueries)) {
    const result = await client.query(sql);
    report.relationChecks[name] = result.rows[0].count;
    if (result.rows[0].count !== 0) throw new Error(`Unexpected orphan rows: ${name}`);
  }

  await client.query("COMMIT");
  console.log(JSON.stringify(report));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
