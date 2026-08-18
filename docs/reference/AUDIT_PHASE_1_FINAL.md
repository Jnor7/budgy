# AUDIT PHASE 1 FINAL — Budget JR

Date d'audit : 18 août 2026  
Projet audité : `/Users/jr/Desktop/BUDGET JR/BUDGET JR`  
Objectif futur : préparer une migration PWA Next.js / TypeScript / Tailwind / Supabase / PostgreSQL / Vercel, sans commencer la PWA.

## 0. Synthèse exécutive

La version auditée est bien la version avancée de Budget JR :

- `ContentView.swift` contient 4 395 lignes.
- `FormViews.swift` contient 2 821 lignes.
- Le projet contient 16 fichiers Swift et 13 448 lignes Swift.
- Le projet contient 21 modèles SwiftData `@Model`.
- La vue Budget active est `BudgetView_Enhanced` dans `BudgetView.swift`.
- L'ancien `BudgetView` dans `ContentView.swift` est un bloc mort cohérent avec ses sous-composants internes.
- Le module Business Dubaï avancé est présent avec `DubaiSale`, `DubaiExpense`, `DubaiCashMovement`, `DubaiCurrencyConverter`, devises multiples, ventes réelles, mouvements d'argent et calculs prévisionnels.
- Aucun UUID métier portable n'est défini dans les modèles SwiftData. Les `id` utilisés par SwiftUI proviennent de l'identité SwiftData implicite, et ne doivent pas être utilisés comme identifiants de migration.
- Des `UUID()` existent hors modèles pour des structs UI non persistées (`Airport`, `AlertItem`), mais pas dans les modèles SwiftData.
- Les logs temporaires `[PERF]` sont présents dans `BUDGET_JRApp.swift`, `RootView`, `ContentView`, `AccueilView_Enhanced`, `BudgetView_Enhanced`, `BusinessHomeView`, `VoyagesView`.

Conclusion : l'audit Phase 1 est suffisant pour préparer une Phase 2 d'export sécurisé, à condition de ne pas s'appuyer sur les identifiants internes SwiftData et de prévoir un export structuré avec `legacy_id` générés au moment de l'export.

---

## 1. Inventaire exact des 21 modèles SwiftData

Source : `Models.swift`.

### 1. Tenant

Fichier : `Models.swift`, ligne approximative 4.

Propriétés :

| Propriété | Type Swift | Optional | Défaut | Notes |
|---|---:|---:|---|---|
| `name` | `String` | Non | requis init | Nom locataire |
| `monthlyRent` | `Double` | Non | requis init | Loyer mensuel |
| `dueDay` | `Int` | Non | requis init | Jour d'échéance |
| `note` | `String` | Non | `""` | Note |
| `createdAt` | `Date` | Non | `Date()` | Date création |
| `payments` | `[RentPayment]` | Non | `[]` | Relation cascade |
| `debts` | `[TenantDebt]` | Non | `[]` | Relation cascade |

Relations :

- `payments` : `@Relationship(deleteRule: .cascade, inverse: \RentPayment.tenant)`
- `debts` : `@Relationship(deleteRule: .cascade, inverse: \TenantDebt.tenant)`

Propriétés calculées dans extension `TenantViews.swift` :

- `totalDueForMonth(month, year)` = `monthlyRent + carryOverForMonth + dettes non payées du mois`.
- `carryOverForMonth(month, year, depth)` remonte mois par mois, max 36 mois, jusqu'au mois de création, puis calcule `max(prevDue - prevReceived, 0)`.

### 2. RentPayment

Fichier : `Models.swift`, ligne approximative 33.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `month` | `Int` | Non | requis init |
| `year` | `Int` | Non | requis init |
| `isPaid` | `Bool` | Non | `false` |
| `paidDate` | `Date?` | Oui | `nil` |
| `amountDue` | `Double` | Non | `0` |
| `amountReceived` | `Double` | Non | `0` |
| `carryOver` | `Double` | Non | `0` |
| `note` | `String` | Non | `""` |
| `tenant` | `Tenant?` | Oui | `nil` |

Relations :

- `tenant` inverse de `Tenant.payments`.

Calculs :

- `balance` = `amountDue - amountReceived`.
- `isFullyPaid` = `amountReceived >= amountDue && amountDue > 0`.
- `isPartiallyPaid` = `amountReceived > 0 && amountReceived < amountDue`.

### 3. TenantDebt

Fichier : `Models.swift`, ligne approximative 73.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `label` | `String` | Non | requis init |
| `amount` | `Double` | Non | requis init |
| `month` | `Int` | Non | requis init |
| `year` | `Int` | Non | requis init |
| `isPaid` | `Bool` | Non | `false` |
| `createdAt` | `Date` | Non | `Date()` |
| `tenant` | `Tenant?` | Oui | `nil` |

Relations :

- `tenant` inverse de `Tenant.debts`.

### 4. DubaiPart

Fichier : `Models.swift`, ligne approximative 102.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `name` | `String` | Non | requis init |
| `category` | `String` | Non | requis init |
| `quantityBought` | `Int` | Non | requis init |
| `quantitySold` | `Int` | Non | `0` |
| `purchasePriceAED` | `Double` | Non | requis init |
| `targetSalePriceAED` | `Double` | Non | `0` |
| `note` | `String` | Non | `""` |
| `createdAt` | `Date` | Non | `Date()` |
| `cashWithdrawnAED` | `Double` | Non | `0` |
| `sales` | `[DubaiSale]` | Non | `[]` |
| `expenses` | `[DubaiExpense]` | Non | `[]` |
| `attachments` | `[Attachment]` | Non | `[]` |

Relations :

- `sales` : `@Relationship(deleteRule: .cascade, inverse: \DubaiSale.part)`
- `expenses` : `@Relationship(deleteRule: .cascade, inverse: \DubaiExpense.part)`
- `attachments` : `@Relationship(deleteRule: .cascade, inverse: \Attachment.dubaiPart)`

Calculs :

- `quantityRemaining` = `max(quantityBought - quantitySold, 0)`.
- `totalBoughtAED` = `quantityBought * purchasePriceAED`.
- `totalPotentialRevenueAED` = `quantityBought * targetSalePriceAED`.
- `estimatedSoldRevenueAED` = `quantitySold * targetSalePriceAED`.
- `remainingStockValueAED` = `quantityRemaining * targetSalePriceAED`.
- `estimatedPotentialProfitAED` = `totalPotentialRevenueAED - totalBoughtAED`.
- `netProfitAED` = `estimatedPotentialProfitAED - cashWithdrawnAED`.
- `realQuantitySoldFromSales` = somme des quantités de `sales`.
- `realQuantitySoldAEDFromSales` = somme des quantités des ventes dont `currency == "AED"`.
- `realRevenueAED` = somme des `totalSalePriceAED` des ventes AED uniquement.
- `linkedExpensesAED` = somme des charges liées AED uniquement.
- `realGrossMarginAED` = `realRevenueAED - realQuantitySoldAEDFromSales * purchasePriceAED`.
- `realNetMarginAED` = `realGrossMarginAED - linkedExpensesAED`.
- `realRemainingQuantity` = `max(quantityBought - realQuantitySoldFromSales, 0)`.
- `projectedRemainingRevenueAED` = `realRemainingQuantity * targetSalePriceAED`.

Point migration : plusieurs calculs `real...AED` ignorent les ventes/charges non AED, volontairement ou historiquement. Le dashboard avancé compense ensuite par agrégation multi-devise dans `DubaiBusinessView`.

### 5. DubaiSale

Fichier : `Models.swift`, ligne approximative 162.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `quantity` | `Int` | Non | requis init |
| `unitSalePriceAED` | `Double` | Non | requis init |
| `currency` | `String` | Non | `"AED"` |
| `date` | `Date` | Non | `Date()` |
| `customerName` | `String` | Non | `""` |
| `note` | `String` | Non | `""` |
| `part` | `DubaiPart?` | Oui | `nil` |

Relation :

- `part` inverse de `DubaiPart.sales`.

Calcul :

- `totalSalePriceAED` = `Double(quantity) * unitSalePriceAED`.

Attention nommage : `unitSalePriceAED` et `totalSalePriceAED` sont maintenant utilisés avec une `currency` variable. Le nom indique AED mais les montants peuvent représenter AED/EUR/FCFA/USD selon `currency`.

### 6. DubaiExpense

Fichier : `Models.swift`, ligne approximative 193.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `title` | `String` | Non | requis init |
| `amountAED` | `Double` | Non | requis init |
| `currency` | `String` | Non | `"AED"` |
| `date` | `Date` | Non | `Date()` |
| `category` | `String` | Non | `"Autre"` |
| `note` | `String` | Non | `""` |
| `part` | `DubaiPart?` | Oui | `nil` |

Relation :

- `part` inverse de `DubaiPart.expenses`.
- Si `part == nil`, la charge est globale Dubaï.

Attention nommage : `amountAED` peut contenir une valeur dans une autre devise si `currency` vaut EUR/FCFA/USD.

### 7. DubaiCashMovement

Fichier : `Models.swift`, ligne approximative 222.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `title` | `String` | Non | requis init |
| `amount` | `Double` | Non | requis init |
| `currency` | `String` | Non | `"AED"` |
| `date` | `Date` | Non | `Date()` |
| `type` | `String` | Non | requis init |
| `category` | `String` | Non | `"Autre"` |
| `note` | `String` | Non | `""` |
| `status` | `String` | Non | `"done"` |

