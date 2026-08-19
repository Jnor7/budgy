import { z } from "zod";
import type { AppDataKey } from "@/types/domain";

export const migrationManifestSchema = z.object({
  format: z.literal("budget-jr-export"),
  version: z.number().int().min(1).max(1),
  exportedAt: z.string().optional(),
  entities: z.array(z.object({ key: z.string(), file: z.string(), count: z.number().int().nonnegative() })).optional(),
}).passthrough();

export type MigrationManifest = z.infer<typeof migrationManifestSchema>;
export type ArchiveDataKey = Exclude<AppDataKey, "userModules" | "tripMembers" | "tripInvitations" | "notifications" | "tripExpenses" | "tripExpenseSplits">;

const text = z.string();
const nonEmptyText = z.string().min(1);
const number = z.number().finite();
const money = number.nonnegative();
const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();
const day = z.number().int().min(1).max(31);
const month = z.number().int().min(1).max(12);
const date = nonEmptyText;
const currency = z.enum(["AED", "EUR", "FCFA", "USD"]);
const nullableDate = date.nullish().transform((value) => value ?? undefined);
const meta = { id: z.string().uuid(), userId: z.string().uuid(), legacyId: nonEmptyText };
const strictEntity = <T extends z.ZodRawShape>(shape: T) => z.object({ ...meta, ...shape }).strict();

/** Contrat exhaustif des 21 entités Budget JR v1 après normalisation. */
export const archiveEntitySchemas = {
  tenants: strictEntity({ name: nonEmptyText, monthlyRent: money, dueDay: day, note: text, createdAt: date }),
  rentPayments: strictEntity({ tenantId: z.string().uuid(), month, year: z.number().int(), isPaid: z.boolean(), paidDate: nullableDate, amountDue: money, amountReceived: money, carryOver: number, note: text }),
  tenantDebts: strictEntity({ tenantId: z.string().uuid(), label: nonEmptyText, amount: money, month, year: z.number().int(), isPaid: z.boolean(), createdAt: date }),
  dubaiParts: strictEntity({ name: nonEmptyText, category: nonEmptyText, quantityBought: nonNegativeInt, quantitySold: nonNegativeInt, purchasePriceAED: money, targetSalePriceAED: money, note: text, createdAt: date, cashWithdrawnAED: money }),
  dubaiSales: strictEntity({ partId: z.string().uuid(), quantity: positiveInt, unitSalePriceAED: money, currency, date, customerName: text, note: text }),
  dubaiExpenses: strictEntity({ partId: z.string().uuid().optional(), title: nonEmptyText, amountAED: money, currency, date, category: nonEmptyText, note: text }),
  dubaiCashMovements: strictEntity({ title: nonEmptyText, amount: money, currency, date, type: z.enum(["cash_in", "cash_out", "withdrawal"]), category: nonEmptyText, note: text, status: z.enum(["done", "planned"]) }),
  businesses: strictEntity({
    name: nonEmptyText, type: nonEmptyText, template: z.enum(["simple", "commerce", "services", "rental", "import_export"]).default("simple"), icon: text,
    colorHex: nonEmptyText, note: text, isActive: z.boolean(), createdAt: date, moduleClients: z.boolean(), moduleSuppliers: z.boolean(),
    moduleStock: z.boolean(), modulePurchases: z.boolean(), moduleSales: z.boolean(), moduleReservations: z.boolean(), moduleServices: z.boolean(),
    moduleTasks: z.boolean(), modulePayments: z.boolean(), moduleDocuments: z.boolean(), moduleKPI: z.boolean(),
  }),
  businessContacts: strictEntity({ businessId: z.string().uuid(), name: nonEmptyText, role: nonEmptyText, phone: text, email: text, note: text }),
  businessItems: strictEntity({ businessId: z.string().uuid(), title: nonEmptyText, kind: nonEmptyText, sku: text, quantity: nonNegativeInt, purchasePrice: money, salePrice: money, isActive: z.boolean(), note: text }),
  businessTransactions: strictEntity({ businessId: z.string().uuid(), title: nonEmptyText, type: z.enum(["revenu", "depense"]), amount: money, category: nonEmptyText, date, note: text }),
  businessBookings: strictEntity({ businessId: z.string().uuid(), title: nonEmptyText, customerName: text, startDate: date, endDate: date, price: money, status: nonEmptyText, note: text }),
  businessTasks: strictEntity({ businessId: z.string().uuid(), title: nonEmptyText, dueDate: date, isDone: z.boolean(), priority: z.enum(["basse", "moyenne", "haute"]), note: text }),
  budgetEntries: strictEntity({ title: nonEmptyText, amount: money, type: z.enum(["revenu", "depense"]), category: nonEmptyText, bucket: nonEmptyText, scope: nonEmptyText, date, note: text, potentialAmount: money, status: z.enum(["recu", "peu", "non"]) }),
  subscriptions: strictEntity({ title: nonEmptyText, amount: money, dueDay: day, category: nonEmptyText, systemImage: nonEmptyText, colorHex: nonEmptyText, scope: nonEmptyText, isActive: z.boolean(), note: text }),
  trips: strictEntity({ title: nonEmptyText, destinationSummary: nonEmptyText, startDate: date, endDate: date, peopleCount: positiveInt, targetBudget: money, notes: text, isCompleted: z.boolean(), createdAt: date, coverImageUrl: text.default("") }),
  flights: strictEntity({ tripId: z.string().uuid(), airline: nonEmptyText, fromCode: nonEmptyText, toCode: nonEmptyText, departDate: date, arriveDate: date, price: money, bookingLink: text, attachmentNote: text, status: nonEmptyText }),
  accommodations: strictEntity({ tripId: z.string().uuid(), name: nonEmptyText, city: nonEmptyText, startDate: date, endDate: date, price: money, bookingLink: text, attachmentNote: text, status: nonEmptyText }),
  tripActivities: strictEntity({ tripId: z.string().uuid(), title: nonEmptyText, city: text, activityDate: date, price: money, link: text, status: nonEmptyText, note: text }),
  tripChecklistItems: strictEntity({ tripId: z.string().uuid(), title: nonEmptyText, category: nonEmptyText, isDone: z.boolean(), assignedTo: z.string().uuid().optional() }),
  attachments: strictEntity({ fileName: nonEmptyText, mimeType: nonEmptyText, storagePath: nonEmptyText, sizeBytes: nonNegativeInt, createdAt: date, dubaiPartId: z.string().uuid().optional(), businessId: z.string().uuid().optional() }).refine(
    (value) => Number(Boolean(value.dubaiPartId)) + Number(Boolean(value.businessId)) === 1,
    { message: "une pièce jointe doit référencer exactement un DubaiPart ou un Business" },
  ),
} satisfies Record<ArchiveDataKey, z.ZodType>;

export const archiveEntityLabels: Record<ArchiveDataKey, string> = {
  tenants: "Tenant", rentPayments: "RentPayment", tenantDebts: "TenantDebt", dubaiParts: "DubaiPart", dubaiSales: "DubaiSale",
  dubaiExpenses: "DubaiExpense", dubaiCashMovements: "DubaiCashMovement", businesses: "Business", businessContacts: "BusinessContact",
  businessItems: "BusinessItem", businessTransactions: "BusinessTransaction", businessBookings: "BusinessBooking", businessTasks: "BusinessTask",
  budgetEntries: "BudgetEntry", subscriptions: "Subscription", trips: "Trip", flights: "Flight", accommodations: "Accommodation",
  tripActivities: "TripActivity", tripChecklistItems: "TripChecklistItem", attachments: "Attachment",
};
