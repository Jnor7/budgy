import "server-only";

import { z } from "zod";
import { getDataApiToken } from "@/lib/auth/data-token";
import { usesNeon } from "@/lib/neon/config";
import { BankingError, bankingMessages } from "./errors";
import { GoCardlessBankProvider } from "./gocardless";
import { BankingRepository } from "./repository";
import { BankingService } from "./service";

const redirectPath = "/api/banking/callback";
const headers = { "cache-control": "private, no-store", "referrer-policy": "no-referrer" };
const origin = z.url().transform((value) => new URL(value));
let provider: GoCardlessBankProvider | undefined;

export function bankConfig() {
  const id = process.env.GOCARDLESS_BANK_SECRET_ID?.trim();
  const key = process.env.GOCARDLESS_BANK_SECRET_KEY?.trim();
  const redirect = origin.safeParse(process.env.GOCARDLESS_BANK_REDIRECT_URL);
  if (!id || !key || !redirect.success || !process.env.DATABASE_URL || !usesNeon) return null;
  const url = redirect.data;
  const validProtocol = url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  if (!validProtocol || url.pathname !== redirectPath || url.search || url.hash || url.username || url.password) return null;
  provider ??= new GoCardlessBankProvider(id, key);
  return { provider, redirect: url };
}

export const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

export async function bankingRepository(request: Request) {
  if (!usesNeon) throw new BankingError("unconfigured", 503);
  const token = await getDataApiToken(request.headers.get("cookie") ?? "");
  if (!token.ok) throw new BankingError(token.status === 401 ? "session" : "unavailable", token.status);
  const baseUrl = process.env.NEON_DATA_API_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new BankingError("unavailable");
  const response = await fetch(`${baseUrl}/rpc/current_budgy_user_id`, {
    method: "POST", body: "{}", cache: "no-store", signal: AbortSignal.timeout(8_000),
    headers: { authorization: `Bearer ${token.token}`, "content-type": "application/json" },
  });
  if (!response.ok) throw new BankingError(response.status === 401 ? "session" : "unavailable", response.status === 401 ? 401 : 503);
  const result = z.uuid().safeParse(await response.json());
  if (!result.success) throw new BankingError("session", 401);
  return new BankingRepository(result.data);
}

export function bankingService(repo: BankingRepository) {
  const config = bankConfig();
  if (!config) throw new BankingError("unconfigured", 503);
  return new BankingService(repo, config.provider, config.redirect);
}

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BankingError("invalid", 400);
  return result.data;
}

export function errorResponse(error: unknown) {
  const code = error instanceof BankingError ? error.code : "unavailable";
  return json({ code, message: bankingMessages[code] }, error instanceof BankingError ? error.status : 503);
}

export function verifyMutation(request: Request) {
  // A cross-origin navigation may return from the bank only through the callback.
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
      request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    throw new BankingError("invalid", 403);
  }
}

export function callbackRedirect(result: string) {
  return new Response(null, {
    status: 303,
    headers: { ...headers, location: `/banking?result=${encodeURIComponent(result)}` },
  });
}