Relations :

- Aucune relation SwiftData vers `DubaiPart`.

Valeurs métier observées :

- `type`: `"withdrawal"`, `"cash_out"`, `"cash_in"`.
- `status`: `"done"`, `"planned"`.

### 8. Business

Fichier : `Models.swift`, ligne approximative 254.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `name` | `String` | Non | requis init |
| `type` | `String` | Non | requis init |
| `icon` | `String` | Non | `"briefcase.fill"` |
| `colorHex` | `String` | Non | `"#5B5CE6"` |
| `note` | `String` | Non | `""` |
| `isActive` | `Bool` | Non | `true` |
| `createdAt` | `Date` | Non | `Date()` |
| `moduleClients` | `Bool` | Non | `true` |
| `moduleSuppliers` | `Bool` | Non | `false` |
| `moduleStock` | `Bool` | Non | `false` |
| `modulePurchases` | `Bool` | Non | `false` |
| `moduleSales` | `Bool` | Non | `false` |
| `moduleReservations` | `Bool` | Non | `false` |
| `moduleServices` | `Bool` | Non | `false` |
| `moduleTasks` | `Bool` | Non | `false` |
| `modulePayments` | `Bool` | Non | `true` |
| `moduleDocuments` | `Bool` | Non | `false` |
| `moduleKPI` | `Bool` | Non | `true` |
| `contacts` | `[BusinessContact]` | Non | `[]` |
| `items` | `[BusinessItem]` | Non | `[]` |
| `transactions` | `[BusinessTransaction]` | Non | `[]` |
| `bookings` | `[BusinessBooking]` | Non | `[]` |
| `tasks` | `[BusinessTask]` | Non | `[]` |
| `attachments` | `[Attachment]` | Non | `[]` |

Relations :

- Toutes les collections enfants sont en `deleteRule: .cascade`.
- Inverses : `BusinessContact.business`, `BusinessItem.business`, `BusinessTransaction.business`, `BusinessBooking.business`, `BusinessTask.business`, `Attachment.business`.

Extension calculée dans `ContentView.swift` :

- `activeModulesLabels` retourne les libellés des modules activés.

### 9. BusinessContact

Fichier : `Models.swift`, ligne approximative 307.

Propriétés :

- `name: String`
- `role: String`
- `phone: String = ""`
- `email: String = ""`
- `note: String = ""`
- `business: Business? = nil`

Relation :

- `business` inverse de `Business.contacts`.

### 10. BusinessItem

Fichier : `Models.swift`, ligne approximative 315.

Propriétés :

- `title: String`
- `kind: String`
- `sku: String = ""`
- `quantity: Int = 0`
- `purchasePrice: Double = 0`
- `salePrice: Double = 0`
- `isActive: Bool = true`
- `note: String = ""`
- `business: Business? = nil`

Calculs :

- `stockValue` = `Double(quantity) * purchasePrice`.
- `potentialRevenue` = `Double(quantity) * salePrice`.

### 11. BusinessTransaction

Fichier : `Models.swift`, ligne approximative 327.

Propriétés :

- `title: String`
- `type: String`
- `amount: Double`
- `category: String`
- `date: Date = Date()`
- `note: String = ""`
- `business: Business? = nil`

Calcul :

- `isIncome` = `type == "revenu"`.

### 12. BusinessBooking

Fichier : `Models.swift`, ligne approximative 336.

Propriétés :

- `title: String`
- `customerName: String`
- `startDate: Date`
- `endDate: Date`
- `price: Double = 0`
- `status: String = "a_preparer"`
- `note: String = ""`
- `business: Business? = nil`

Extension dans `ContentView.swift` :

- `statusLabel` : `"termine" -> "Terminé"`, `"annule" -> "Annulé"`, autre -> `"À préparer"`.

### 13. BusinessTask

Fichier : `Models.swift`, ligne approximative 345.

Propriétés :

- `title: String`
- `dueDate: Date = Date()`
- `isDone: Bool = false`
- `priority: String = "moyenne"`
- `note: String = ""`
- `business: Business? = nil`

### 14. BudgetEntry

Fichier : `Models.swift`, ligne approximative 353.

Propriétés :

| Propriété | Type Swift | Optional | Défaut |
|---|---:|---:|---|
| `title` | `String` | Non | requis init |
| `amount` | `Double` | Non | requis init |
| `type` | `String` | Non | requis init |
| `category` | `String` | Non | requis init |
| `bucket` | `String` | Non | requis init |
| `scope` | `String` | Non | `"Perso"` |
| `date` | `Date` | Non | `Date()` |
| `note` | `String` | Non | `""` |
| `potentialAmount` | `Double` | Non | `0` |
| `status` | `String` | Non | `"recu"` |

Calculs :

- `isIncome` = `type == "revenu"`.
- `displayPotential` = `potentialAmount > 0 ? potentialAmount : amount`.
- `isConfirmed` = `status == "recu"`.

Valeurs statut observées :

- `"recu"` = confirmé/reçu/payé.
- `"non"` = en attente/non payé.
- `"peu"` = incertain, badge existant dans Budget.

### 15. Subscription

Fichier : `Models.swift`, ligne approximative 372.

Propriétés :

- `title: String`
- `amount: Double`
- `dueDay: Int`
- `category: String = "Abonnement"`
- `systemImage: String = "creditcard.fill"`
- `colorHex: String = "#7B61FF"`
- `scope: String = "Perso"`
- `isActive: Bool = true`
- `note: String = ""`

### 16. Trip

Fichier : `Models.swift`, ligne approximative 381.

Propriétés :

- `title: String`
- `destinationSummary: String`
- `startDate: Date`
- `endDate: Date`
- `peopleCount: Int = 1`
- `targetBudget: Double = 0`
- `notes: String = ""`
- `isCompleted: Bool = false`
- `createdAt: Date = Date()`
- `flights: [Flight] = []`
- `accommodations: [Accommodation] = []`
- `activities: [TripActivity] = []`
- `checklist: [TripChecklistItem] = []`

Relations :

- `flights`: cascade inverse `Flight.trip`
- `accommodations`: cascade inverse `Accommodation.trip`
- `activities`: cascade inverse `TripActivity.trip`
- `checklist`: cascade inverse `TripChecklistItem.trip`

Calculs :

- `flightsTotal` = somme `flights.price`.
- `accommodationsTotal` = somme `accommodations.price`.
- `activitiesTotal` = somme `activities.price`.
- `totalBudget` = `flightsTotal + accommodationsTotal + activitiesTotal`.

### 17. Flight

Fichier : `Models.swift`, ligne approximative 401.

Propriétés :

- `airline: String`
- `fromCode: String`
- `toCode: String`
- `departDate: Date`
- `arriveDate: Date`
- `price: Double = 0`
- `bookingLink: String = ""`
- `attachmentNote: String = ""`
- `status: String = "a_reserver"`
- `trip: Trip? = nil`

Extension `statusLabel` dans `ContentView.swift` :

- `"reserve" -> "Réservé"`
- `"termine" -> "Terminé"`
- `"annule" -> "Annulé"`
- autre -> `"À réserver"`

### 18. Accommodation

Fichier : `Models.swift`, ligne approximative 412.

Propriétés :

- `name: String`
- `city: String`
- `startDate: Date`
- `endDate: Date`
- `price: Double = 0`
- `bookingLink: String = ""`
- `attachmentNote: String = ""`
- `status: String = "a_reserver"`
- `trip: Trip? = nil`

Extension `statusLabel` :

- `"reserve" -> "Réservé"`
- `"termine" -> "Terminé"`
- `"annule" -> "Annulé"`
- autre -> `"À réserver"`

### 19. TripActivity

Fichier : `Models.swift`, ligne approximative 421.

Propriétés :

- `title: String`
- `city: String = ""`
- `activityDate: Date = Date()`
- `price: Double = 0`
- `link: String = ""`
- `status: String = "a_prevoir"`
- `note: String = ""`
- `trip: Trip? = nil`

Extension `statusLabel` :

- `"reserve" -> "Réservée"`
- `"fait" -> "Faite"`
- `"annule" -> "Annulée"`
- autre -> `"À prévoir"`

### 20. TripChecklistItem

Fichier : `Models.swift`, ligne approximative 430.

Propriétés :

- `title: String`
- `category: String = "Général"`
- `isDone: Bool = false`
- `trip: Trip? = nil`

### 21. Attachment

Fichier : `Models.swift`, ligne approximative 437.

Propriétés :

- `fileName: String`
- `mimeType: String`
- `fileData: Data` avec `@Attribute(.externalStorage)`
- `createdAt: Date = Date()`
- `dubaiPart: DubaiPart? = nil`
- `business: Business? = nil`

Relations :

- `dubaiPart` inverse de `DubaiPart.attachments`.
- `business` inverse de `Business.attachments`.
- Les parents `DubaiPart` et `Business` ont une relation cascade vers attachments : supprimer un parent supprime ses pièces jointes associées.

Calculs :

- `isImage` = `mimeType.hasPrefix("image/")`
- `isPDF` = `mimeType == "application/pdf"`
- `fileIcon` = `photo`, `doc.richtext`, ou `doc`
- `fileIconColor` = `"blue"`, `"red"`, `"gray"`
- `formattedSize` calcule KB/MB
- `displayName` = `fileName`

---

## 2. ModelContainer

Source : `BUDGET_JRApp.swift`.

