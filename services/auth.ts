import { authClient } from "@/lib/auth/client";

const authError = (reason: unknown) => reason instanceof Error ? reason : new Error("Service d'authentification indisponible.");
async function safeAuthCall<T>(operation: () => Promise<T>): Promise<T | { data: null; error: Error }> {
  try { return await operation(); }
  catch (reason) { return { data: null, error: authError(reason) }; }
}

export async function signIn(email: string, password: string) {
  return safeAuthCall(() => authClient.signIn.email({ email, password }));
}

export async function signUp(email: string, password: string, username: string) {
  return safeAuthCall(() => authClient.signUp.email({ email, password, name: username }));
}

export async function requestPasswordReset(email: string) {
  return safeAuthCall(() => authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/auth/reset-password` }));
}

export async function signOut() {
  const result = await authClient.signOut();

  if (result.error) {
    throw new Error(result.error.message ?? "Impossible de fermer la session.");
  }

  return result;
}

/** Une inscription peut ouvrir une session immédiatement ou attendre la confirmation e-mail. */
export function resolvePostSignup(session: unknown): "onboarding" | "confirm-email" {
  return session ? "onboarding" : "confirm-email";
}


