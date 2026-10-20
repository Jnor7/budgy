import { createHash } from "node:crypto";
import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neondatabase/auth/server";
import { auth } from "@/lib/auth/server";

type TokenResult =
  | { ok: true; token: string }
  | { ok: false; status: 401 | 503; reason: string };

interface CachedToken { token: string; expiresAt: number }

// JWT Data API par session : sans cache, chaque lecture/écriture déclenchait un aller-retour vers
// Neon Auth (/token) et, toutes les ~minutes, un échec ponctuel renvoyait 401 « Unauthorized »,
// vécu côté client comme une session perdue. La clé est un hash, jamais le jeton de session.
const cache = new Map<string, CachedToken>();
const MAX_ENTRIES = 500;
const SAFETY_MARGIN_MS = 60_000;
const MAX_TTL_MS = 5 * 60_000;

const sessionCookieValue = (cookieHeader: string) => {
  const escaped = NEON_AUTH_SESSION_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`).exec(cookieHeader)?.[1] ?? null;
};

const jwtExpiryMs = (token: string) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retourne le JWT pour le Data API. 401 seulement si Neon Auth déclare la session invalide ;
 * toute autre défaillance (réseau, 5xx, réponse vide) est un 503 réessayable : le client ne doit
 * jamais interpréter un incident transitoire comme une déconnexion.
 */
export async function getDataApiToken(cookieHeader: string, now = Date.now()): Promise<TokenResult> {
  const sessionValue = sessionCookieValue(cookieHeader);
  if (!sessionValue) return { ok: false, status: 401, reason: "no-session-cookie" };
  const key = createHash("sha256").update(sessionValue).digest("hex");

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return { ok: true, token: hit.token };
  cache.delete(key);

  let lastReason = "unknown";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(150 * attempt);
    try {
      const result = await auth.token();
      const token = (result.data as { token?: string } | null)?.token;
      if (token) {
        const expiry = jwtExpiryMs(token);
        const expiresAt = Math.min(expiry ? expiry - SAFETY_MARGIN_MS : now + MAX_TTL_MS, now + MAX_TTL_MS);
        if (expiresAt > now) {
          if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
          cache.set(key, { token, expiresAt });
        }
        return { ok: true, token };
      }
      const error = result.error as { status?: number; code?: string; message?: string } | null;
      lastReason = `status=${error?.status ?? "none"} code=${error?.code ?? "none"}`;
      // Session explicitement rejetée : inutile de réessayer.
      if (error?.status === 401 || error?.status === 403) {
        console.warn("[budgy-auth] token refused", lastReason);
        return { ok: false, status: 401, reason: lastReason };
      }
    } catch (reason) {
      lastReason = reason instanceof Error ? reason.message.slice(0, 120) : "exception";
    }
  }
  console.warn("[budgy-auth] token unavailable after retries", lastReason);
  return { ok: false, status: 503, reason: lastReason };
}

export const __resetTokenCacheForTests = () => cache.clear();