Déclaration principale :

- `@main struct LifeBusinessJRApp: App`
- `WindowGroup { RootView() }`
- `.modelContainer(for: [...])`

Modèles enregistrés exactement :

1. `Tenant`
2. `RentPayment`
3. `TenantDebt`
4. `DubaiPart`
5. `DubaiSale`
6. `DubaiExpense`
7. `DubaiCashMovement`
8. `Business`
9. `BusinessContact`
10. `BusinessItem`
11. `BusinessTransaction`
12. `BusinessBooking`
13. `BusinessTask`
14. `BudgetEntry`
15. `Subscription`
16. `Trip`
17. `Flight`
18. `Accommodation`
19. `TripActivity`
20. `TripChecklistItem`
21. `Attachment`

Configuration observée :

- Pas de `ModelConfiguration` explicite.
- Pas de `Schema` explicite.
- Pas de `MigrationPlan`.
- Pas de store nommé explicitement.
- Pas de configuration CloudKit.
- Stockage local SwiftData standard.
- Tous les modèles vivent dans le même container.

Performance lancement :

- La création du `modelContainer` est attachée au `WindowGroup`.
- Le container enregistre 21 modèles au démarrage.
- Les tabs étant dans une `TabView`, SwiftUI peut initialiser plusieurs vues et requêtes tôt, même si visuellement un seul onglet est sélectionné.

---

## 3. AppStorage / UserDefaults

| Clé | Type | Default | Fichiers | Fonction | Actif dans UI ? |
|---|---:|---|---|---|---|
| `onboarding_done` | `Bool` | `false` | `OnboardingView.swift` | Décide entre onboarding et app principale | Oui, mais onboarding seulement première fois |
| `app_theme` | `String` | `"jour"` | `ContentView.swift`, `AccueilView.swift`, `BudgetView.swift`, `FormViews.swift`, `TenantViews.swift`, `JRFormComponents.swift`, `DesignSystem.swift`, `JRDesignSystem.swift`, `AirportDatabase.swift`, `OnboardingView.swift` | Thème clair/sombre | Partiellement. Le thème est lu partout, mais le sélecteur UI est orphelin |
| `dubai_display_currency` | `String` | `"AED"` | `ContentView.swift` | Devise d'affichage Business Dubaï | Oui, via segmented picker |
| `budget_selected_bucket` | `String` | `"Tous"` | `ContentView.swift`, ancien `BudgetView` | Filtre ancien BudgetView | Non dans la navigation actuelle |

Autres accès :

- `UserDefaults.standard.string(forKey: "app_theme")` est utilisé dans `TenantViews.swift` pour des sous-vues qui ne portent pas directement `@AppStorage`.

Constats :

- L'onboarding n'apparaît plus après première validation parce que `onboarding_done` reste à `true`. C'est normal pour un onboarding.
- Il n'y a pas de splash custom affiché à chaque ouverture.
- Le sélecteur `themePickerSection` existe dans `AccueilView.swift`, mais n'est pas appelé dans le body actif.

---

## 4. Pickers / valeurs fixes

### Budget

`AddBudgetEntryView` / `EditBudgetEntryView` :

- Catégories : `"Salaire"`, `"Loyer"`, `"Transport"`, `"Nourriture"`, `"Business"`, `"Voyage"`, `"Abonnement"`, `"Divers"`.
- Groupes : `"Revenus"`, `"Fixes"`, `"Abonnements"`, `"Variables"`, `"Business"`, `"Voyage"`.
- Scope : `"Perso"`, `"Dubaï"`, `"Loyers"` + noms des `Business`.
- Type logique : `"revenu"` ou `"depense"`, piloté par `TypeToggle`.
- Statut : par défaut `"recu"` dans le modèle, toggle Budget bascule `"recu"` / `"non"`, badge gère aussi `"peu"`.

Ancien `BudgetView` mort :

- Buckets filtre : `"Tous"`, `"Revenus"`, `"Fixes"`, `"Abonnements"`, `"Variables"`, `"Business"`, `"Voyage"`.

### Business générique

`AddBusinessView` :

- Types : `"achat_revente" / "Achat / Revente"`, `"service" / "Service"`, `"location" / "Location"`, `"projet" / "Projet"`, `"personnalise" / "Personnalisé"`.
- Modules : `"Clients"`, `"Fournisseurs"`, `"Stock"`, `"Achats"`, `"Ventes"`, `"Réservations"`, `"Prestations"`, `"Tâches"`, `"Paiements"`, `"Documents"`, `"KPI"`.

Business tâches :

- Priorités : `"basse" / "Basse"`, `"moyenne" / "Moy."`, `"haute" / "Haute"`.

Business transactions :

- Type : `"revenu"` / `"depense"`.

Business booking :

- Status modèle par défaut : `"a_preparer"`.
- Extension label : `"termine"`, `"annule"`, défaut `"À préparer"`.

### Business Dubaï

Devises :

- `"AED"`, `"EUR"`, `"FCFA"`, `"USD"`.
- Alias : `"CFA"` est normalisé en `"FCFA"`.

`DubaiCashMovement` :

- Labels type : `"Retrait"`, `"Décaissement business"`, `"Apport"`.
- Raw type : `"withdrawal"`, `"cash_out"`, `"cash_in"`.
- Labels status : `"Réalisé"`, `"Prévu"`.
- Raw status : `"done"`, `"planned"`.
- Catégories pour `"Décaissement business"` : `"Achat fournisseur"`, `"Transport"`, `"Dédouanement"`, `"Réparation"`, `"Livraison"`, `"Commission"`, `"Stockage"`, `"Voyage"`, `"Autre"`.
- Catégories pour `"Apport"` : `"Apport personnel"`, `"Avance"`, `"Autre"`.
- Catégories pour `"Retrait"` : `"Retrait personnel"`, `"Envoyé à maman"`, `"Remboursement"`, `"Autre"`.

`DubaiExpense` :

- Catégories constatées : `"Achat fournisseur"`, `"Dédouanement"`, `"Transport"`, `"Réparation"`, `"Livraison"`, `"Commission"`, `"Stockage"`, `"Autre"` selon les formulaires Dubaï.

### Loyers

`AddTenantDebtView` :

- Types rapides : `"Badge perdu"`, `"Clé perdue"`, `"Dégradation"`, `"Caution"`, `"Retard"`, `"Travaux"`, `"Charges"`, `"Autre"`.
- Mois : `1...12`, affichés via `monthName`.
- Années : `2024`, `2025`, `2026`, `2027`.
- Récurrence : `isRecurring` true/false.

`PartialPaymentView` :

- Boutons rapides : `"Tout (...)"`, `"3/4"`, `"1/2"`, `"1/4"`.
- Modes si paiement existant : `"Modifier le montant"`, `"Ajouter un versement"`.

### Voyages

`AddFlightView` / `EditFlightView` :

- Status : `"a_reserver" / "À réserver"`, `"reserve" / "Réservé"`, `"termine" / "Terminé"`.
- Aéroports : `AirportPickerView`, codes IATA issus de `AirportDatabase`.

`AddAccommodationView` / `EditAccommodationView` :

- Status : `"a_reserver" / "À réserver"`, `"reserve" / "Réservé"`, `"termine" / "Terminé"`.

`AddTripActivityView` / `EditTripActivityView` :

- Status : `"a_prevoir" / "À prévoir"`, `"reserve" / "Réservée"`, `"fait" / "Faite"`.

`AddTripChecklistItemView` :

- Ajouts rapides : `"Passeport"`, `"Visa"`, `"Assurance"`, `"eSIM"`, `"Chargeur"`, `"Adaptateur"`, `"Médicaments"`, `"Crème solaire"`, `"Vêtements"`, `"Chaussures confort"`, `"Argent liquide"`, `"Carte bancaire"`.
- Catégories : `"Documents"`, `"Tech"`, `"Santé"`, `"Bagages"`, `"Finance"`, `"Général"`.

### Subscriptions

`AddSubscriptionView` :

- Catégorie par défaut : `"Abonnement"`.
- Scope : `"Perso"` + probablement options enrichies par `Business` selon le formulaire.
- Icônes rapides observées dans le code autour de `quickIcons`.

### Airports

`AirportPickerView` :

- Aéroports populaires : `"CDG"`, `"DXB"`, `"JFK"`, `"LHR"`, `"AMS"`, `"MAD"`, `"BCN"`, `"FCO"`, `"IST"`, `"SIN"`, `"BKK"`, `"KUL"`, `"NRT"`, `"HKG"`, `"CMN"`, `"RAK"`, `"DKR"`, `"ABJ"`, `"MRU"`, `"RUN"`.

---

## 5. Formulaires

### Formulaires loyers

| Formulaire | Modèle | Champs | Validations | Ouverture |
|---|---|---|---|---|
| `AddTenantView` | `Tenant` | nom, loyer mensuel, jour échéance, note | nom non vide, montant positif probable | `GestionLoyersView.sheet(showAddTenant)` |
| `EditTenantView` | `Tenant` | nom, loyer, échéance, note | sauvegarde directe | `TenantDetailView.sheet(showEditSheet)` |
| `PartialPaymentView` | `RentPayment` | montant, mode ajout/remplacement, date, note | bouton save désactivé si montant <= 0 | `TenantDetailView.sheet(showPaymentSheet)` |
| `AddTenantDebtView` | `TenantDebt` | libellé, montant, mois, année, récurrente | libellé non vide, montant positif | `TenantDetailView.sheet(showAddDebtSheet)` |
| `EditTenantDebtView` | `TenantDebt` | libellé, montant, mois, année, payé | sauvegarde directe | `TenantDetailView.sheet(item selectedDebt)` |

