import { z } from "zod";
import { BankingError } from "@/lib/banking/errors";
import { bankConfig, bankingRepository, bankingService, bankingSessionEmail, errorResponse, json, parse, verifyMutation } from "@/lib/banking/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ action: string }> };

const filters = z.object({
  account: z.uuid().optional(),
  q: z.string().trim().max(160).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  category: z.string().max(80).optional(),
  direction: z.enum(["income", "expense"]).optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});
const connection = z.object({ id: z.uuid() });

export async function GET(request: Request, context: Context) {
  try {
    const { action } = await context.params;
    const configured = !!bankConfig();
    if (!configured && action === "overview") return json({ configured, connections: [], accounts: [] });
    if (!configured && action === "transactions") return json({ transactions: [], accounts: [], categories: [], hasMore: false });
    const repo = await bankingRepository(request);
    switch (action) {
      case "overview": return json({ configured, ...await repo.overview("bridge") });
      case "institutions": return json(await bankingService(repo).institutions());
      case "transactions": return json(await repo.transactions(parse(filters, Object.fromEntries(new URL(request.url).searchParams))));
      default: throw new BankingError("missing", 404);
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    verifyMutation(request);
    const { action } = await context.params;
    const data: unknown = await request.json().catch(() => null);
    const repo = await bankingRepository(request);
    switch (action) {
      case "connect": {
        const { institutionId } = parse(z.object({ institutionId: z.string().min(1).max(200) }), data);
        const service = bankingService(repo);
        return json({ link: await service.connect(institutionId, await bankingSessionEmail()) });
      }
      case "sync":
        await bankingService(repo).sync(parse(connection, data).id);
        return json({ ok: true });
      case "disconnect":
        await bankingService(repo).disconnect(parse(connection, data).id);
        return json({ ok: true });
      case "category": {
        const { id, category } = parse(connection.extend({ category: z.string().trim().max(80).nullable() }), data);
        await repo.setCategory(id, category || null);
        return json({ ok: true });
      }
      case "budget": {
        const { id, budgetId } = parse(connection.extend({ budgetId: z.uuid().optional() }), data);
        return json({ budgetId: await repo.linkBudget(id, budgetId) });
      }
      default: throw new BankingError("missing", 404);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
