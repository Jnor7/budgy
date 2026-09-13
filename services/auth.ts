import { authClient } from "@/lib/auth/client";

export async function signIn(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}

export async function signUp(email: string, password: string, username: string) {
  return authClient.signUp.email({ email, password, name: username });
}

export async function requestPasswordReset(email: string) {
  return authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/auth/reset-password` });
}

export async function signOut() {
  return authClient.signOut();
}

/** Une inscription peut ouvrir une session immédiatement ou attendre la confirmation e-mail. */
export function resolvePostSignup(session: unknown): "onboarding" | "confirm-email" {
  return session ? "onboarding" : "confirm-email";
}
