export type BudgyDataMode = "auto" | "local" | "supabase";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
export const supabasePublicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

// Backward-compatible alias used by the existing Supabase client helpers.
export const supabaseAnonKey = supabasePublicKey;

/**
 * Une URL Supabase mal formée (schéma manquant, variable tronquée) ne fait
 * habituellement pas échouer `createBrowserClient` de façon visible : le client
 * se crée mais tous les appels réseau échouent en silence. On le détecte tôt
 * pour donner un diagnostic clair plutôt qu'un blocage muet. Jamais de log de
 * la clé elle-même, publique ou non.
 */
export const supabaseUrlLooksValid = Boolean(supabaseUrl && /^https?:\/\//i.test(supabaseUrl));

export const isSupabaseConfigured = Boolean(supabaseUrlLooksValid && supabasePublicKey);

const requestedMode = process.env.NEXT_PUBLIC_BUDGY_DATA_MODE?.trim().toLowerCase();
export const budgyDataMode: BudgyDataMode =
  requestedMode === "local" || requestedMode === "supabase" ? requestedMode : "auto";

export const usesSupabase = budgyDataMode !== "local" && isSupabaseConfigured;
export const hasInvalidSupabaseMode = budgyDataMode === "supabase" && !isSupabaseConfigured;

if (process.env.NODE_ENV !== "production" && budgyDataMode !== "local" && supabaseUrl && !supabaseUrlLooksValid) {
  console.warn("[budgy] NEXT_PUBLIC_SUPABASE_URL semble invalide (doit commencer par http:// ou https://).");
}
