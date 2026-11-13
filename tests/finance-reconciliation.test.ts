import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { envelopeProgress,treasuryHierarchy } from "@/lib/finance/calculations";

describe("finance reconciliation",()=>{
  it("keeps the bank snapshot separate from already-paid November movements",()=>{
    const result=treasuryHierarchy(8671.71+46.03,500+1320+2+2.25,1000,450);
    expect(result.realCash).toBe(8717.74);
    expect(result.committed).toBe(1824.25);
    expect(result.provisioned).toBe(1000);
    expect(result.freeCash).toBe(5893.49);
  });

  it("projects envelope consumption without changing the target",()=>{
    expect(envelopeProgress(120,60,.5)).toEqual({remaining:60,percent:50,projection:120});
  });

  it("ships an additive and tenant-scoped migration",()=>{
    const sql=readFileSync("supabase/migrations/20261113173942_finance_reconciliation_november_2026.sql","utf8").toLowerCase();
    expect(sql).toContain("budgy.finance_user_id");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
  });
});
