import { auth } from "@/lib/auth/server";

async function token() {
  const result = await auth.token();
  const data = result.data as { token?: string } | null;
  return data?.token ?? null;
}

export async function neonDataFetch(path: string, init?: RequestInit) {
  const baseUrl = process.env.NEON_DATA_API_URL?.replace(/\/$/, "");
  const accessToken = await token();
  if (!baseUrl || !accessToken) throw new Error("Neon session or Data API configuration missing.");
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}/${path}`, { ...init, headers, cache: "no-store" });
}

export async function getCurrentBudgyUserId() {
  const response = await neonDataFetch("rpc/current_budgy_user_id", { method: "POST", body: "{}" });
  if (!response.ok) throw new Error("Impossible de résoudre l'identité Budgy canonique.");
  const value = await response.json() as unknown;
  if (typeof value !== "string" || !value) throw new Error("Aucun UUID Budgy n'est associé à cette session.");
  return value;
}


