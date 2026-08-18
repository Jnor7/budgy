import { describe, expect, it } from "vitest";
import { fromDatabaseRow, toDatabasePayload, toDatabaseRow } from "@/lib/data/entity-map";
import { emptyData, LOCAL_USER_ID } from "@/lib/data/seed";
import type { BudgetEntry } from "@/types/domain";

const entry: BudgetEntry = {
  id:"5b3ea488-e4f9-4879-a60d-2ae14262339a",userId:LOCAL_USER_ID,title:"Loyer",amount:850,
  type:"depense",category:"Logement",bucket:"Charge fixe",scope:"Perso",date:"2026-08-05",
  note:"",potentialAmount:0,status:"non",
};

describe("mapping Supabase", () => {
  it("convertit les propriétés métier en colonnes snake_case", () => {
    const row = toDatabaseRow(entry);
    expect(row.user_id).toBe(LOCAL_USER_ID);
    expect(row.potential_amount).toBe(0);
    expect(row).not.toHaveProperty("userId");
  });

  it("restaure les nombres numeric renvoyés comme chaînes", () => {
    const entity = fromDatabaseRow({...toDatabaseRow(entry),amount:"850.00"});
    expect(entity).toMatchObject({userId:LOCAL_USER_ID,amount:850,potentialAmount:0});
  });

  it("produit les 21 collections attendues par l’import distant", () => {
    const payload = toDatabasePayload({...structuredClone(emptyData),budgetEntries:[entry]});
    expect(Object.keys(payload)).toHaveLength(21);
    expect(payload.budget_entries).toHaveLength(1);
  });
});
