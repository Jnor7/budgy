import { describe, expect, it } from "vitest";
import { mergeImportedData } from "@/features/migration/importer";
import { emptyData, LOCAL_USER_ID } from "@/lib/data/seed";

const imported = {
  id:"new-id",userId:LOCAL_USER_ID,legacyId:"swift-budget-1",title:"Salaire",amount:2700,
  type:"revenu" as const,category:"Salaire",bucket:"Rentrée",scope:"Perso",date:"2026-08-01",
  note:"",potentialAmount:0,status:"non" as const,
};

describe("migration idempotente", () => {
  it("ignore un legacy_id déjà présent", () => {
    const current = {...structuredClone(emptyData),budgetEntries:[{...imported,id:"existing-id"}]};
    const incoming = {...structuredClone(emptyData),budgetEntries:[imported]};
    const result = mergeImportedData(current,incoming);
    expect(result).toMatchObject({inserted:0,skipped:1});
    expect(result.data.budgetEntries).toHaveLength(1);
  });
});