### Formulaires Dubaï

| Formulaire | Modèle | Champs | Validations | Ouverture |
|---|---|---|---|---|
| `AddDubaiPartView` | `DubaiPart` | nom, catégorie, quantité achetée, prix achat, prix vente cible, note | nom non vide, quantité positive, prix achat positif | `DubaiBusinessView.sheet(showAddSheet)` |
| `EditDubaiPartView` | `DubaiPart` | mêmes champs édition | sauvegarde directe/validations simples | `DubaiPartDetailView.sheet(showEditSheet)` |
| `AddDubaiSaleView` | `DubaiSale` | quantité, prix réel/unité, devise, date, client, note | quantité positive, prix positif, quantité <= stock restant réel | `DubaiPartDetailView.sheet(showAddSaleSheet)` |
| `EditDubaiSaleView` | `DubaiSale` | quantité, prix, devise, date, client, note | quantité positive, prix positif, quantité <= stock restant + quantité vente existante | `DubaiPartDetailView.sheet(item selectedSale)` |
| `AddDubaiExpenseView` | `DubaiExpense` | titre, montant, devise, date, catégorie, note | titre non vide, montant positif | `DubaiBusinessView` global ou `DubaiPartDetailView` lié |
| `EditDubaiExpenseView` | `DubaiExpense` | mêmes champs édition | titre non vide, montant positif | sheets globales ou détail pièce |
| `AddDubaiCashMovementView` | `DubaiCashMovement` | titre, montant, devise, type, catégorie, statut, date, note | titre non vide, montant positif | `DubaiBusinessView.sheet(showAddCashMovementSheet)` |
| `EditDubaiCashMovementView` | `DubaiCashMovement` | mêmes champs édition | titre non vide, montant positif | `DubaiBusinessView.sheet(item selectedCashMovement)` |
| `DubaiWithdrawSheet` | `DubaiCashMovement` + `DubaiPart.cashWithdrawnAED` | montant, note, devise affichage | montant > 0, doublon récent évité | `DubaiPartDetailView.sheet(showWithdrawSheet)` |

### Formulaires business générique

| Formulaire | Modèle | Champs | Validations | Ouverture |
|---|---|---|---|---|
| `AddBusinessView` | `Business` | nom, type, note, modules actifs | nom non vide | `AddBusinessViewNav`, `GenericBusinessesView.sheet` |
| `EditBusinessView` | `Business` | identité/modules | sauvegarde directe | `BusinessDetailView.sheet(showEditBusiness)` |
| `AddBusinessContactView` | `BusinessContact` | nom, rôle, téléphone, email, note | nom non vide | `BusinessDetailView.sheet(showAddContact)` |
| `EditBusinessContactView` | `BusinessContact` | mêmes champs | sauvegarde directe | `BusinessDetailView.sheet(item selectedContact)` |
| `AddBusinessItemView` | `BusinessItem` | titre, kind, sku, quantité, prix achat, prix vente, actif, note | titre non vide probable | `BusinessDetailView.sheet(showAddItem)` |
| `EditBusinessItemView` | `BusinessItem` | mêmes champs | sauvegarde directe | `BusinessDetailView.sheet(item selectedItem)` |
| `AddBusinessTransactionView` | `BusinessTransaction` | titre, type, montant, catégorie, date, note | titre non vide, montant positif | `BusinessDetailView.sheet(showAddTransaction)` |
| `EditBusinessTransactionView` | `BusinessTransaction` | mêmes champs | sauvegarde directe | `BusinessDetailView.sheet(item selectedTransaction)` |
| `AddBusinessBookingView` | `BusinessBooking` | titre, client, dates, prix, status, note | titre non vide probable | `BusinessDetailView.sheet(showAddBooking)` |
| `AddBusinessTaskView` | `BusinessTask` | titre, échéance, priorité, note | titre non vide probable | `BusinessDetailView.sheet(showAddTask)` |
| `EditBusinessTaskView` | `BusinessTask` | mêmes champs | sauvegarde directe | `BusinessDetailView.sheet(item selectedTask)` |

Note : pas de `EditBusinessBookingView` trouvé dans l'inventaire `struct`; à vérifier si l'édition réservation business est volontairement absente.

### Formulaires Budget

| Formulaire | Modèle | Champs | Validations | Ouverture |
|---|---|---|---|---|
| `AddBudgetEntryView` | `BudgetEntry` | title, amount, isIncome/type, category, bucket, scope, date, note | intitulé non vide, montant positif | `BudgetView_Enhanced.sheet(showAddEntry)` |
| `EditBudgetEntryView` | `BudgetEntry` | mêmes champs sur objet existant | sauvegarde directe via `saveContext` | `BudgetView_Enhanced.sheet(item selectedEntry)` |
| `AddSubscriptionView` | `Subscription` | title, amount, dueDay, category, icon, color, scope, actif, note | titre non vide, montant positif probable | ancien `BudgetView` ou entrée directe à vérifier |

### Formulaires Voyages

| Formulaire | Modèle | Champs | Validations | Ouverture |
|---|---|---|---|---|
| `AddTripView` | `Trip` | titre, destination, dates, personnes, budget cible, notes | titre non vide probable | `VoyagesView.sheet(showAddTrip)` |
| `EditTripView` | `Trip` | mêmes champs | sauvegarde directe | `TripDetailView.sheet(showEditTrip)` |
| `AddFlightView` | `Flight` + option `BudgetEntry` | airline, fromCode, toCode, dates, prix, status, bookingLink | compagnie, départ, arrivée non vides | `TripDetailView.sheet(showAddFlight)` |
| `EditFlightView` | `Flight` | mêmes champs | sauvegarde directe | `TripDetailView.sheet(item selectedFlight)` |
| `AddAccommodationView` | `Accommodation` + option `BudgetEntry` | name, city, dates, prix, status, bookingLink | nom et ville non vides | `TripDetailView.sheet(showAddAccommodation)` |
| `EditAccommodationView` | `Accommodation` | mêmes champs | sauvegarde directe | `TripDetailView.sheet(item selectedAccommodation)` |
| `AddTripActivityView` | `TripActivity` + option `BudgetEntry` | title, city, date, prix, status, link, note | titre non vide | `TripDetailView.sheet(showAddActivity)` |
| `EditTripActivityView` | `TripActivity` | mêmes champs | sauvegarde directe | `TripDetailView.sheet(item selectedActivity)` |
| `AddTripChecklistItemView` | `TripChecklistItem` | ajout rapide, titre custom, catégorie | si aucun quick item et titre vide : erreur | `TripDetailView.sheet(showAddChecklist)` |

### Pièces jointes

| Vue | Modèle | Champs | Ouverture |
|---|---|---|---|
| `AttachmentsSectionView` | `Attachment` | photo/image ou document/PDF | utilisée par Dubaï/Business selon parent |
| `AttachmentPreviewView` | lecture `Attachment` | preview image ou état fichier | tap sur `AttachmentRowView` |

---

## 6. Navigation exhaustive

### Racine

```text
LifeBusinessJRApp
└─ RootView
   ├─ OnboardingView si onboarding_done == false
   └─ ContentView si onboarding_done == true
```

### Onglets principaux

`ContentView` contient une `TabView` masquée visuellement et une custom tab bar `JRBottomTabBubble`.

```text
ContentView
├─ AccueilView_Enhanced
├─ BusinessHomeView
├─ BudgetView_Enhanced
└─ VoyagesView
```

Important performance : même si la tab bar native est masquée, `TabView` conserve potentiellement un cycle de montage propre à SwiftUI. Les logs actuels servent à confirmer quelles tabs se montent au lancement.

### Business

```text
BusinessHomeView
├─ NavigationLink AddBusinessViewNav
├─ NavigationLink GestionLoyersView
│  ├─ sheet AddTenantView
│  └─ NavigationLink TenantDetailView
│     ├─ sheet EditTenantView
│     ├─ sheet PartialPaymentView
│     ├─ sheet AddTenantDebtView
│     ├─ sheet EditTenantDebtView
│     └─ Menu actions dettes
├─ NavigationLink DubaiBusinessView
│  ├─ sheet AddDubaiPartView
│  ├─ sheet AddDubaiExpenseView global
│  ├─ sheet AddDubaiCashMovementView
│  ├─ sheet EditDubaiExpenseView global
│  ├─ sheet EditDubaiCashMovementView
│  ├─ confirmationDialog suppression charge globale
│  ├─ confirmationDialog suppression mouvement
│  └─ NavigationLink DubaiPartDetailView
│     ├─ sheet EditDubaiPartView
│     ├─ sheet DubaiWithdrawSheet
│     ├─ sheet AddDubaiSaleView
│     ├─ sheet AddDubaiExpenseView lié
│     ├─ sheet EditDubaiSaleView
│     ├─ sheet EditDubaiExpenseView lié
│     ├─ confirmationDialog suppression vente
│     └─ confirmationDialog suppression charge liée
└─ NavigationLink GenericBusinessesView
   ├─ sheet AddBusinessView
   └─ NavigationLink BusinessDetailView
      ├─ sheet EditBusinessView
      ├─ sheet AddBusinessContactView
      ├─ sheet AddBusinessItemView
      ├─ sheet AddBusinessTransactionView
      ├─ sheet AddBusinessBookingView
      ├─ sheet AddBusinessTaskView
      ├─ sheet EditBusinessContactView
      ├─ sheet EditBusinessItemView
      ├─ sheet EditBusinessTransactionView
      └─ sheet EditBusinessTaskView
```

