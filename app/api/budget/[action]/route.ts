import { z } from "zod";
import {
  budgetJson,
  budgetWorkflowRepository,
  verifyBudgetMutation,
} from "@/lib/budget-workflows/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { action } = await context.params;
    const repo = await budgetWorkflowRepository(request);
    const url = new URL(request.url);
    if (action === "envelopes") {
      const month =
        url.searchParams.get("month") ??
        new Date().toISOString().slice(0, 7) + "-01";
      if (!/^\d{4}-\d{2}-01$/.test(month))
        return budgetJson({ message: "Mois invalide" }, 400);
      return budgetJson(await repo.envelopes(month));
    }
    if (action === "details") {
      const entryId = z.uuid().parse(url.searchParams.get("entryId"));
      return budgetJson(await repo.details(entryId));
    }
    return budgetJson({ message: "Introuvable" }, 404);
  } catch (error) {
    return budgetJson(
      {
        message: error instanceof Error ? error.message : "Budget indisponible",
      },
      400,
    );
  }
}
export async function POST(request: Request, context: Context) {
  try {
    verifyBudgetMutation(request);
    const { action } = await context.params;
    const repo = await budgetWorkflowRepository(request);
    const json = await request.json();
    if (action === "report") {
      const body = z
        .object({
          entryId: z.uuid(),
          date: z.iso.date(),
          title: z.string().trim().max(160).optional(),
        })
        .parse(json);
      return budgetJson({ id: await repo.report(body) });
    }
    if (action === "detail") {
      const body = z
        .object({
          entryId: z.uuid(),
          name: z.string().trim().min(1).max(120),
          beneficiary: z.string().trim().max(120).optional(),
          plannedAmount: z.number().min(0).max(1000000),
        })
        .parse(json);
      return budgetJson({ id: await repo.addDetail(body) });
    }
    if (action === "remove-detail") {
      const body = z.object({ id: z.uuid() }).parse(json);
      await repo.removeDetail(body.id);
      return budgetJson({ ok: true });
    }
    return budgetJson({ message: "Introuvable" }, 404);
  } catch (error) {
    return budgetJson(
      {
        message: error instanceof Error ? error.message : "Budget indisponible",
      },
      400,
    );
  }
}
