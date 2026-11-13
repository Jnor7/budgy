import { bankingMessages } from "@/lib/banking/errors";

export async function bankingRequest<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/banking/${path}`, {
    cache: "no-store",
    ...(body && { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) throw new Error(data?.message || bankingMessages.unavailable);
  return data as T;
}

export const requestError = (error: unknown) => error instanceof Error ? error.message : bankingMessages.unavailable;