### Budget

```text
BudgetView_Enhanced
├─ confirmationDialog "Ajouter"
├─ sheet AddBudgetEntryView
├─ sheet EditBudgetEntryView via selectedEntry
├─ alert "Copie du mois"
└─ Menu ligne BudgetEntry
   ├─ Modifier
   └─ Supprimer
```

Le slide custom de suppression a été retiré. Le scroll vertical n'a plus de conflit DragGesture dans `BudgetView.swift`.

Ancien bloc mort dans `ContentView.swift` :

```text
BudgetView
├─ BudgetFilterView
├─ BudgetEntryRow
├─ BudgetEntryDetailView
└─ SubscriptionCalendarView
```

### Voyages

```text
VoyagesView
├─ sheet AddTripView
└─ NavigationLink TripDetailView
   ├─ sheet EditTripView
   ├─ sheet AddFlightView
   │  ├─ sheet AirportPickerView départ
   │  └─ sheet AirportPickerView arrivée
   ├─ sheet AddAccommodationView
   ├─ sheet AddTripActivityView
   ├─ sheet AddTripChecklistItemView
   ├─ sheet EditFlightView
   │  ├─ sheet AirportPickerView départ
   │  └─ sheet AirportPickerView arrivée
   ├─ sheet EditAccommodationView
   └─ sheet EditTripActivityView
```

### Autres modales/dialogues

- `AirportPickerView` est une sheet encapsulée dans `NavigationStack`.
- `AttachmentPreviewView` est une sheet depuis `AttachmentRowView`.
- `fullScreenCover` non trouvé dans l'audit global.
- `popover` non trouvé dans l'audit global.

---

## 7. Attachment — point critique migration

Source : `Models.swift` et `FormViews.swift`.

### Structure

`Attachment` stocke :

- `fileName`
- `mimeType`
- `fileData` en `Data`, avec `@Attribute(.externalStorage)`
- `createdAt`
- relation optionnelle `dubaiPart`
- relation optionnelle `business`

### Création/import

`AttachmentsSectionView` :

- `PhotosPicker` pour images.
- `fileImporter` pour `.pdf`, `.image`, `.data`.
- `allowsMultipleSelection: false`.
- Chargement photo : `item.loadTransferable(type: Data.self)`.
- Nom photo généré : `photo_<timestamp>.jpg`.
- MIME photo forcé : `"image/jpeg"`.
- Fichier PDF : MIME `"application/pdf"` si extension `pdf`.
- Autres fichiers : MIME `"application/octet-stream"`.
- Import fichier exécuté sur queue globale `userInitiated`, retour main queue pour insérer.

### Preview

`AttachmentRowView` :

- Si image : crée `UIImage(data: attachment.fileData)` et affiche une miniature.
- Sinon : icône selon MIME.
- Suppression directe via bouton trash : `modelContext.delete(att)` puis `saveContext(modelContext)`.

`AttachmentPreviewView` :

- Fond noir.
- Images affichées dans `ScrollView([.horizontal, .vertical])`.
- Non-images : icône, nom, taille, message "Fichier enregistré dans l'app".

### Risques migration

- `@Attribute(.externalStorage)` signifie que SwiftData peut stocker le blob hors ligne principale du store.
- Un export JSON unique avec base64 peut devenir énorme et fragile.
- Le meilleur format recommandé est un `.zip` contenant :
  - `manifest.json`
  - un dossier `attachments/`
  - chaque pièce jointe en fichier binaire.
- Le manifest doit contenir `legacy_id`, `fileName`, `mimeType`, `createdAt`, `parent_type`, `parent_legacy_id`, `relative_path`, `size_bytes`, éventuellement `sha256`.

---

## 8. Design system

### `JRFormComponents.swift`

Statut : ACTIF.

Composants principaux :

- `jrAccent` = `Color(red: 0.50, green: 0.31, blue: 0.95)`.
- `JRRowIcon`.
- `JRFormDivider`.
- `JRFormShell`.
- `JRFormHeader`.
- `JRFormSection`.
- `JRFormTextRow`.
- `JRFormAmountRow`.
- `JRFormDateRow`.
- `JRFormPickerRow`.
- `JRFormPreviewCard`.
- `JRFormErrorBanner`.

Style :

- Fond formulaire clair : `Color(red: 0.96, green: 0.96, blue: 0.98)`.
- Barre nav claire : blanc en thème jour.
- Sections : card blanche, radius 20, stroke `theme.softStroke`, shadow faible.
- Icônes : rectangles arrondis pastel 34 x 34, radius 12.
- Typographie : `.system(..., design: .rounded)`.
- Amount row : `TextField` avec `amountText` local, efface visuellement le 0 au focus, commit decimal en remplaçant `,` par `.`.

### `JRDesignSystem.swift`

Statut : PARTIELLEMENT ACTIF.

Composants :

- `JRTheme`
- `JRCard`
- `JRStatCard`
- `JRBadge`
- `JRSectionHeader`
- autres composants partagés.

Tokens :

- Backgrounds système : `.systemBackground`, `.secondarySystemBackground`, `.tertiarySystemBackground`.
- Textes système : `.label`, `.secondaryLabel`, `.tertiaryLabel`.
- Accents : `.purple`, vert `Color(red: 0.05, green: 0.72, blue: 0.48)`, orange, cyan, rouge.
- Radius : 20 et 12.
- Padding card : 16.
- Spacing : 16 / 10.
- Ombres : opacity 0.06 / 0.10.

Utilisation :

- Des composants et tokens restent disponibles et partiellement utilisés, mais l'interface actuelle repose surtout sur `AppTheme`, `JRFormComponents`, et des composants locaux de `ContentView.swift`.

### `DesignSystem.swift`

Statut : LEGACY MAIS ENCORE UTILISÉ / PARTIELLEMENT ACTIF.

Tokens :

- Couleurs module :
  - budget cyan : `Color(red: 0, green: 0.85, blue: 1.0)`
  - budget green : `Color(red: 0, green: 0.95, blue: 0.3)`
  - loyers violet : `Color(red: 0.8, green: 0.4, blue: 1.0)`
  - Dubaï orange : `Color(red: 1.0, green: 0.6, blue: 0)`
  - voyages cyan : `Color(red: 0, green: 1.0, blue: 1.0)`
  - business blue : `Color(red: 0.4, green: 0.8, blue: 1.0)`
- Spacing : 4, 8, 12, 16, 20, 24.
- Radius : 8, 12, 16, 24, full.
- Ombres : opacités 0.08, 0.12, 0.16.

Composants :

- `PremiumCard`
- `StatCard`
- `PremiumButton`
- `PressEffect`
- `AppTheme`
- `appBackground`
- modificateurs et helpers visuels.

Constat :

- Le thème premium blanc/violet actuel est un mélange de ces systèmes.
- `JRFormComponents` est le système actif pour les formulaires modernes.
- Les composants `StyledSheetContainer`, `FormSection`, `FormTextField`, `PreviewCard`, etc. en début de `FormViews.swift` restent LEGACY MAIS ENCORE UTILISÉS par certaines vues d'édition ou anciens écrans. Ne pas supprimer sans refactor contrôlé.

---

## 9. Code mort / actif / partiel

### Mort confirmé

| Élément | Fichier | Statut | Justification |
|---|---|---|---|
| `BudgetView` | `ContentView.swift` ligne ~2829 | MORT | `ContentView` appelle `BudgetView_Enhanced()` |
| `BudgetEntryRow` | `ContentView.swift` ligne ~3260 | MORT par dépendance | Utilisé dans l'ancien `BudgetView` mort |
| `BudgetEntryDetailView` | `ContentView.swift` ligne ~3290 | MORT par dépendance | Utilisé dans l'ancien `BudgetView` mort |
| `BudgetFilterView` | `ContentView.swift` ligne ~3213 | MORT par dépendance | Utilisé dans l'ancien `BudgetView` mort |
| `SubscriptionCalendarView` | `ContentView.swift` ligne ~3351 | MORT par dépendance | Utilisé dans l'ancien `BudgetView` mort |
| `budget_selected_bucket` | `ContentView.swift` ancien Budget | MORT UI actuelle | AppStorage lu seulement par ancien Budget |
| `themePickerSection` | `AccueilView.swift` ligne ~669 | MORT UI actuelle | Présent mais non appelé dans le body actif |

### Actif

- `ContentView`
- `JRBottomTabBubble`
- `JRPageTitleBubble`
- `AccueilView_Enhanced`
- `BusinessHomeView`
- `GestionLoyersView`
- `TenantDetailView`
- `DubaiBusinessView`
- `DubaiPartDetailView`
- `GenericBusinessesView`
- `BusinessDetailView`
- `BudgetView_Enhanced`
- `VoyagesView`
- `TripDetailView`
- Tous les formulaires Add/Edit listés en section 5, sauf absence à vérifier pour `EditBusinessBookingView`.

### Partiellement utilisé / legacy

- Anciens composants de formulaire dans `FormViews.swift`.
- `DesignSystem.swift` et `JRDesignSystem.swift` coexistent avec `JRFormComponents.swift`.
- `SeedDemoDataButton` existe mais n'est pas forcément exposé dans l'UI principale actuelle.

