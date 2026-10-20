export type SessionProbe =
  | { kind: "anonymous" }
  | { kind: "authenticated" }
  // L'amont Neon Auth n'a pas répondu de façon exploitable (réseau, 5xx) : on
  // ne sait pas si la session est valide, on ne doit donc jamais déconnecter.
  | { kind: "unknown" };

export type AccessDecision = "allow" | "redirect_login" | "redirect_home";

/**
 * Décision pure d'accès : seule une session explicitement absente ou rejetée
 * renvoie vers /auth. Une erreur transitoire laisse passer, le client
 * (AuthSessionProvider) revérifie ensuite sans afficher de faux écran de login.
 */
export function decideAccess(probe: SessionProbe, isAuthPage: boolean): AccessDecision {
  if (probe.kind === "anonymous") return isAuthPage ? "allow" : "redirect_login";
  if (probe.kind === "authenticated") return isAuthPage ? "redirect_home" : "allow";
  return "allow";
}
