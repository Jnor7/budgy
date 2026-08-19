import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(process.cwd(), "supabase/migrations");
const rpc = readFileSync(path.join(migrations, "202608190004_historical_import_mapping_modules.sql"), "utf8");
const indexes = readFileSync(path.join(migrations, "202608180003_indexes.sql"), "utf8");
const firstRpc = readFileSync(path.join(migrations, "202608180006_remote_import.sql"), "utf8");

describe("contrat SQL de l'import historique", () => {
  it("normalise les anciennes clés AED sans rendre les colonnes nullables", () => {
    expect(rpc).toContain("purchase_price_a_e_d");
    expect(rpc).toContain("purchase_price_aed");
    expect(rpc).toContain("target_sale_price_a_e_d");
    expect(rpc).toContain("unit_sale_price_a_e_d");
    expect(rpc).toContain("amount_a_e_d");
    expect(rpc).not.toMatch(/alter\s+table\s+public\.dubai_parts[\s\S]*drop\s+not\s+null/i);
  });

  it("active les modules depuis toutes les collections historiques concernées", () => {
    for (const token of [
      "dubai_parts", "dubai_sales", "dubai_expenses", "dubai_cash_movements", "businesses",
      "tenants", "rent_payments", "tenant_debts", "trips", "flights", "accommodations",
      "trip_activities", "trip_checklist_items", "budget_entries", "subscriptions",
    ]) expect(rpc).toContain(`p_payload -> '${token}'`);
    expect(rpc).toContain("on conflict (user_id, module_key) do update set enabled = true");
    expect(rpc).not.toMatch(/insert\s+into\s+public\.businesses/i);
  });

  it("un batch failed ne bloque pas le retry et une exception est relancée pour rollback", () => {
    expect(firstRpc).toContain("where checksum is not null and status = 'completed'");
    expect(rpc).toContain("checksum = p_checksum and status = 'completed'");
    expect(rpc).toMatch(/exception when others then[\s\S]*raise;/i);
  });

  it("les 21 tables historiques ont une unicité user_id + legacy_id", () => {
    const explicit = [...indexes.matchAll(/create unique index \w+ on public\.(\w+)\(user_id,legacy_id\)/g)].map((match) => match[1]);
    const dynamic = indexes.match(/array\[(.*?)\]\s+loop/s)?.[1]?.match(/'[^']+'/g)?.map((name) => name.slice(1, -1)) ?? [];
    expect(new Set([...explicit, ...dynamic]).size).toBe(21);
    expect(rpc).toContain("on conflict do nothing");
  });
});
