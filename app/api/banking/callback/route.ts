import { z } from "zod";
import { BankingError } from "@/lib/banking/errors";
import { bankingRepository, bankingService, callbackRedirect, parse } from "@/lib/banking/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const state = parse(z.string().regex(/^[a-zA-Z0-9_-]{43}$/), params.get("state") ?? params.get("ref"));
    const repo = await bankingRepository(request);
    await bankingService(repo).callback(state, params.has("error"));
    return callbackRedirect("connected");
  } catch (error) {
    return callbackRedirect(error instanceof BankingError ? error.code : "unavailable");
  }
}
