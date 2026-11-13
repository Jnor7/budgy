import "server-only";
import { z } from "zod";
import { getDataApiToken } from "@/lib/auth/data-token";
import { usesNeon } from "@/lib/neon/config";
import { BudgetWorkflowRepository } from "./repository";

export const budgetJson = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
export async function budgetWorkflowRepository(request: Request) {
  if (!usesNeon) throw new Error("Neon indisponible");
  const token = await getDataApiToken(request.headers.get("cookie") ?? "");
  if (!token.ok)
    throw new Error(
      token.status === 401 ? "Session expirée" : "Budget indisponible",
    );
  const base = process.env.NEON_DATA_API_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Budget indisponible");
  const response = await fetch(`${base}/rpc/current_budgy_user_id`, {
    method: "POST",
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      authorization: `Bearer ${token.token}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) throw new Error("Session expirée");
  const parsed = z.uuid().safeParse(await response.json());
  if (!parsed.success) throw new Error("Session expirée");
  return new BudgetWorkflowRepository(parsed.data);
}
export function verifyBudgetMutation(request: Request) {
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("Requête invalide");
}
