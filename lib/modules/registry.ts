import { BriefcaseBusiness, Building2, CircleDollarSign, Plane, RefreshCcw, type LucideIcon } from "lucide-react";
import type { AppData, BusinessTemplate, ModuleKey, UserModule } from "@/types/domain";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  tone: "purple" | "green" | "cyan" | "orange";
  /** Route principale du module dans la barre de navigation. */
  href: string;
  /** Ordre d'apparition dans la tab bar (plus petit = plus à gauche). */
  navOrder: number;
  /** Le module apparaît-il dans la navigation basse ? */
  inNav: boolean;
}

export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  {
    key: "budget",
    label: "Budget personnel",
    tagline: "Revenus, dépenses, prévisions et suivi mensuel.",
    description: "Le cœur de Budgy : transactions réalisées et potentielles, catégories et soldes.",
    icon: CircleDollarSign,
    tone: "purple",
    href: "/budget",
    navOrder: 20,
    inNav: true,
  },
  {
    key: "subscriptions",
    label: "Abonnements",
    tagline: "Suivez vos paiements récurrents.",
    description: "Prélèvements mensuels, prochaine échéance et abonnements en pause.",
    icon: RefreshCcw,
    tone: "orange",
    href: "/subscriptions",
    navOrder: 40,
    inNav: false,
  },
  {
    key: "trips",
    label: "Voyages",
    tagline: "Organisez vos voyages, budgets, vols, logements et activités.",
    description: "Voyages collaboratifs avec check-list partagée et dépenses en commun.",
    icon: Plane,
    tone: "cyan",
    href: "/trips",
    navOrder: 30,
    inNav: true,
  },
  {
    key: "rentals",
    label: "Gestion locative",
    tagline: "Gérez vos locataires, loyers, paiements et impayés.",
    description: "Reports de dette, versements partiels et suivi mensuel par locataire.",
    icon: Building2,
    tone: "green",
    href: "/rentals",
    navOrder: 25,
    inNav: false,
  },
  {
    key: "businesses",
    label: "Business",
    tagline: "Gérez une ou plusieurs activités professionnelles.",
    description: "Templates métier, stock, ventes, tâches et indicateurs.",
    icon: BriefcaseBusiness,
    tone: "purple",
    href: "/business",
    navOrder: 10,
    inNav: true,
  },
] as const;

export const MODULE_KEYS = MODULE_DEFINITIONS.map((item) => item.key);
export const moduleDefinition = (key: ModuleKey) =>
  MODULE_DEFINITIONS.find((item) => item.key === key) ?? MODULE_DEFINITIONS[0]!;

/** Modules réellement actifs à partir des lignes `user_modules`. */
export function enabledModuleKeys(modules: UserModule[]): ModuleKey[] {
  const fallback = new Map(MODULE_KEYS.map((key, index) => [key, index]));
  return modules
    .filter((item) => item.enabled)
    .sort((a, b) => (a.sortOrder ?? fallback.get(a.moduleKey) ?? 99) - (b.sortOrder ?? fallback.get(b.moduleKey) ?? 99))
    .map((item) => item.moduleKey);
}

export const isModuleEnabled = (modules: UserModule[], key: ModuleKey) =>
  modules.some((item) => item.moduleKey === key && item.enabled);

/** La barre mobile garde une hiérarchie stable : Accueil + 3 modules + Plus. */
export const primaryNavigationModules = (modules: ModuleKey[]) => modules.slice(0, 3);

/** Un compte n'a jamais choisi ses modules : aucune ligne `user_modules`. */
export const hasConfiguredModules = (modules: UserModule[]) => modules.length > 0;

/**
 * Suggestion de configuration pour un compte V1 qui découvre la V2 (§67).
 * Basée uniquement sur les données réellement présentes, jamais sur un pseudo.
 */
