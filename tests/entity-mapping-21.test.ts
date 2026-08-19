import { describe, expect, it } from "vitest";
import { camelToSnake, toDatabaseRow } from "@/lib/data/entity-map";
import { archiveEntitySchemas, type ArchiveDataKey } from "@/schemas/migration";
import type { AppEntity } from "@/types/domain";

const id = "11111111-1111-4111-8111-111111111111";
const parentId = "22222222-2222-4222-8222-222222222222";
const meta = { id, userId: parentId, legacyId: "legacy_1" };
const date = "2026-01-02T12:00:00Z";
const day = "2026-01-02";

const samples: Record<ArchiveDataKey, Record<string, unknown>> = {
  tenants: { ...meta, name: "Locataire", monthlyRent: 700, dueDay: 5, note: "", createdAt: date },
  rentPayments: { ...meta, tenantId: parentId, month: 1, year: 2026, isPaid: false, paidDate: undefined, amountDue: 700, amountReceived: 0, carryOver: 0, note: "" },
  tenantDebts: { ...meta, tenantId: parentId, label: "Dette", amount: 50, month: 1, year: 2026, isPaid: false, createdAt: date },
  dubaiParts: { ...meta, name: "Moyeu", category: "Auto", quantityBought: 2, quantitySold: 1, purchasePriceAED: 150, targetSalePriceAED: 300, note: "", createdAt: date, cashWithdrawnAED: 0 },
  dubaiSales: { ...meta, partId: parentId, quantity: 1, unitSalePriceAED: 300, currency: "AED", date: day, customerName: "", note: "" },
  dubaiExpenses: { ...meta, partId: parentId, title: "Transport", amountAED: 60, currency: "EUR", date: day, category: "Transport", note: "" },
  dubaiCashMovements: { ...meta, title: "Retrait", amount: 10, currency: "AED", date: day, type: "withdrawal", category: "Cash", note: "", status: "done" },
  businesses: { ...meta, name: "Studio", type: "Services", template: "simple", icon: "briefcase", colorHex: "#fff", note: "", isActive: true, createdAt: date, moduleClients: true, moduleSuppliers: false, moduleStock: false, modulePurchases: false, moduleSales: true, moduleReservations: false, moduleServices: true, moduleTasks: true, modulePayments: true, moduleDocuments: false, moduleKPI: true },
  businessContacts: { ...meta, businessId: parentId, name: "Client", role: "Client", phone: "", email: "", note: "" },
  businessItems: { ...meta, businessId: parentId, title: "Article", kind: "stock", sku: "", quantity: 1, purchasePrice: 10, salePrice: 20, isActive: true, note: "" },
  businessTransactions: { ...meta, businessId: parentId, title: "Vente", type: "revenu", amount: 20, category: "Vente", date: day, note: "" },
  businessBookings: { ...meta, businessId: parentId, title: "RDV", customerName: "Client", startDate: day, endDate: day, price: 20, status: "reserve", note: "" },
  businessTasks: { ...meta, businessId: parentId, title: "Appeler", dueDate: day, isDone: false, priority: "moyenne", note: "" },
  budgetEntries: { ...meta, title: "Salaire", amount: 100, type: "revenu", category: "Salaire", bucket: "Fixe", scope: "Perso", date: day, note: "", potentialAmount: 0, status: "recu" },
  subscriptions: { ...meta, title: "Cloud", amount: 10, dueDay: 5, category: "Abonnement", systemImage: "cloud", colorHex: "#fff", scope: "Perso", isActive: true, note: "" },
  trips: { ...meta, title: "Rome", destinationSummary: "Italie", startDate: day, endDate: day, peopleCount: 2, targetBudget: 1000, notes: "", isCompleted: false, createdAt: date, coverImageUrl: "" },
  flights: { ...meta, tripId: parentId, airline: "Air", fromCode: "CDG", toCode: "FCO", departDate: date, arriveDate: date, price: 100, bookingLink: "", attachmentNote: "", status: "reserve" },
  accommodations: { ...meta, tripId: parentId, name: "Hotel", city: "Rome", startDate: day, endDate: day, price: 200, bookingLink: "", attachmentNote: "", status: "reserve" },
  tripActivities: { ...meta, tripId: parentId, title: "Musée", city: "Rome", activityDate: date, price: 20, link: "", status: "a_prevoir", note: "" },
  tripChecklistItems: { ...meta, tripId: parentId, title: "Passeport", category: "Documents", isDone: false, assignedTo: parentId },
  attachments: { ...meta, fileName: "facture.pdf", mimeType: "application/pdf", storagePath: "attachments/facture.pdf", sizeBytes: 42, createdAt: date, dubaiPartId: parentId },
};

describe("mapping exhaustif des 21 entités historiques", () => {
  it("valide chaque type et mappe chaque propriété vers sa colonne PostgreSQL", () => {
    expect(Object.keys(samples)).toHaveLength(21);
    for (const [key, sample] of Object.entries(samples) as [ArchiveDataKey, Record<string, unknown>][]) {
      const result = archiveEntitySchemas[key].safeParse(sample);
      expect(result.success, `${key}: ${result.success ? "" : result.error.message}`).toBe(true);
      if (!result.success) continue;
      const row = toDatabaseRow(result.data as AppEntity);
      for (const [property, value] of Object.entries(result.data)) {
        if (value === undefined) continue;
        expect(row, `${key}.${property}`).toHaveProperty(camelToSnake(property), value);
      }
    }
  });
});
