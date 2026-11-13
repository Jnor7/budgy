import { z } from "zod";
import { BankingError } from "@/lib/banking/errors";
import { bankingRepository, bankingService, callbackRedirect, parse } from "@/lib/banking/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const state = parse(z.string().regex(/^[a-f0-9]{64}$/), params.get("state") ?? params.get("context"));
    if (params.has("state") && params.has("context") && params.get("context") !== state) {
      throw new BankingError("invalid", 400);
    }
    const result = parse(z.object({
      user_uuid: z.uuid(), item_id: z.string().regex(/^[1-9]\d{0,15}$/).optional(),
      success: z.enum(["true", "false"]).optional(), step: z.string().max(80).optional(),
    }), Object.fromEntries(params));
    const repo = await bankingRepository(request);
    await bankingService(repo).callback(state, {
      userId: result.user_uuid, connectionId: result.item_id,
      success: result.success === undefined ? undefined : result.success === "true", step: result.step,
    });
    return callbackRedirect("connected");
  } catch (error) {
    return callbackRedirect(error instanceof BankingError ? error.code : "unavailable");
  }
}
