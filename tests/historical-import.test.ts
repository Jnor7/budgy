import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { archiveFiles, readBudgetJrArchive } from "@/features/migration/importer";
import { toDatabasePayload } from "@/lib/data/entity-map";

Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });

const asBrowserFile = (bytes: Uint8Array, name = "budget-jr-export.zip") => {
  const buffer = Uint8Array.from(bytes).buffer;
  const file = new File([buffer], name, { type: "application/zip" });
  Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(buffer) });
  return file;
};

async function archiveWithDubaiPart(part: Record<string, unknown>) {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({ format: "budget-jr-export", version: 1 }));
  for (const name of Object.keys(archiveFiles)) {
    zip.file(`data/${name}.json`, JSON.stringify(name === "dubai_parts" ? [part] : []));
  }
  return asBrowserFile(await zip.generateAsync({ type: "uint8array" }));
}

describe("validation pré-RPC de l'archive historique", () => {
  it("refuse un montant critique absent avec entité, nom et champ", async () => {
    const file = await archiveWithDubaiPart({
      legacy_id: "dubai_part_1", name: "Moteur Hiace 2L", category: "Pièces",
      quantityBought: 1, quantitySold: 0, targetSalePriceAED: 300,
      note: "", createdAt: "2026-01-01T00:00:00Z", cashWithdrawnAED: 0,
    });
    await expect(readBudgetJrArchive(file)).rejects.toThrow(
      'Import impossible :\nDubaiPart "Moteur Hiace 2L"\npurchasePriceAED est absent.',
    );
  });

  it("accepte aussi les noms snake_case AED sans perte", async () => {
    const file = await archiveWithDubaiPart({
      legacy_id: "dubai_part_1", name: "Moyeu", category: "Pièces",
      quantity_bought: 1, quantity_sold: 0, purchase_price_aed: 150, target_sale_price_aed: 300,
      note: "", created_at: "2026-01-01T00:00:00Z", cash_withdrawn_aed: 0,
    });
    const preview = await readBudgetJrArchive(file);
    expect(preview.data.dubaiParts[0]?.purchasePriceAED).toBe(150);
    expect(toDatabasePayload(preview.data).dubai_parts![0]?.purchase_price_aed).toBe(150);
  });
});

const realArchivePath = process.env.BUDGY_REAL_ARCHIVE;
describe.skipIf(!realArchivePath)("ZIP Budget JR réel", () => {
  it("parse les 21 fichiers et produit tous les montants Dubaï requis", async () => {
    const bytes = readFileSync(realArchivePath!);
    const preview = await readBudgetJrArchive(asBrowserFile(bytes));
    const payload = toDatabasePayload(preview.data);

    expect(Object.keys(payload)).toHaveLength(21);
    expect(preview.data.dubaiParts).toHaveLength(3);
    expect(preview.data.dubaiParts.map((part) => part.purchasePriceAED)).toEqual([150, 150, 30]);
    expect(payload.dubai_parts!.every((row) => row.purchase_price_aed !== null && row.purchase_price_aed !== undefined)).toBe(true);
    expect(payload.dubai_sales!.every((row) => row.unit_sale_price_aed !== null && row.unit_sale_price_aed !== undefined)).toBe(true);

    const partIds = new Set(preview.data.dubaiParts.map((part) => part.id));
    expect(preview.data.dubaiSales.every((sale) => partIds.has(sale.partId))).toBe(true);
    expect(preview.data.dubaiExpenses.every((expense) => !expense.partId || partIds.has(expense.partId))).toBe(true);
    expect(preview.data.attachments).toHaveLength(0);
  });
});