---

## 10. Calculs métier

### Budget

Sources : `Models.swift`, `BudgetView.swift`, `SwiftDataHelpers.swift`.

Modèle :

- `BudgetEntry.isIncome` = `type == "revenu"`.
- `BudgetEntry.displayPotential` = `potentialAmount > 0 ? potentialAmount : amount`.
- `BudgetEntry.isConfirmed` = `status == "recu"`.

Vue active `BudgetView_Enhanced` :

- `monthEntries` filtre `entries` sur `selectedMonth` à granularité `.month`.
- `rentrees` = bucket `"Revenus"` ou `isIncome`.
- `chargesFixes` = non income avec bucket `"Fixes"` ou `"Abonnements"`.
- `depenses` = non income hors `"Fixes"` et `"Abonnements"`.
- `confirmedEntries` = `monthEntries.filter(\.isConfirmed)`.
- `pendingEntries` = `monthEntries.filter { !$0.isConfirmed }`.
- `confirmedIncome` = somme `amount` des revenus confirmés.
- `pendingIncome` = somme `displayPotential` des revenus en attente.
- `confirmedExpenses` = somme `amount` des dépenses confirmées.
- `pendingExpenses` = somme `displayPotential` des dépenses en attente.
- `confirmedBalance` = `confirmedIncome - confirmedExpenses`.
- `projectedBalance` = `confirmedBalance + pendingIncome - pendingExpenses`.
- Totaux sections :
  - `totalRentreesReel`, `totalRentreesPot`.
  - `totalChargesReel`, `totalChargesPot`.
  - `totalDepensesReel`, `totalDepensesPot`.
- `heroRatio` = `min(totalRentreesReel / totalRentreesPot, 1)`.

Copie mois :

- `copyCurrentMonthToNextMonth()` copie les entrées du mois courant vers le mois suivant.
- Date déplacée au même jour si possible, sinon dernier jour valide du mois cible.
- Statut forcé à `"non"`.
- Doublon évité par titre normalisé, montant, type, catégorie, bucket, jour du mois.

Edge cases :

- `scope` n'est pas dans la règle anti-doublon actuelle.
- `potentialAmount` est copié tel quel.
- Si une entrée source a un statut `"peu"`, elle devient `"non"` dans le mois cible.

### Loyers

Sources : `Models.swift`, `TenantViews.swift`, `SwiftDataHelpers.swift`.

`RentPayment` :

- `balance` = `amountDue - amountReceived`.
- `isFullyPaid` = `amountReceived >= amountDue && amountDue > 0`.
- `isPartiallyPaid` = `amountReceived > 0 && amountReceived < amountDue`.

`Tenant.totalDueForMonth` :

- `monthlyRent + carryOverForMonth + dettes non payées du mois`.

`Tenant.carryOverForMonth` :

- Profondeur max 36.
- Stop avant le mois de création du locataire.
- Mois précédent :
  - `prevExtra` = dettes non payées du mois précédent.
  - `prevDue` = `monthlyRent + carryOverForMonth(prev) + prevExtra`.
  - `prevReceived` = paiement du mois précédent.
  - retourne `max(prevDue - prevReceived, 0)`.

`PartialPaymentView` :

- `existingPayment` par mois/année.
- `totalDue`, `carryOver`, `extraDebts`, `alreadyReceived`, `remaining`.
- `newTotal` = montant saisi en mode édition, ou `alreadyReceived + amountInput` en mode ajout.
- `newBalance` = `totalDue - newTotal`.
- `nextMonthLoyer` = `tenant.monthlyRent + max(newBalance, 0) + nextExtra`.
- `resetPayment()` remet `isPaid=false`, `paidDate=nil`, `amountReceived=0`, `carryOver=0`, note vide.

Edge cases :

- Un seul `RentPayment` par tenant/mois/année est supposé par `first`.
- Les dettes non payées restent prises en compte jusqu'à passage `isPaid=true`.

### Business Dubaï

Sources : `Models.swift`, `ContentView.swift`, `FormViews.swift`.

Part théorique :

- `totalBoughtAED` = quantité achetée x prix achat.
- `totalPotentialRevenueAED` = quantité achetée x prix vente cible.
- `estimatedSoldRevenueAED` = `quantitySold * targetSalePriceAED`.
- `remainingStockValueAED` = stock restant théorique x prix cible.
- `estimatedPotentialProfitAED` = potentiel total - investissement.
- `netProfitAED` = marge potentielle - cash retiré.

Part réelle :

- `realQuantitySoldFromSales` = somme ventes.
- `realRemainingQuantity` = `max(quantityBought - realQuantitySoldFromSales, 0)`.
- `realRevenueAED` = ventes AED seulement.
- `linkedExpensesAED` = charges liées AED seulement.
- `realGrossMarginAED` = revenu réel AED - coût achat des quantités vendues AED.
- `realNetMarginAED` = marge brute AED - charges liées AED.
- `projectedRemainingRevenueAED` = stock réel restant x prix cible.

Dashboard Dubaï :

- `totalSalesByCurrency` groupe les ventes par devise d'origine.
- `totalLinkedExpensesByCurrency` groupe les charges liées par devise d'origine.
- `totalGlobalExpensesByCurrency` groupe les charges globales par devise d'origine.
- `totalExpensesByCurrency` = charges liées + charges globales.
- `doneCashMovements` = cash movements `status == "done"`.
- `plannedCashMovements` = cash movements `status == "planned"`.
- `cashInTotalsByCurrency` = done + type `"cash_in"`.
- `cashOutTotalsByCurrency` = done + type `"cash_out"`.
- `withdrawalsTotalsByCurrency` = done + type `"withdrawal"`.
- `plannedMovementsByCurrency` = planned, tous types confondus.
- `totalDisbursed(currency)` = dépenses + décaissements business + retraits, convertis vers devise d'affichage.
- `currentResult(currency)` = ventes + apports - total décaissé, convertis vers devise d'affichage.
- `origin...` affiche les montants par devise d'origine sans conversion.

Convertisseur :

- Taux : `1 EUR = 3.97 AED`, `1 EUR = 655.957 FCFA`, `1 EUR = 1.08 USD`.
- Conversion via EUR pivot.
- `normalizedCurrency("CFA") = "FCFA"`.
- `formatDubaiAmount` utilise `Locale(identifier: "fr_FR")`, decimal, 0 ou 2 décimales selon arrondi.

Edge cases :

- Les taux sont statiques.
- Les champs nommés `AED` dans les modèles peuvent contenir d'autres devises si `currency != "AED"`.
- Pas de relation entre `DubaiCashMovement` et une pièce, sauf retrait créé avec titre/note.
- `DubaiWithdrawSheet` évite les doublons seulement sur une fenêtre récente de 10 secondes.

### Business générique

Sources : `Models.swift`, `SwiftDataHelpers.swift`, `ContentView.swift`.

- `BusinessItem.stockValue` = `quantity * purchasePrice`.
- `BusinessItem.potentialRevenue` = `quantity * salePrice`.
- `BusinessTransaction.isIncome` = `type == "revenu"`.
- `BusinessCalculator.totalRevenue` = somme transactions income.
- `BusinessCalculator.totalExpense` = somme transactions non income.
- `BusinessCalculator.totalMargin` = revenue - expense.
- `BusinessCalculator.openTasksCount` = tâches non faites.
- `BusinessCalculator.activeBookingsCount` = bookings hors `"termine"` et `"annule"`.
- `Business.activeModulesLabels` retourne les modules actifs en libellés UI.

### Voyages

Sources : `Models.swift`, `SwiftDataHelpers.swift`, `FormViews.swift`.

- `Trip.flightsTotal` = somme prix vols.
- `Trip.accommodationsTotal` = somme prix logements.
- `Trip.activitiesTotal` = somme prix activités.
- `Trip.totalBudget` = total des trois.
- `TripCalculator.preparationScore` = éléments réservés/terminés/faits/checklist cochée sur total éléments.
- `TripCalculator.nextTrip` = premier voyage futur non terminé.
- `TripCalculator.daysUntil` = nombre de jours avant départ si futur.

Voyage vers Budget automatique :

- À la création d'un vol avec `price > 0`, insertion d'un `BudgetEntry` dépense, catégorie `"Voyage"`, bucket `"Voyage"`, scope `trip.title`, statut `"non"`.
- À la création d'un logement avec `price > 0`, même logique.
- À la création d'une activité avec `price > 0`, même logique.
- Pas de synchronisation des modifications ni suppression croisée : choix simple et sûr.

### Accueil / Insights

Sources : `AccueilView.swift`, `TodayInsightsView.swift`.

- Accueil agrège de nombreuses requêtes : tenants, dubaiParts, budgetEntries, trips, businesses, subscriptions.
- Activité récente utilise les entrées Budget confirmées pour ne pas afficher l'attente comme réalisé.
- Les insights du jour utilisent tenants impayés, abonnements à venir, tâches urgentes, budget et voyages.

---

## 11. Données non SwiftData

### Données utilisateur

- Toutes les entités métier sont SwiftData.
- Pièces jointes : `Attachment.fileData`, external storage SwiftData.
- Préférences : `@AppStorage` / `UserDefaults`.

### Données statiques

- `AirportDatabase.swift` : liste locale d'aéroports.
- Design tokens dans `DesignSystem.swift`, `JRDesignSystem.swift`, `JRFormComponents.swift`.
- Valeurs fixes de pickers dans les formulaires.