export function modulesForHistoricalData(data: AppData): ModuleKey[] {
  const suggestions: ModuleKey[] = [];
  if (data.budgetEntries.length > 0) suggestions.push("budget");
  if (data.subscriptions.length > 0) suggestions.push("subscriptions");
  if (data.trips.length > 0 || data.flights.length > 0 || data.accommodations.length > 0 || data.tripActivities.length > 0 || data.tripChecklistItems.length > 0) suggestions.push("trips");
  if (data.tenants.length > 0 || data.rentPayments.length > 0 || data.tenantDebts.length > 0) suggestions.push("rentals");
  if (
    data.businesses.length > 0 || data.businessContacts.length > 0 || data.businessItems.length > 0 ||
    data.businessTransactions.length > 0 || data.businessBookings.length > 0 || data.businessTasks.length > 0 ||
    data.dubaiParts.length > 0 || data.dubaiSales.length > 0 || data.dubaiExpenses.length > 0 || data.dubaiCashMovements.length > 0
  ) suggestions.push("businesses");
  return suggestions;
}

export function suggestedModules(data: AppData): ModuleKey[] {
  const suggestions = modulesForHistoricalData(data);
  return suggestions.length > 0 ? suggestions : ["budget"];
}

// --- Templates business -----------------------------------------------------

export interface BusinessTemplateDefinition {
  key: BusinessTemplate;
  label: string;
  description: string;
  /** Flags `module*` pré-cochés à la création. */
  defaults: Partial<Record<BusinessFeature, boolean>>;
}

export type BusinessFeature =
  | "moduleClients" | "moduleSuppliers" | "moduleStock" | "modulePurchases"
  | "moduleSales" | "moduleReservations" | "moduleServices" | "moduleTasks"
  | "modulePayments" | "moduleDocuments" | "moduleKPI";

export const BUSINESS_FEATURES: { key: BusinessFeature; label: string }[] = [
  { key: "moduleClients", label: "Clients" },
  { key: "moduleSuppliers", label: "Fournisseurs" },
  { key: "moduleStock", label: "Stock" },
  { key: "modulePurchases", label: "Achats" },
  { key: "moduleSales", label: "Ventes" },
  { key: "moduleReservations", label: "Réservations" },
  { key: "moduleServices", label: "Services" },
  { key: "moduleTasks", label: "Tâches" },
  { key: "modulePayments", label: "Paiements" },
  { key: "moduleDocuments", label: "Documents" },
  { key: "moduleKPI", label: "KPI" },
];

export const BUSINESS_TEMPLATES: readonly BusinessTemplateDefinition[] = [
  {
    key: "simple",
    label: "Business simple",
    description: "Revenus, dépenses et tâches. Le strict nécessaire.",
    defaults: { moduleClients: true, modulePayments: true, moduleTasks: true, moduleKPI: true },
  },
  {
    key: "commerce",
    label: "Commerce / Stock",
    description: "Articles, achats, ventes et niveaux de stock.",
    defaults: {
      moduleClients: true, moduleSuppliers: true, moduleStock: true,
      modulePurchases: true, moduleSales: true, modulePayments: true, moduleKPI: true,
    },
  },
  {
    key: "services",
    label: "Services",
    description: "Prestations, clients et suivi des tâches.",
    defaults: {
      moduleClients: true, moduleServices: true, moduleTasks: true,
      modulePayments: true, moduleDocuments: true, moduleKPI: true,
    },
  },
  {
    key: "rental",
    label: "Location / Réservation",
    description: "Réservations datées, clients et paiements.",
    defaults: {
      moduleClients: true, moduleReservations: true, modulePayments: true,
      moduleTasks: true, moduleKPI: true,
    },
  },
  {
    key: "import_export",
    label: "Import / Export",
    description: "Stock multi-devises, marges, coûts, cash et potentiel. Le modèle le plus complet.",
    defaults: {
      moduleClients: true, moduleSuppliers: true, moduleStock: true, modulePurchases: true,
      moduleSales: true, modulePayments: true, moduleDocuments: true, moduleKPI: true,
    },
  },
] as const;

export const businessTemplate = (key: BusinessTemplate) =>
  BUSINESS_TEMPLATES.find((item) => item.key === key) ?? BUSINESS_TEMPLATES[0]!;

/** Le template Import/Export débloque les écrans avancés (ex-Business Dubaï). */
export const hasAdvancedTrading = (template: BusinessTemplate) => template === "import_export";
