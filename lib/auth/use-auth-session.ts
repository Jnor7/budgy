"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { usesNeon } from "@/lib/neon/config";

export type AuthSessionState =
  | { status: "loading"; userId: null }
  | { status: "authenticated"; userId: string }
  | { status: "anonymous"; userId: null }
  // La vérification a échoué (réseau, 5xx) : la session n'est ni confirmée ni rejetée.
  | { status: "unreachable"; userId: null };

const localSession = (): AuthSessionState => ({ status: "anonymous", userId: null });

/**
 * État de session côté client. Il distingue « en cours de vérification » (écran de chargement),
 * « déconnecté » (seul cas qui montre /auth) et « injoignable » (nouvel essai avec backoff, sans
 * jamais déconnecter). Better Auth revalide aussi au retour sur l'onglet.
 */
function useNeonAuthSession(): AuthSessionState {
  const session = authClient.useSession();
  const { data, isPending, error, refetch } = session;
  const userId = data?.user?.id ?? null;
  const unreachable = !userId && !isPending && Boolean(error) && (error as { status?: number }).status !== 401;

  useEffect(() => {
    if (!unreachable) return;
    let attempt = 0;
    let timer: number | undefined;
    const retry = () => {
      attempt += 1;
      void refetch();
      timer = window.setTimeout(retry, Math.min(30_000, 1_000 * 2 ** attempt));
    };
    timer = window.setTimeout(retry, 1_000);
    const onOnline = () => void refetch();
    window.addEventListener("online", onOnline);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener("online", onOnline); };
  }, [refetch, unreachable]);

  if (userId) return { status: "authenticated", userId };
  if (isPending) return { status: "loading", userId: null };
  if (unreachable) return { status: "unreachable", userId: null };
  return { status: "anonymous", userId: null };
}

export const useAuthSession: () => AuthSessionState = usesNeon ? useNeonAuthSession : localSession;