### Données de démonstration

- `SeedData.swift` insère données démo uniquement si toutes les grandes collections sont vides.
- Déclenchement par bouton `SeedDemoDataButton`, pas automatiquement dans `BUDGET_JRApp.swift`.

### Fichiers/imports

- `CSVImporter.swift` lit des fichiers CSV pour Budget.
- `AttachmentsSectionView` importe images/PDF/documents.
- Pas de cache applicatif custom identifié.
- Pas d'URLs réseau pour AirportDatabase.

---

## 12. CSV Importer

Source : `CSVImporter.swift`.

Structure :

- `ParsedBudgetCSVRow`
  - `title`
  - `amount`
  - `type`
  - `category`
  - `bucket`
  - `scope`
  - `date`
  - `note`

Entrée :

- `parse(url:)` lit en UTF-8.
- `parse(text:)` normalise les retours ligne.
- Première ligne = headers.
- Headers normalisés :
  - lowercased
  - accents supprimés
  - espaces, `_`, `-` supprimés

Colonnes utilisées :

- `type`
- `description`
- `montant` ou `amount`
- `frais` ou `fees`
- `datedefin` ou `date` ou `datededebut`

Parsing montant :

- Supprime `€`, espaces.
- Remplace `,` par `.`.
- `Double(cleaned)`.
- `finalAmount = abs(rawAmount == 0 ? fees : rawAmount)`.
- Type final :
  - dépense si montant négatif ou montant 0 avec frais > 0.
  - revenu sinon.

Catégorisation :

- Nourriture si description contient `uber eats`, `mcdonald`, `carrefour`, `shoprite`.
- Abonnement si `spotify`, `openai`, `mega`, `apple`.
- Loyer si `loyer`, `assur`, `cofidis`.
- Transport si `bolt`, `transport`, `mta`, `ratp`.
- Voyage si `booking`, `airbnb`, `hotel`, `french bee`.
- Salaire si `recharge`, `ajout de fonds` ou type contient `ajout de fonds`.
- Business si `business`.
- Sinon `Divers`.

Bucket :

- Salaire -> `Revenus`.
- Loyer -> `Fixes`.
- Abonnement -> `Abonnements`.
- Voyage -> `Voyage`.
- Business -> `Business`.
- Sinon `Variables`.

Date :

- Formats supportés :
  - `"yyyy-MM-dd HH:mm:ss"`
  - `"yyyy-MM-dd"`
- Locale `fr_FR`.
- Fallback `Date()`.

Limites :

- Split CSV maison, supporte guillemets simples mais pas tous les cas CSV complexes.
- Pas d'erreur détaillée par ligne.
- Scope fixé à `"Perso"`.
- Le fichier produit des rows parsées ; l'insertion en `BudgetEntry` est à vérifier côté ancien Budget/import UI.

---

## 13. AirportDatabase

Source : `AirportDatabase.swift`.

Structure :

- `Airport: Identifiable, Hashable`
  - `id = UUID()` non persistant
  - `iata`
  - `name`
  - `city`
  - `country`
  - `flag`
  - `isPrimary = true`
  - `displayLine`
  - `fullName`

Base :

- `AirportDatabase.shared`.
- Liste locale commentée comme `~300 aéroports principaux mondiaux`; le fichier actuel contient une grande liste statique offline.

Recherche :

- Si query vide : `[]`.
- Normalisation lowercased + diacritiques.
- Match sur IATA, ville, pays, nom.
- Tri :
  - code exact prioritaire,
  - début de code/ville,
  - primaire,
  - ville alphabétique.
- Limite : `.prefix(6)`.

Utilisation :

- `AddFlightView` et `EditFlightView` utilisent `AirportPickerView`.
- Le modèle `Flight` stocke seulement `fromCode` et `toCode`, pas le nom complet de l'aéroport.

Migration :

- Pas besoin de migrer la base statique comme données utilisateur.
- Pour la PWA, cette liste peut devenir un fichier statique TypeScript/JSON.
- Les vols migrés doivent conserver les codes IATA en l'état.

---

## 14. SeedData

Source : `SeedData.swift`.

Composant :

- `SeedDemoDataButton`.

Requêtes :

- tenants
- parts
- businesses
- entries
- trips
- subs

Condition :

- `isEmpty` = toutes ces collections sont vides.
- Le bouton est désactivé si non vide.
- `seedData()` ne s'exécute que si `guard isEmpty else { return }`.

Données créées :

- 2 tenants.
- 2 pièces Dubaï.
- 1 business "Lavage Auto".
- 4 BudgetEntry : Salaire, Loyer appartement, Transport, Spotify.
- 2 abonnements : Spotify, OpenAI.
- 1 voyage "Asie 2026" avec vol, logement, activité, checklist.

Risque :

- Risque faible de mélange avec données réelles car le seed ne s'exécute que si tout est vide.
- À confirmer : le bouton est-il visible dans l'UI finale ? Le fichier existe, mais son exposition exacte doit être vérifiée si on veut retirer toute possibilité utilisateur.

---

## 15. Stratégie future de migration

### Principe critique

Les modèles SwiftData n'ont pas d'UUID métier. Il ne faut pas exporter les `PersistentIdentifier` comme IDs portables.

Recommandation : générer des `legacy_id` au moment de l'export, sans modifier les modèles SwiftData.

Exemple :

```json
{
  "tenants": [
    { "legacy_id": "tenant_000001", "name": "..." }
  ],
  "rent_payments": [
    { "legacy_id": "rent_payment_000001", "tenant_legacy_id": "tenant_000001" }
  ]
}
```

### Ordre d'export recommandé

1. Exporter les parents.
2. Construire une table mémoire `ObjectIdentifier/PersistentModel -> legacy_id` pendant l'export.
3. Exporter les enfants avec `parent_legacy_id`.
4. Exporter les références optionnelles avec `null` si absent.
5. Exporter les pièces jointes en fichiers séparés.

Graphes à préserver :

- `Tenant -> RentPayment`
- `Tenant -> TenantDebt`
- `Trip -> Flight`
- `Trip -> Accommodation`
- `Trip -> TripActivity`
- `Trip -> TripChecklistItem`
- `Business -> BusinessContact`
- `Business -> BusinessItem`
- `Business -> BusinessTransaction`
- `Business -> BusinessBooking`
- `Business -> BusinessTask`
- `Business -> Attachment`
- `DubaiPart -> DubaiSale`
- `DubaiPart -> DubaiExpense`
- `DubaiPart -> Attachment`
- `DubaiExpense.part == nil` pour charges Dubaï globales.
- `DubaiCashMovement` indépendant.
- `BudgetEntry`, `Subscription` indépendants sauf liens textuels `scope`.

### Format recommandé

Recommandé : `.zip`.

Structure :

```text
budget-jr-export-YYYYMMDD-HHMM.zip
├─ manifest.json
├─ data/
│  ├─ tenants.json
│  ├─ rent_payments.json
│  ├─ tenant_debts.json
│  ├─ budget_entries.json
│  ├─ subscriptions.json
│  ├─ trips.json
│  ├─ flights.json
│  ├─ accommodations.json
│  ├─ trip_activities.json
│  ├─ trip_checklist_items.json
│  ├─ businesses.json
│  ├─ business_contacts.json
│  ├─ business_items.json
│  ├─ business_transactions.json
│  ├─ business_bookings.json
│  ├─ business_tasks.json
│  ├─ dubai_parts.json
│  ├─ dubai_sales.json
│  ├─ dubai_expenses.json
│  └─ dubai_cash_movements.json
└─ attachments/
   ├─ attachment_000001.jpg
   └─ attachment_000002.pdf
```

Pourquoi ZIP plutôt que JSON base64 :

- Les attachments peuvent être lourds.
- Base64 gonfle la taille.
- ZIP permet checksums, reprise, inspection, séparation data/fichiers.
- Plus proche d'une import pipeline Supabase Storage + PostgreSQL.

### Mapping PostgreSQL futur

Recommandations :

- Tables avec `id uuid primary key default gen_random_uuid()`.
- Colonne `legacy_id text unique` pendant migration.
- Colonnes FK vers tables parents.
- Colonnes `created_at timestamptz`.
- Colonnes monétaires `numeric(12,2)` ou `numeric(14,2)` pour FCFA.
- Conserver `currency text` pour ventes/charges/mouvements Dubaï.
- Conserver les raw strings existants (`status`, `type`, `bucket`, `scope`) dans un premier temps pour éviter une migration métier risquée.
- Normaliser ensuite en enums côté TypeScript seulement après import validé.

---

## 16. Éléments lourds ou suspects performance

### Démarrage

Suspects :

- `ContentView` contient une `TabView` avec 4 onglets lourds.
- `AccueilView_Enhanced` lance 6 `@Query` larges dès l'accueil :
  - tenants
  - dubaiParts
  - budgetEntries
  - trips
  - businesses
  - subscriptions
- `BusinessHomeView` contient 3 `@Query`.
- `BudgetView_Enhanced` contient 2 `@Query`.
- `VoyagesView` contient 1 `@Query`.
- `DubaiBusinessView`, bien qu'en onglet secondaire Business, est très lourd mais ne devrait apparaître qu'après navigation vers Business Dubaï.
- `ContentView.swift` très gros peut ralentir la compilation et la maintenabilité, mais pas forcément le runtime directement.

À confirmer par logs :

