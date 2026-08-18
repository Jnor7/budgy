import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyData } from "@/lib/data/seed";
import { entityKeys, entityTables, fromDatabaseRow, toDatabasePayload, toDatabaseRow } from "@/lib/data/entity-map";
import { MODULE_KEYS } from "@/lib/modules/registry";
import type { Database, Json } from "@/types/database";
import type { AppData, AppDataKey, AppEntity, DirectoryProfile, ModuleKey, Profile, UserPreferences } from "@/types/domain";

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

  // --- V2 -------------------------------------------------------------------

  /** Remplace la configuration de modules de l'utilisateur en une passe. */
  async setModules(userId: string, keys: ModuleKey[]) {
    const rows = MODULE_KEYS.map((moduleKey) => ({
      user_id: userId,
      module_key: moduleKey,
      enabled: keys.includes(moduleKey),
    }));
    const { error } = await this.client.from("user_modules").upsert(rows, { onConflict: "user_id,module_key" });
    if (error) throw error;
    const { error: profileError } = await this.client
      .from("profiles")
      .update({ modules_configured_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (profileError) throw profileError;
  }

  async loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.client.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? (fromDatabaseRow(data as Record<string, unknown>) as unknown as Profile) : null;
  }

  async updateProfile(userId: string, patch: Partial<Profile>) {
    const row: Record<string, Json> = {};
    if (patch.username !== undefined) row.username = patch.username;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    const { error } = await this.client.from("profiles").update(row).eq("user_id", userId);
    if (error) throw error;
  }

  async updatePreferences(userId: string, patch: Partial<UserPreferences>) {
    const row: Record<string, Json> = {};
    if (patch.mainCurrency !== undefined) row.main_currency = patch.mainCurrency;
    if (patch.businessCurrency !== undefined) row.business_currency = patch.businessCurrency;
    if (patch.dubaiDisplayCurrency !== undefined) row.dubai_display_currency = patch.dubaiDisplayCurrency;
    if (patch.compactAmounts !== undefined) row.compact_amounts = patch.compactAmounts;
    const { error } = await this.client.from("user_preferences").upsert({ user_id: userId, ...row });
    if (error) throw error;
  }

  /** Annuaire des co-voyageurs. La policy RLS limite déjà le périmètre visible. */
  async loadDirectory(): Promise<DirectoryProfile[]> {
    const { data, error } = await this.client.from("profiles").select("user_id,username,avatar_url");
    if (error) throw error;
    return (data ?? []).map((row) => {
      const record = row as Record<string, unknown>;
      return {
        userId: String(record.user_id ?? ""),
        username: String(record.username ?? ""),
        avatarUrl: String(record.avatar_url ?? ""),
      };
    });
  }

  async findUser(handle: string): Promise<DirectoryProfile | null> {
    const { data, error } = await this.client.rpc("find_budgy_user", { p_handle: handle });
    if (error) throw error;
    const first = (data ?? [])[0];
    return first ? { userId: first.user_id, username: first.username, avatarUrl: first.avatar_url } : null;
  }

  async inviteToTrip(tripId: string, options: { handle?: string; email?: string; role?: "editor" | "viewer" }) {
    const { data, error } = await this.client.rpc("invite_to_trip", {
      p_trip_id: tripId,
      p_handle: options.handle ?? null,
      p_email: options.email ?? null,
      p_role: options.role ?? "editor",
    });
    if (error) throw error;
    return (data ?? {}) as Record<string, unknown>;
  }

  async respondInvitation(invitationId: string, accept: boolean) {
    const { data, error } = await this.client.rpc("respond_trip_invitation", {
      p_invitation_id: invitationId,
      p_accept: accept,
    });
    if (error) throw error;
    return (data ?? {}) as Record<string, unknown>;
  }

  async markNotificationRead(id: string) {
    const { error } = await this.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
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
