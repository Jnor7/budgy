export type BudgyDataMode = "auto" | "local" | "supabase";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
export const supabasePublicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

// Backward-compatible alias used by the existing Supabase client helpers.
export const supabaseAnonKey = supabasePublicKey;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

const requestedMode = process.env.NEXT_PUBLIC_BUDGY_DATA_MODE?.trim().toLowerCase();
export const budgyDataMode: BudgyDataMode =
  requestedMode === "local" || requestedMode === "supabase" ? requestedMode : "auto";

export const usesSupabase = budgyDataMode !== "local" && isSupabaseConfigured;
export const hasInvalidSupabaseMode = budgyDataMode === "supabase" && !isSupabaseConfigured;