- Si `[PERF] Budget init`, `[PERF] Business init`, `[PERF] Voyages init` apparaissent dès le lancement alors que l'utilisateur est sur Accueil, la `TabView` monte trop tôt.
- Si seuls `ContentView` et `Accueil` apparaissent, le noir vient plutôt de SwiftData/container, onboarding/root, ou rendu initial Accueil.

### Formulaires / premier clavier

Constats :

- Une version ultra légère de `AddBudgetEntryView` n'a pas amélioré le premier clavier.
- `JRFormAmountRow` a déjà un binding String local et vide le 0 au focus.
- Cela rend plausible un coût iOS/sheet/premier clavier plutôt qu'un coût uniquement JRFormComponents.

Suspects concrets :

- Premier focus clavier iOS dans une sheet.
- Initialisation du clavier simulateur/iPhone.
- Multiplication de `@AppStorage("app_theme")` dans composants imbriqués.
- DatePicker/Picker dans certains formulaires.
- `@Query` business dans `AddBudgetEntryView`, `EditBudgetEntryView`, `AddSubscriptionView` pour scopes.

### Dubaï

Suspects :

- Nombreuses propriétés calculées dans `DubaiBusinessView` sur `parts`, `sales`, `expenses`, `cashMovements`.
- Conversions répétées dans body.
- Charts sur `parts`.
- `formatDubaiAmount` crée un `NumberFormatter` à chaque appel.

### Accueil

Suspects :

- Calculs dérivés sur plusieurs collections.
- Charts.
- DateFormatter/NumberFormatter ponctuels.
- Activité récente et insights calculés dans body/computed properties.

---

## 17. Découpage progressif recommandé de `ContentView.swift`

Objectif : réduire le fichier de 4 395 lignes sans changer le comportement.

### Structs présentes dans `ContentView.swift`

- `AppTab`
- `ContentView`
- `JRAppRootBackground`
- `JRBottomTabBubble`
- `JRPageTitleBubble`
- `AlertItem`
- `BusinessHomeView`
- `AddBusinessViewNav`
- `GestionLoyersView`
- `TenantCard`
- `DubaiBusinessView`
- `DubaiPartCard`
- `DubaiPartDetailView`
- `DubaiWithdrawSheet`
- `GenericBusinessesView`
- `BusinessListCard`
- `BusinessDetailView`
- Ancien `BudgetView`
- `BudgetFilterView`
- `BudgetEntryRow`
- `BudgetEntryDetailView`
- `SubscriptionCalendarView`
- `VoyagesView`
- `TripCard`
- `TripDetailView`
- `InfoLineView`
- `DubaiCurrencyConverter`
- `EmptyStateView`
- `FloatingAddButton`
- `FloatingAddButtonBody`
- `PremiumCardModifier`
- `SoftCardModifier`
- `ThemedChartModifier`
- `LightCardModifier`
- extensions `View`, `Business`, `BusinessBooking`, `Flight`, `Accommodation`, `TripActivity`, `Color`
- extension `Calendar`
- helpers globaux : `euro`, `dateRange`, `monthName`, `formatDubai`, `formatDubaiAmount`, `dubaiTotalsByCurrency`, `dubaiResultTotals`, `formatDubaiTotals`, `displayDubaiMovementType`

### Découpage proposé

1. `RootShellViews.swift`
   - `AppTab`
   - `ContentView`
   - `JRAppRootBackground`
   - `JRBottomTabBubble`
   - `JRPageTitleBubble`
   - `AlertItem`

2. `BusinessHomeViews.swift`
   - `BusinessHomeView`
   - `AddBusinessViewNav`
   - `GenericBusinessesView`
   - `BusinessListCard`
   - extensions `Business`, éventuellement `BusinessBooking`

3. `DubaiViews.swift`
   - `DubaiBusinessView`
   - `DubaiPartCard`
   - `DubaiPartDetailView`
   - `DubaiWithdrawSheet`

4. `DubaiFormatting.swift`
   - `DubaiCurrencyConverter`
   - `formatDubai`
   - `formatDubaiAmount`
   - `dubaiTotalsByCurrency`
   - `dubaiResultTotals`
   - `formatDubaiTotals`
   - `displayDubaiMovementType`

5. `TravelViews.swift`
   - `VoyagesView`
   - `TripCard`
   - `TripDetailView`
   - extensions `Flight`, `Accommodation`, `TripActivity`

6. `LegacyBudgetViews.swift`
   - ancien `BudgetView`
   - `BudgetFilterView`
   - `BudgetEntryRow`
   - `BudgetEntryDetailView`
   - `SubscriptionCalendarView`
   - ou à laisser en place jusqu'à suppression validée.

7. `SharedUIHelpers.swift`
   - `InfoLineView`
   - `EmptyStateView`
   - `FloatingAddButton`
   - card modifiers
   - extension `View`
   - extension `Color`
   - extension `Calendar`
   - `euro`
   - `dateRange`
   - `monthName`

### Ordre safe

1. Extraire les helpers purs sans état SwiftData : formatters, converters, extensions.
2. Extraire composants UI partagés (`JRBottomTabBubble`, `JRPageTitleBubble`, modifiers).
3. Extraire Voyages, car dépendances limitées.
4. Extraire Business générique.
5. Extraire Dubaï, après stabilisation des helpers Dubaï.
6. Isoler l'ancien Budget mort dans un fichier legacy ou le supprimer seulement après accord explicite.

Règle : un déplacement à la fois + build Xcode après chaque étape.

---

## 18. Optimisations recommandées

### Priorité 1 — sans risque / immédiat

- Lire les logs `[PERF]` actuels au démarrage sur iPhone réel.
- Retirer les logs `[PERF]` après diagnostic.
- Remplacer certains `VStack + ForEach` longs par `LazyVStack` là où les listes peuvent grossir.
- Sortir les `NumberFormatter()` et `DateFormatter()` répétés en statiques quand ils sont appelés en boucle.
- Garder le retrait du `DragGesture` custom Budget pour préserver le scroll.
- Réduire les calculs répétés dans `body` Dubaï/Accueil par computed properties déjà nommées ou helpers purs.

### Priorité 2 — refactor progressif

- Découper `ContentView.swift` selon le plan section 17.
- Créer un fichier dédié aux helpers Dubaï avant tout autre changement Dubaï.
- Créer des helpers de mapping `status/type/category` pour éviter les chaînes dispersées.
- Centraliser les listes fixes de pickers dans un fichier `Constants` ou `DomainOptions`, sans changer les modèles.
- Préparer un export SwiftData ZIP + manifest JSON en lecture seule.

### Priorité 3 — plus tard

- Ajouter des UUID métier dans une migration contrôlée uniquement après sauvegarde/export validé.
- Remplacer progressivement les raw strings par enums côté PWA.
- Ajouter Supabase Storage pour attachments.
- Ajouter auth, multi-utilisateur, owner_id et RLS côté Supabase.
- Ajouter sync des dépenses voyages vers Budget en édition/suppression, avec relation dédiée côté PWA.

---

## 19. Ce qu'il ne faut surtout pas toucher maintenant

Pour préserver les données iPhone :

- Ne pas changer le Bundle Identifier.
- Ne pas renommer les modèles SwiftData.
- Ne pas supprimer/renommer de propriétés SwiftData.
- Ne pas changer les types des propriétés SwiftData.
- Ne pas changer les relations SwiftData sans migration explicite.
- Ne pas retirer `@Attribute(.externalStorage)` sans plan d'export attachments.
- Ne pas utiliser `PersistentIdentifier` comme ID de migration.
- Ne pas supprimer l'ancien `BudgetView` sans accord, même s'il est mort.
- Ne pas réinitialiser `onboarding_done`, sauf besoin utilisateur explicite.
- Ne pas faire de refactor massif de `ContentView.swift` sans build entre chaque déplacement.

---

## 20. Corrections par rapport à l'audit Claude

Constats vérifiés/corrigés :

- Nombre réel de lignes Swift : 13 448, pas ~10 800.
- Les 21 modèles `@Model` sont confirmés dans `Models.swift`.
- Aucun UUID explicite n'est présent dans les modèles SwiftData.
- Les `UUID()` trouvés concernent `Airport` et `AlertItem`, deux structs non persistées.
- Ancien `BudgetView` confirmé mort ; `BudgetView_Enhanced` est la vue active.
- `themePickerSection` confirmé orphelin.
- `ContentView` monte une `TabView` avec 4 onglets ; logs nécessaires pour confirmer le montage réel au runtime.
- `JRFormAmountRow` contient déjà l'optimisation de saisie montant via `amountText`.
- Le module Business Dubaï avancé contient bien ventes réelles, charges liées/globales, cash movements, status prévu/réalisé, devises multiples et conversion via EUR pivot.
- Le format `ZIP + manifest JSON + attachments/` est confirmé comme la stratégie la plus robuste pour l'architecture actuelle.

---

## 21. Prochaine petite action recommandée

Avant la Phase 2 PWA :

1. Lancer l'app sur iPhone réel.
2. Copier les logs `[PERF]` du premier lancement et du deuxième lancement.
3. Confirmer si les quatre tabs apparaissent dans les logs dès le démarrage.
4. Retirer les logs temporaires.
5. Démarrer une Phase 2 limitée : créer seulement un export SwiftData `.zip` en lecture, sans modifier les modèles.

PHASE 1 VALIDÉE — PRÊT POUR PHASE 2
