import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const missingClient = () => ({ error: new Error("Supabase n’est pas encore configuré.") });

export async function signIn(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return missingClient();
  return client.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string, username: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return missingClient();
  return client.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function requestPasswordReset(email: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return missingClient();
  return client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` });
}

export async function signOut() {
  return getSupabaseBrowserClient()?.auth.signOut();
}

/** Une inscription peut ouvrir une session immédiatement ou attendre la confirmation e-mail. */
export function resolvePostSignup(session: unknown): "onboarding" | "confirm-email" {
  return session ? "onboarding" : "confirm-email";
}
