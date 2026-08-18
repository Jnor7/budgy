import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyData } from "@/lib/data/seed";
import { entityKeys, entityTables, fromDatabaseRow, toDatabasePayload, toDatabaseRow } from "@/lib/data/entity-map";
import type { Database } from "@/types/database";
import type { AppData, AppDataKey, AppEntity } from "@/types/domain";

export interface RemoteImportResult { inserted: number; skipped: number; batchId?: string; alreadyImported: boolean; }

export class SupabaseRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadAll(): Promise<AppData> {
    const output = structuredClone(emptyData);
    const results = await Promise.all(entityKeys.map(async (key) => {
      const { data, error } = await this.client.from(entityTables[key]).select("*");
      if (error) throw error;
      return [key, (data ?? []).map((row) => fromDatabaseRow(row as Record<string, unknown>))] as const;
    }));
    for (const [key, rows] of results) (output[key] as AppEntity[]).push(...rows);
    return output;
  }

  async insert(key: AppDataKey, entity: AppEntity) {
    const { error } = await this.client.from(entityTables[key]).insert(toDatabaseRow(entity));
    if (error) throw error;
  }

  async update(key: AppDataKey, id: string, patch: Partial<AppEntity>) {
    const { error } = await this.client.from(entityTables[key]).update(toDatabaseRow(patch as AppEntity)).eq("id", id);
    if (error) throw error;
  }

  async remove(key: AppDataKey, id: string) {
    const { error } = await this.client.from(entityTables[key]).delete().eq("id", id);
    if (error) throw error;
  }

  async importArchive(data: AppData, checksum: string): Promise<RemoteImportResult> {
    const { data: result, error } = await this.client.rpc("import_budgy_archive", {
      p_payload: toDatabasePayload(data),
      p_format_version: 1,
      p_checksum: checksum,
    });
    if (error) throw error;
    const report = (result ?? {}) as Record<string, unknown>;
    return {
      inserted: Number(report.inserted ?? 0),
      skipped: Number(report.skipped ?? 0),
      batchId: typeof report.batch_id === "string" ? report.batch_id : undefined,
      alreadyImported: report.already_imported === true,
    };
  }
}
