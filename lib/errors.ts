/**
 * Transforme une erreur Supabase (ou toute erreur) en message affichable.
 *
 * `PostgrestError` (et la plupart des erreurs Supabase) porte `message`, mais
 * la documentation du SDK est explicite : le champ le plus utile est souvent
 * `hint`, pas `message` — par exemple pour "No API key found in request", le
 * `hint` ("No `apikey` request header or url param was found.") est ce qui
 * permet réellement de diagnostiquer le problème. On duck-type plutôt que de
 * dépendre de `instanceof PostgrestError` : deux copies du module Supabase
 * dans l'arbre de dépendances casseraient un `instanceof` sur classe.
 */
export function describeSupabaseError(reason: unknown, fallback = "Une erreur inattendue est survenue."): string {
  if (!reason || typeof reason !== "object") {
    return typeof reason === "string" && reason.trim() ? reason : fallback;
  }

  const record = reason as Record<string, unknown>;
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : "";
  const hint = typeof record.hint === "string" && record.hint.trim() ? record.hint.trim() : "";
  const code = typeof record.code === "string" && record.code.trim() ? record.code.trim() : "";

  if (!message && !hint) return fallback;

  const parts = [message || fallback];
  if (hint && hint !== message) parts.push(hint);
  if (code) parts.push(`(code ${code})`);
  return parts.join(" — ");
}
