import type { AppData } from "@/types/domain";

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
const now = new Date();
const iso = (monthOffset = 0, day = 5) => {
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 12);
  return date.toISOString();
};

export const emptyData: AppData = {
  tenants: [], rentPayments: [], tenantDebts: [], dubaiParts: [], dubaiSales: [],
  dubaiExpenses: [], dubaiCashMovements: [], businesses: [], businessContacts: [],
  businessItems: [], businessTransactions: [], businessBookings: [], businessTasks: [],
  budgetEntries: [], subscriptions: [], trips: [], flights: [], accommodations: [],
  tripActivities: [], tripChecklistItems: [], attachments: [],
  userModules: [], tripMembers: [], tripInvitations: [],
  notifications: [], tripExpenses: [], tripExpenseSplits: [],
  travelFriendRequests: [], travelFriends: [],
};

export const demoData: AppData = {
  ...emptyData,
  budgetEntries: [
    { id: "budget-1", userId: LOCAL_USER_ID, title: "Salaire", amount: 2700, potentialAmount: 0, type: "revenu", category: "Salaire", bucket: "Fixe", scope: "Perso", date: iso(0, 2), note: "", status: "recu" },
    { id: "budget-2", userId: LOCAL_USER_ID, title: "Loyer", amount: 850, potentialAmount: 0, type: "depense", category: "Logement", bucket: "Charge", scope: "Perso", date: iso(0, 5), note: "", status: "recu" },
    { id: "budget-3", userId: LOCAL_USER_ID, title: "Courses", amount: 240, potentialAmount: 300, type: "depense", category: "Alimentation", bucket: "Variable", scope: "Perso", date: iso(0, 12), note: "Prévision du mois", status: "non" },
    { id: "budget-4", userId: LOCAL_USER_ID, title: "Mission freelance", amount: 520, potentialAmount: 0, type: "revenu", category: "Business", bucket: "Variable", scope: "Perso", date: iso(0, 22), note: "", status: "non" },
  ],
  subscriptions: [
    { id: "sub-1", userId: LOCAL_USER_ID, title: "iCloud+", amount: 9.99, dueDay: 14, category: "Abonnement", systemImage: "cloud", colorHex: "#7B61FF", scope: "Perso", isActive: true, note: "" },
  ],
  tenants: [
    { id: "tenant-1", userId: LOCAL_USER_ID, name: "Appartement Centre", monthlyRent: 700, dueDay: 5, note: "", createdAt: iso(-5, 1) },
  ],
  rentPayments: [
    { id: "payment-1", userId: LOCAL_USER_ID, tenantId: "tenant-1", month: now.getMonth() + 1, year: now.getFullYear(), isPaid: false, amountDue: 700, amountReceived: 350, carryOver: 0, note: "Premier versement" },
  ],
  tenantDebts: [],
  dubaiParts: [
    { id: "part-1", userId: LOCAL_USER_ID, name: "Moyeu", category: "Pièces auto", quantityBought: 40, quantitySold: 29, purchasePriceAED: 37.5, targetSalePriceAED: 75, note: "", createdAt: iso(-2, 3), cashWithdrawnAED: 0 },
    { id: "part-2", userId: LOCAL_USER_ID, name: "Demi-arbres", category: "Pièces auto", quantityBought: 20, quantitySold: 14, purchasePriceAED: 37.5, targetSalePriceAED: 75, note: "", createdAt: iso(-2, 3), cashWithdrawnAED: 0 },
  ],
  dubaiSales: [
    { id: "sale-1", userId: LOCAL_USER_ID, partId: "part-1", quantity: 8, unitSalePriceAED: 75, currency: "AED", date: iso(-1, 10), customerName: "Client Kin", note: "" },
  ],
  dubaiExpenses: [
    { id: "expense-1", userId: LOCAL_USER_ID, title: "Transport", amountAED: 600, currency: "USD", date: iso(-1, 12), category: "Transport", note: "" },
  ],
  dubaiCashMovements: [
    { id: "cash-1", userId: LOCAL_USER_ID, title: "Décaissement terrain", amount: 400, currency: "EUR", date: iso(-1, 16), type: "withdrawal", category: "Retrait", note: "", status: "done" },
    { id: "cash-2", userId: LOCAL_USER_ID, title: "Vente attendue", amount: 1200, currency: "AED", date: iso(1, 8), type: "cash_in", category: "Vente", note: "", status: "planned" },
  ],
  businesses: [
    { id: "business-1", userId: LOCAL_USER_ID, name: "Studio Junior", type: "Services", template: "services", icon: "briefcase", colorHex: "#B24DFF", note: "", isActive: true, createdAt: iso(-8, 1), moduleClients: true, moduleSuppliers: false, moduleStock: false, modulePurchases: false, moduleSales: true, moduleReservations: true, moduleServices: true, moduleTasks: true, modulePayments: true, moduleDocuments: true, moduleKPI: true },
  ],
  businessContacts: [], businessItems: [], businessTransactions: [], businessBookings: [], businessTasks: [],
  trips: [
    { id: "trip-1", userId: LOCAL_USER_ID, title: "Istanbul", destinationSummary: "Turquie", startDate: iso(2, 14), endDate: iso(2, 19), peopleCount: 2, targetBudget: 1800, notes: "", isCompleted: false, createdAt: iso(-1, 1), coverImageUrl: "" },
  ],
  flights: [
    { id: "flight-1", userId: LOCAL_USER_ID, tripId: "trip-1", airline: "Transavia", fromCode: "CDG", toCode: "IST", departDate: iso(2, 14), arriveDate: iso(2, 14), price: 150, bookingLink: "", attachmentNote: "", status: "a_reserver" },
  ],
  accommodations: [
    { id: "stay-1", userId: LOCAL_USER_ID, tripId: "trip-1", name: "Hôtel Galata", city: "Istanbul", startDate: iso(2, 14), endDate: iso(2, 19), price: 620, bookingLink: "", attachmentNote: "", status: "reserve" },
  ],
  tripActivities: [
    { id: "activity-1", userId: LOCAL_USER_ID, tripId: "trip-1", title: "Croisière Bosphore", city: "Istanbul", activityDate: iso(2, 16), price: 45, link: "", status: "a_prevoir", note: "" },
  ],
  tripChecklistItems: [
    { id: "check-1", userId: LOCAL_USER_ID, tripId: "trip-1", title: "Passeport", category: "Documents", isDone: true },
    { id: "check-2", userId: LOCAL_USER_ID, tripId: "trip-1", title: "eSIM", category: "Pratique", isDone: false },
  ],
  attachments: [],
  userModules: (["budget","subscriptions","trips","rentals","businesses"] as const).map((moduleKey, index) => ({
    id: `module-${index + 1}`, userId: LOCAL_USER_ID, moduleKey, enabled: true,
    sortOrder: index,
    createdAt: iso(-8, 1), updatedAt: iso(-8, 1),
  })),
  tripMembers: [], tripInvitations: [], notifications: [], tripExpenses: [], tripExpenseSplits: [],
  travelFriendRequests: [], travelFriends: [],
};
