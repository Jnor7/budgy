/**
 * Résout l'état de disponibilité de l'import distant Supabase à partir de
 * trois signaux distincts, volontairement séparés pour ne jamais confondre
 * « Supabase est configuré » et « le repository distant est prêt » :
 *
 * - `localMode`        : configuration statique (URL + clé absentes, ou mode `local` forcé).
 * - `ready`             : le premier essai d'initialisation (locale ou Supabase) s'est terminé,
 *                          succès ou échec.
 * - `repositoryReady`   : un `SupabaseRepository` authentifié existe réellement.
 *
 * Cette fonction est pure et testable indépendamment de React et de Supabase.
 */
export type MigrationAvailability = "local" | "connecting" | "signed-out" | "ready";

export interface MigrationAvailabilityInput {
  localMode: boolean;
  ready: boolean;
  repositoryReady: boolean;
}

export function resolveMigrationAvailability(
  { localMode, ready, repositoryReady }: MigrationAvailabilityInput,
): MigrationAvailability {
  if (localMode) return "local";
  if (!ready) return "connecting";
  if (!repositoryReady) return "signed-out";
  return "ready";
}

export const MIGRATION_AVAILABILITY_MESSAGES: Record<MigrationAvailability, string> = {
  local: "L’import distant nécessite Supabase. Ce compte fonctionne en mode local : l’import restera sur cet appareil.",
  connecting: "Connexion à Supabase…",
  "signed-out": "Connectez-vous pour importer vos données.",
  ready: "",
};
