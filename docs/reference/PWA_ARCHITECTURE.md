# PWA_ARCHITECTURE — Budget JR

Phase : 2 — Architecture de migration Budget JR SwiftUI/SwiftData vers PWA  
Référence fonctionnelle : `AUDIT_PHASE_1_FINAL.md`  
Date : 18 août 2026  
Statut : brouillon d'architecture, à valider avant Phase 3

## 0. Décision de périmètre

Cette phase ne crée pas encore l'application PWA. Elle fige l'architecture cible afin d'éviter de reconstruire plusieurs fois le projet.

Interdits pendant cette phase :

- Ne pas modifier les modèles SwiftData.
- Ne pas ajouter d'UUID aux modèles Swift.
- Ne pas coder l'export Swift.
- Ne pas créer de projet Next.js.
- Ne pas créer de projet Supabase distant.
- Ne pas exécuter les migrations SQL.
- Ne pas modifier l'app Swift actuelle.

Livrables de cette phase :

- `PWA_ARCHITECTURE.md`
- `SUPABASE_SCHEMA_DRAFT.sql`
- `MIGRATION_FORMAT_DRAFT.json`
- `MIGRATION_PARITY.md`

## 1. Objectif cible

Transformer Budget JR en PWA avec :

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Storage
- Vercel
- installation PWA iPhone / iPad / Mac / PC

Objectifs produit :

- Comptes utilisateurs.
- Données privées par utilisateur.
- Synchronisation multi-appareils.
- Récupération des données SwiftData existantes.
- Parité fonctionnelle avec Budget JR.
- Design fidèle au thème premium blanc/violet SwiftUI.

## 2. Contraintes héritées de Swift

L'app Swift actuelle contient :

- 21 modèles SwiftData.
- Aucun UUID métier portable dans les modèles.
- Des relations SwiftData cascade.
- Des pièces jointes `Attachment.fileData` en `@Attribute(.externalStorage)`.
- Des statuts et catégories en chaînes `String`.
- Beaucoup de montants en `Double`.
- Un gros `ContentView.swift` avec plusieurs domaines mélangés.

Conséquence principale :

La PWA doit avoir des IDs propres PostgreSQL, mais l'import Swift doit aussi conserver des identifiants historiques de migration.

Chaque table métier privée doit avoir :

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
legacy_id text
migration_batch_id uuid
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

La contrainte d'idempotence recommandée est :

```sql
unique(user_id, legacy_id)
```

uniquement lorsque `legacy_id is not null`, via index unique partiel.

## 3. Architecture globale Next.js

Structure proposée :

```text
budget-jr-pwa/
├── app/
│   ├── (auth)/
│   ├── (app)/
│   ├── api/
│   ├── layout.tsx
│   ├── manifest.ts
│   └── globals.css
├── components/
│   ├── ui/
│   ├── forms/
│   ├── layout/
│   └── feedback/
├── features/
│   ├── auth/
│   ├── home/
│   ├── budget/
│   ├── subscriptions/
│   ├── tenants/
│   ├── dubai/
│   ├── businesses/
│   ├── trips/
│   ├── attachments/
│   ├── settings/
│   └── migration/
├── lib/
│   ├── supabase/
│   ├── domain/
│   ├── formatting/
│   ├── validation/
│   ├── dates/
│   └── constants/
├── hooks/
├── services/
├── types/
├── schemas/
├── public/
│   ├── icons/
│   └── data/
├── supabase/
│   ├── migrations/
│   └── seed/
└── tests/
    ├── unit/
    ├── integration/
    ├── rls/
    ├── migration/
    └── parity/
```

Règles d'architecture :

- Aucun équivalent React géant de `ContentView.swift`.
- Un domaine = une feature isolée.
- Les calculs métier vivent dans `lib/domain` ou `features/*/domain`.
- Les composants UI ne font pas directement les calculs métier complexes.
- Les appels Supabase passent par des repositories/services typés.
- Les validations vivent dans `schemas/` avec Zod.
- Les constantes de statuts/catégories/pickers vivent dans `lib/constants`.
- Les fichiers utilisateurs passent par Supabase Storage, jamais en base64 dans PostgreSQL.

## 4. Découpage par features

### 4.1 auth

Responsabilités :

- Signup.
- Login.
- Logout.
- Password reset.
- Session persistante.
- Profil utilisateur.
- Pseudo.

Tables :

- `profiles`

Écrans :

- `/login`
- `/signup`
- `/reset-password`
- `/settings/profile`

Services :

- `authService`
- `profileRepository`

Dépendances :

- Supabase Auth.
- Toutes les features privées dépendent de `auth.uid()`.

Décision :

- Le compte historique `jnor7` ne doit jamais être hardcodé.
- Lors de l'import, toutes les données sont attachées à l'utilisateur connecté.

### 4.2 home

Responsabilités :

- Dashboard accueil.
- Insights du jour.
- Activité récente.
- Raccourcis vers modules.

Modèles utilisés :

- `budget_entries`
- `businesses`
- `dubai_parts`
- `trips`
- `tenants`
- `rent_payments`
- `tenant_debts`
- `subscriptions`

Services :

- `homeSummaryService`
- `todayInsightsService`

Calculs :

- Résumés Budget confirmé/potentiel.
- Prochain voyage.
- Loyers impayés.
- Abonnements à venir.
- Activité récente confirmée uniquement.

Dépendances :

- budget
- tenants
- trips
- businesses
- dubai
- subscriptions

### 4.3 budget

Responsabilités :

- Transactions mensuelles.
- Rentrées, charges fixes, dépenses.
- Statuts reçu/payé/en attente.
- Potentiel vs réalisé.
- Copier le mois.
- Edition/suppression.
- Import CSV Revolut futur.

Tables :

- `budget_entries`

Écrans :

- `/budget`
- sheet client `new transaction`
- sheet client `edit transaction`

Services :

- `budgetRepository`
- `budgetCalculator`
- `copyMonthService`
- `csvBudgetImportService` plus tard

Calculs :

- `confirmedEntries`
- `pendingEntries`
- `confirmedIncome`
- `pendingIncome`
- `confirmedExpenses`
- `pendingExpenses`
- `confirmedBalance`
- `projectedBalance`
- totaux par groupe

Dépendances :

- businesses pour scopes éventuels.
- trips pour dépenses automatiques voyage, mais uniquement en création dans V1.

### 4.4 subscriptions

Responsabilités :

- Abonnements mensuels.
- Montant mensuel.
- Jour de prélèvement.
- Scope.
- Présence dans Accueil/Today.

Tables :

- `subscriptions`

Services :

- `subscriptionRepository`
- `subscriptionCalendarService`

Dépendances :

- budget/home.

Décision V1 :

- Ne pas convertir automatiquement tous les abonnements en `budget_entries` tant que la logique Swift n'est pas strictement identique.

### 4.5 tenants

Responsabilités :

- Gestion des locataires.
- Paiements mensuels.
- Paiements partiels.
- Dettes ponctuelles/récurrentes.
- Reports mois à mois.
- Remise paiement à 0.

Tables :

- `tenants`
- `rent_payments`
- `tenant_debts`

Écrans :

- `/business/tenants`
- `/business/tenants/[tenantId]`
- sheets paiement, dette, édition.

Services :

- `tenantRepository`
- `rentPaymentRepository`
- `tenantDebtRepository`
- `rentCalculator`

Calculs :

- `totalDueForMonth`
- `carryOverForMonth`
- `balance`
- `isFullyPaid`
- `isPartiallyPaid`

Dépendances :

- home.

### 4.6 dubai

Responsabilités :

- Références pièces.
- Stock acheté/vendu/restant.
- Ventes réelles.
- Charges liées.
- Charges globales.
- Mouvements argent.
- Retraits.
- Devises d'origine et devise d'affichage.
- Résultat actuel.
- Prévu à venir.
- Dashboard Dubaï.

Tables :

- `dubai_parts`
- `dubai_sales`
- `dubai_expenses`
- `dubai_cash_movements`
- `attachments`

Écrans :

- `/business/dubai`
- `/business/dubai/[partId]`
- sheets add/edit part, sale, expense, cash movement, withdrawal.

Services :

- `dubaiRepository`
- `dubaiCalculator`
- `currencyConverter`
- `dubaiMovementService`

Calculs :

- Investissement théorique.
- Valeur potentielle.
- Vente réelle par devise.
- Charges liées/globales.
- Cash in.
- Cash out.
- Withdrawals.
- Résultat par devise d'affichage.
- Détail par devise d'origine.
- Stock réel restant.
- Revenu projeté.

Dépendances :

- attachments.
- settings pour `dubai_display_currency`.

Décision importante :

- La PWA doit distinguer clairement le montant et sa devise.
- Les colonnes ne doivent pas continuer à mentir avec un suffixe `_aed` lorsque la valeur peut être EUR/FCFA/USD. Le SQL garde des aliases de migration si nécessaire, mais le domaine TypeScript doit utiliser `amount` + `currency`.

### 4.7 businesses

Responsabilités :

- Business configurables.
- Modules actifs.
- Contacts.
- Stock/items.
- Transactions.
- Réservations.
- Tâches.
- Pièces jointes.

Tables :

- `businesses`
- `business_contacts`
- `business_items`
- `business_transactions`
- `business_bookings`
- `business_tasks`
- `attachments`

Écrans :

- `/business`
- `/business/list`
- `/business/[businessId]`
- sheets add/edit sous-entités.

Services :

- `businessRepository`
- `businessCalculator`

Calculs :

- CA.
- Marge.
- Stock value.
- Potential revenue.
- Tâches ouvertes.
- Réservations actives.

Dépendances :

- attachments.
- home.

### 4.8 trips

Responsabilités :

- Voyages.
- Vols.
- Logements.
- Activités.
- Checklist.
- Aéroports.
- Création simple de dépenses Budget à la création si prix > 0.

Tables :

- `trips`
- `flights`
- `accommodations`
- `trip_activities`
- `trip_checklist_items`
- `budget_entries`

Écrans :

- `/trips`
- `/trips/[tripId]`
- sheets add/edit trip, flight, accommodation, activity, checklist.
- sheet airport picker.

Services :

- `tripRepository`
- `tripBudgetBridgeService`
- `tripCalculator`
- `airportSearchService`

Dépendances :

- budget pour création de dépense.
- airport static data.

Décision V1 :

- Créer la dépense Budget à la création initiale vol/logement/activité.
- Ne pas synchroniser édition/suppression tant qu'il n'y a pas de lien modèle explicite.

### 4.9 attachments

Responsabilités :

- Upload privé.
- Metadata SQL.
- Preview.
- Suppression.
- Association à Dubaï ou Business.

Tables :

- `attachments`

Storage :

- bucket privé `budget-jr-attachments`.

Services :

- `attachmentRepository`
- `storageService`

Dépendances :

- businesses
- dubai

### 4.10 settings

Responsabilités :

- Profil.
- Préférences synchronisées.
- Préférences locales appareil.

Tables :

- `profiles`
- `user_preferences`

Préférences synchronisées :

- `dubai_display_currency`.

Préférences locales :

- onboarding PWA déjà vu.
- installation PWA prompt dismissed.

À ignorer V1 :

- thème si l'UI actuelle ne l'expose pas réellement.

### 4.11 migration

Responsabilités :

- Import ZIP SwiftData.
- Validation manifest.
- Création batch.
- Import idempotent.
- Upload attachments.
- Rapport final.
- Reprise/rollback.

Tables :

- `migration_batches`
- toutes les tables métier avec `legacy_id` et `migration_batch_id`.

Services :

- `migrationParser`
- `migrationValidator`
- `migrationImportService`
- `migrationRollbackService`

Écrans :

- `/settings/migration`
- étapes import wizard.

## 5. Schéma Supabase cible

Le brouillon SQL complet est dans `SUPABASE_SCHEMA_DRAFT.sql`.

Tables proposées :

1. `profiles`
2. `user_preferences`
3. `migration_batches`
4. `tenants`
5. `rent_payments`
6. `tenant_debts`
7. `dubai_parts`
8. `dubai_sales`
9. `dubai_expenses`
10. `dubai_cash_movements`
11. `businesses`
12. `business_contacts`
13. `business_items`
14. `business_transactions`
15. `business_bookings`
16. `business_tasks`
17. `budget_entries`
18. `subscriptions`
19. `trips`
20. `flights`
21. `accommodations`
22. `trip_activities`
23. `trip_checklist_items`
24. `attachments`

Note : il y a 21 modèles SwiftData, mais 24 tables SQL car `profiles`, `user_preferences` et `migration_batches` sont des tables nécessaires à l'architecture PWA.

## 6. Identifiants et idempotence

Chaque table métier :

- `id uuid primary key default gen_random_uuid()`
- `legacy_id text null`
- `migration_batch_id uuid null references migration_batches(id)`
- index unique partiel `unique(user_id, legacy_id) where legacy_id is not null`

Pourquoi `unique(user_id, legacy_id)` :

- Le même export importé deux fois par le même utilisateur ne crée pas de doublons.
- Deux utilisateurs différents peuvent importer des exports qui contiennent les mêmes `legacy_id`.
- `legacy_id` peut rester `null` pour les données créées directement dans la PWA.

Limite :

- Si les `legacy_id` sont générés aléatoirement à chaque export Swift, deux exports différents du même iPhone ne permettront pas de reconnaître les mêmes objets.
- Pour une migration unique finale, c'est acceptable.
- Pour plusieurs imports incrémentaux, il faut une stratégie plus stable.

## 7. Stratégies legacy_id Swift

### Option A — legacy_id généré uniquement pendant chaque export

Principe :

- L'export parcourt les objets SwiftData.
- Il attribue `tenant_000001`, `payment_000001`, etc.
- Les relations dans le même export utilisent ces IDs.

Avantages :

- Aucun changement des modèles Swift.
- Risque minimal pour les données existantes.
- Suffisant pour un export unique final.

Inconvénients :

- Un deuxième export peut générer des IDs différents.
- Détection inter-export difficile.
- Import incrémental fragile.

### Option B — migrationID ajouté aux modèles Swift plus tard

Principe :

- Ajouter un champ `migrationID: UUID` à chaque modèle SwiftData.
- Initialiser une seule fois les objets existants.
- Tous les exports successifs conservent le même ID.

Avantages :

- Identifiants stables.
- Import multiple/incrémental beaucoup plus fiable.
- Relations robustes.

Risques :

- Modification des modèles SwiftData.
- Nécessite migration SwiftData prudente.
- Risque sur données iPhone si mal exécuté.

### Option C — mapping externe persistant

Principe :

- Conserver un fichier local ou une table de mapping entre identité SwiftData et legacy_id.

Avantages :

- Évite de modifier tous les modèles.
- IDs stables si le mapping reste disponible.

Risques :

- `PersistentIdentifier` n'est pas une identité portable garantie.
- Fichier externe facile à perdre.
- Plus complexe à expliquer/tester.

### Recommandation

Pour la sécurité des données :

1. Phase 2/3 : commencer par Option A pour concevoir et tester l'export ZIP sans toucher aux modèles.
2. Avant migration réelle finale : décider si un export unique suffit.
3. Si plusieurs exports/reprises sont nécessaires : envisager Option B, mais uniquement après sauvegarde complète et test sur copie.

Recommandation par défaut :

- Export unique final : Option A.
- Migration progressive/synchronisation : Option B.

## 8. User ID et sécurité privée

Toutes les tables de données privées doivent avoir `user_id`.

Cela inclut les sous-entités, même si l'utilisateur pourrait être retrouvé via parent :

- `rent_payments.user_id`
- `tenant_debts.user_id`
- `dubai_sales.user_id`
- `business_contacts.user_id`
- `flights.user_id`
- etc.

Raisons :

- RLS simple.
- Requêtes plus rapides.
- Import plus facile.
- Suppression utilisateur plus claire.
- Moins de risques en cas de jointure oubliée.

Invariant à respecter côté import :

- Le `user_id` de l'enfant doit toujours être le même que celui du parent.
- Ajouter une validation applicative ou RPC pour rejeter les incohérences.

## 9. Supabase Auth

Flux nécessaires :

- Signup email/password.
- Login.
- Logout.
- Password reset.
- Session persistante côté navigateur.
- Profil utilisateur.
- Pseudo.

Table `profiles` :

- `id uuid primary key references auth.users(id) on delete cascade`
- `username text`
- `display_name text`
- `avatar_url text`
- `created_at timestamptz`
- `updated_at timestamptz`

Le compte historique `jnor7` :

- Peut être `username = 'jnor7'` dans `profiles`.
- Ne doit jamais apparaître dans les policies.
- Ne doit pas être hardcodé dans l'application.
- L'import attache les données à `auth.uid()` de la session active.

## 10. Row Level Security

Règle générale :

```sql
auth.uid() = user_id
```

Policies par table privée :

- SELECT : l'utilisateur voit ses lignes.
- INSERT : l'utilisateur ne peut insérer que des lignes avec `user_id = auth.uid()`.
- UPDATE : l'utilisateur ne peut modifier que ses lignes et ne peut pas changer `user_id`.
- DELETE : l'utilisateur ne peut supprimer que ses lignes.

Table `profiles` :

- SELECT own profile.
- INSERT own profile.
- UPDATE own profile.
- DELETE own profile si nécessaire, souvent géré par suppression auth.

Tables enfants :

- RLS par `user_id` direct.
- Ne pas dépendre seulement d'une jointure parent pour la sécurité.
- Les foreign keys garantissent les relations, RLS garantit la confidentialité.

Attention :

- Le filtrage frontend n'est jamais un mécanisme de sécurité.
- Le service role ne doit jamais être exposé côté client.

## 11. Supabase Storage pour attachments

Bucket recommandé :

```text
budget-jr-attachments
```

Mode :

- Bucket privé.
- Pas d'accès public.
- Lecture via signed URLs courtes ou endpoint serveur sécurisé.

Chemin recommandé :

```text
{user_id}/{attachment_id}/{safe_filename}
```

Pourquoi ce chemin :

- Partition naturelle par utilisateur.
- Facile à sécuriser avec Storage RLS.
- `attachment_id` évite les collisions de noms.
- Le nom original reste conservé en metadata SQL.

Table `attachments` :

- `id`
- `user_id`
- `legacy_id`
- `migration_batch_id`
- `parent_type`: `"dubai_part"` ou `"business"`
- `dubai_part_id` nullable.
- `business_id` nullable.
- `file_name`
- `mime_type`
- `size_bytes`
- `storage_bucket`
- `storage_path`
- `sha256`
- timestamps.

Contraintes :

- Exactement un parent parmi `dubai_part_id`, `business_id` si `parent_type` est requis.
- MIME autorisés côté upload :
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `application/pdf`
  - `application/octet-stream` seulement si nécessaire pour compat migration.
- Limite taille à décider : recommandation V1 `20 MB` par fichier.

Suppression :

- Suppression SQL + suppression Storage.
- Préférer une fonction serveur ou job Supabase Edge pour garantir cleanup.

Preview :

- Images : signed URL.
- PDF : signed URL dans viewer.
- Autres : carte fichier + téléchargement.

## 12. Format export Swift futur

Format recommandé :

```text
budget-jr-export.zip
├── manifest.json
├── data/
│   ├── tenants.json
│   ├── rent_payments.json
│   ├── tenant_debts.json
│   ├── dubai_parts.json
│   ├── dubai_sales.json
│   ├── dubai_expenses.json
│   ├── dubai_cash_movements.json
│   ├── businesses.json
│   ├── business_contacts.json
│   ├── business_items.json
│   ├── business_transactions.json
│   ├── business_bookings.json
│   ├── business_tasks.json
│   ├── budget_entries.json
│   ├── subscriptions.json
│   ├── trips.json
│   ├── flights.json
│   ├── accommodations.json
│   ├── trip_activities.json
│   ├── trip_checklist_items.json
│   └── attachments.json
└── attachments/
    ├── attachment_000001.jpg
    └── attachment_000002.pdf
```

`manifest.json` doit contenir :

- format.
- version.
- exportedAt.
- sourceApp.
- sourceAppVersion.
- sourcePlatform.
- exportMode.
- entity counts.
- attachment counts.
- checksums.
- ordered import plan.

Un exemple est dans `MIGRATION_FORMAT_DRAFT.json`.

## 13. Migration batches

Table recommandée : `migration_batches`.

Colonnes :

- `id`
- `user_id`
- `export_version`
- `exported_at`
- `imported_at`
- `source_app_version`
- `file_hash`
- `status`
- `entities_count`
- `attachments_count`
- `error_log`
- `created_at`
- `updated_at`

Intérêt :

- Tracer chaque import.
- Empêcher le même fichier d'être importé plusieurs fois si souhaité.
- Voir précisément ce qui a été importé.
- Reprendre ou nettoyer un import échoué.

Contrainte utile :

```sql
unique(user_id, file_hash)
```

Cela évite de réimporter exactement le même ZIP.

## 14. Workflow import PWA futur

1. Utilisateur connecté.
2. Sélection du `.zip`.
3. Calcul hash local/serveur.
4. Validation structure ZIP.
5. Lecture `manifest.json`.
6. Vérification `format` et `version`.
7. Contrôle des counts.
8. Affichage résumé.
9. Confirmation utilisateur.
10. Création `migration_batches(status='pending')`.
11. Passage `status='running'`.
12. Import parents.
13. Import enfants.
14. Upload attachments.
15. Vérification counts.
16. Vérification relations.
17. Passage `status='completed'`.
18. Rapport final.

Ordre d'import des 21 modèles :

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

Ordre optimisé réel :

1. `tenants`
2. `businesses`
3. `dubai_parts`
4. `trips`
5. indépendants : `budget_entries`, `subscriptions`, `dubai_cash_movements`
6. enfants tenants : `rent_payments`, `tenant_debts`
7. enfants business : contacts, items, transactions, bookings, tasks
8. enfants Dubaï : sales, expenses
9. enfants trips : flights, accommodations, activities, checklist
10. attachments + upload Storage

## 15. Transaction / rollback

Problème :

Supabase client depuis navigateur ne permet pas de garantir facilement un import massif 100 % atomique avec fichiers Storage.

Architecture recommandée :

- Import SQL via RPC PostgreSQL transactionnelle pour les données JSON.
- Upload Storage traité après import SQL ou en étape staged.
- `migration_batches.status` trace l'état.
- Chaque ligne importée porte `migration_batch_id`.
- En cas d'échec, un bouton "Nettoyer l'import échoué" supprime les lignes du batch et les fichiers uploadés.

Approche V1 robuste :

1. Côté frontend : lire/valider ZIP, préparer payload JSON sans blobs.
2. Côté serveur/API route Next ou Edge Function : appeler une RPC `import_budget_jr_batch`.
3. RPC PostgreSQL :
   - démarre transaction implicite.
   - upsert par `(user_id, legacy_id)`.
   - crée mapping legacy -> uuid.
   - insère parents/enfants.
   - renvoie rapport.
4. Upload attachments :
   - soit avant SQL en staging path,
   - soit après SQL avec cleanup si échec.

Recommandation :

- Pour V1, importer d'abord metadata SQL et uploader les fichiers juste après, avec batch status `attachments_uploading`.
- Si un upload échoue, batch `partial_failed`, puis outil de reprise.
- Ne pas laisser d'état invisible : toujours afficher un rapport.

## 16. Types financiers

Swift utilise `Double`. PostgreSQL doit utiliser `numeric`, pas `double precision`, pour éviter les erreurs financières.

Convention recommandée :

- EUR/AED/USD : `numeric(14,2)`.
- FCFA : `numeric(14,0)` possible, mais pour homogénéité multi-devise utiliser `numeric(14,2)`.
- Taux de conversion : `numeric(18,8)`.
- Pourcentages/ratios : calculés, pas stockés, ou `numeric(8,4)` si nécessaire.

Tables concernées :

- `monthly_rent numeric(14,2)`
- `amount_due numeric(14,2)`
- `amount_received numeric(14,2)`
- `amount numeric(14,2)`
- `purchase_price_amount numeric(14,2)`
- `target_sale_price_amount numeric(14,2)`
- `unit_sale_price_amount numeric(14,2)`
- `price numeric(14,2)`
- `target_budget numeric(14,2)`

Décision :

- Stocker les montants tels que saisis dans leur devise d'origine.
- Ne pas écraser les devises d'origine par conversion.
- Convertir pour affichage et dashboard via fonctions domaine.

## 17. Dates et timezone

Règles :

- Dates métier sans heure : `date`.
- Instants avec heure : `timestamptz`.
- Création/import/update : `timestamptz`.
- Ne pas stocker de date locale dans `timestamptz` si l'heure n'a pas de sens métier.

Mapping recommandé :

| Champ Swift | SQL |
|---|---|
| `createdAt` | `timestamptz` |
| `date` transaction/mouvement | `date` si pas d'heure importante, sinon `timestamptz` |
| `departDate`, `arriveDate` Flight | `timestamptz` |
| `startDate`, `endDate` Trip | `date` |
| `startDate`, `endDate` Accommodation | `date` |
| `activityDate` TripActivity | `timestamptz` |
| `paidDate` RentPayment | `date` |
| `dueDay` Subscription/Tenant | `integer` |

Pour éviter le bug "31 août -> 30 août" :

- Les champs `date` doivent être sérialisés en `YYYY-MM-DD`, sans conversion timezone.
- Les champs `timestamptz` doivent être sérialisés ISO 8601 UTC.
- L'UI doit convertir uniquement à l'affichage.

## 18. Calculs métier : lieu d'exécution

### Budget

Lieu recommandé :

- Shared TypeScript domain functions.
- Requêtes Supabase simples.
- Éventuellement vue SQL pour dashboard plus tard.

Ne pas stocker :

- `confirmedBalance`
- `projectedBalance`

### Loyers

Lieu recommandé :

- TypeScript domain function pour V1.

Pourquoi :

- Échelle faible.
- Calcul récursif limité à 36 mois dans Swift.
- Plus facile de garantir parité avec Swift.

Options rejetées V1 :

- CTE recursive SQL : puissant mais plus dur à maintenir.
- Stocker le report : risque de désynchronisation.

### Dubaï

Lieu recommandé :

- Shared TypeScript domain functions pour parité Swift.
- Vue SQL optionnelle plus tard pour dashboard si performance.

Calculs :

- Conversions.
- Totaux par devise.
- Résultat actuel.
- Stock réel restant.
- Marges théoriques/réelles.

Ne pas stocker :

- Résultats agrégés.
- Ratios.
- Totaux dashboard.

### Trips

Lieu recommandé :

- TypeScript domain functions.

Calculs :

- `flightsTotal`
- `accommodationsTotal`
- `activitiesTotal`
- `totalBudget`
- `preparationScore`

### Business

Lieu recommandé :

- TypeScript domain functions.

Calculs :

- `stockValue`
- `potentialRevenue`
- CA.
- Marge.
- Tâches ouvertes.

## 19. Loyers et récursivité

Calcul Swift :

- `carryOverForMonth` remonte mois par mois.
- Stop avant mois de création.
- Limite 36 mois.
- Retourne `max(prevDue - prevReceived, 0)`.

Comparaison :

| Option | Avantage | Risque |
|---|---|---|
| TypeScript | Simple, proche Swift, testable | nécessite charger paiements/dettes du tenant |
| RPC PostgreSQL | centralisé serveur | plus long à écrire/tester |
| Valeur stockée | rapide | désynchronisation possible |
| CTE recursive | robuste SQL | complexité inutile V1 |

Choix recommandé :

- TypeScript V1 avec limite 36 mois identique.
- Tests parity avec locataire créé en cours d'année, dettes non payées, paiement partiel.

## 20. Architecture Dubaï cible

À préserver absolument :

- Devise d'origine.
- Devise d'affichage.
- Valeurs théoriques.
- Valeurs réelles.
- Cash in.
- Cash out.
- Withdrawals.
- Dépenses liées.
- Dépenses globales.
- Ventes.
- Stock acheté/vendu/restant.
- Revenu projeté.

Tables :

- `dubai_parts`
- `dubai_sales`
- `dubai_expenses`
- `dubai_cash_movements`

Montants :

- `dubai_sales.unit_sale_price_amount` + `currency`.
- `dubai_expenses.amount` + `currency`.
- `dubai_cash_movements.amount` + `currency`.
- `dubai_parts.purchase_price_aed` et `target_sale_price_aed` peuvent rester AED car l'achat/cible Swift est conçu en AED.

Calculs :

- `originTotals`: groupement par devise brute.
- `displayTotals`: conversion vers préférence `dubai_display_currency`.
- `planned`: seulement mouvements `status = 'planned'`.
- `done`: mouvements réalisés.

Préférences :

- `user_preferences.dubai_display_currency`, synchronisé.

## 21. Préférences utilisateur

Synchronisé compte :

- `dubai_display_currency`
- futur : préférences dashboard, format devise, modules visibles.

Local appareil :

- onboarding PWA vu.
- prompt installation PWA ignoré.
- état UI temporaire.

À ignorer V1 :

- `app_theme` tant que l'UI Swift actuelle ne l'expose pas réellement.
- `budget_selected_bucket` car lié à ancien Budget mort.

## 22. Offline

Objectif final : tolérer une perte réseau sans créer deux sources de vérité incontrôlables.

V1 :

- Supabase online source de vérité.
- TanStack Query cache.
- UI affiche données cache en lecture.
- Mutations désactivées ou mises en attente très simple si offline.

V2 :

- IndexedDB.
- Queue de mutations.
- IDs client temporaires.
- Résolution de conflits.
- Indicateur sync.

Décision :

- Ne pas construire V2 au démarrage.
- Construire d'abord une PWA fiable online.

## 23. State management

Choix recommandé :

- TanStack Query pour server state.
- React state local pour UI de formulaires/sheets.
- React Context minimal pour session/theme/layout si nécessaire.
- Pas de Redux.
- Pas de Zustand en V1 sauf besoin clair après implémentation.

Pourquoi :

- Les données viennent majoritairement de Supabase.
- Les calculs métier peuvent être purs.
- Les formulaires peuvent rester locaux.

## 24. Validation

Swift actuel :

- `FormValidator.requireNonEmpty`
- `requirePositive`
- `requirePositiveInt`

PWA :

- Zod pour validation domaine/formulaire.
- Contraintes SQL pour intégrité minimale.
- UI consomme les erreurs Zod.

Architecture :

```text
schemas/
├── budget.ts
├── tenants.ts
├── dubai.ts
├── businesses.ts
├── trips.ts
└── migration.ts
```

Règle :

- Une validation métier doit être définie dans Zod puis réutilisée côté formulaire/service.
- SQL protège les invariants fondamentaux : non-null, montants >= 0, FK, checks enum-like.

## 25. CSV Revolut

Future feature :

```text
features/budget/csv/
├── revolutParser.ts
├── budgetCsvMapper.ts
├── CsvPreviewDialog.tsx
└── importBudgetCsv.ts
```

Flux :

1. Upload CSV local navigateur.
2. Parser côté client.
3. Preview lignes.
4. Catégorisation automatique identique Swift.
5. Correction manuelle.
6. Import en `budget_entries`.

À préserver :

- Colonnes `type`, `description`, `montant`/`amount`, `frais`/`fees`, `datedefin`/`date`/`datededebut`.
- Mapping catégories Swift.
- Scope par défaut `"Perso"`.

## 26. Airport Database

Choix recommandé :

- Fichier TypeScript statique dans `public/data/airports.json` ou `lib/constants/airports.ts`.

Préférence :

- `lib/constants/airports.ts` pour typage et recherche directe.

Pourquoi :

- Données non utilisateur.
- Fonctionnement offline possible.
- Pas besoin de table Supabase.
- Pas de coûts réseau.

Recherche :

- Reproduire tri Swift :
  - code exact.
  - prefix code/ville.
  - aéroport primaire.
  - ville.
- Limite résultats : 6.

## 27. Design system Web

Objectif :

Reproduire le design Swift actuel, pas le réinterpréter.

Organisation :

```text
components/ui/
├── Button.tsx
├── Card.tsx
├── Sheet.tsx
├── TextField.tsx
├── AmountField.tsx
├── Picker.tsx
├── DateField.tsx
├── Badge.tsx
├── SegmentedControl.tsx
├── PageTitleBubble.tsx
├── BottomTabBar.tsx
└── EmptyState.tsx
```

Tokens Tailwind :

- Accent JR violet proche `rgb(128 79 242)`.
- Fond clair `rgb(245 247 250)` / blanc.
- Cards blanches.
- Strokes noirs 4-6 %.
- Ombres faibles.
- Radius cards 16-24 selon équivalent Swift.
- Icônes pastel.
- Typographie system rounded impossible exactement sur web ; utiliser `system-ui`, éventuellement `Inter` si validé.

Patterns :

- Bulle titre blanche Business/Voyages/Dubaï.
- Custom bottom tab bar.
- Sheets/modales pour Add/Edit.
- Cards premium.
- Inputs lisibles.

## 28. Routing Next.js

Routes proposées :

```text
/
/login
/signup
/reset-password
/business
/business/list
/business/new
/business/[businessId]
/business/tenants
/business/tenants/[tenantId]
/business/dubai
/business/dubai/[partId]
/budget
/trips
/trips/[tripId]
/settings
/settings/profile
/settings/migration
```

Formulaires :

- V1 : sheets client pour rester proche SwiftUI.
- Routes directes seulement pour écrans profonds ou partage interne.
- Les Add/Edit critiques peuvent utiliser query params :
  - `/budget?new=transaction`
  - `/trips/[id]?editFlight=...`

Choix :

- Garder les détails comme routes.
- Garder la création/édition comme sheets sur desktop/mobile.

## 29. Tests

### Unitaires

Calculs métier :

- Budget confirmé/potentiel.
- Copie mois 31 -> mois cible.
- Loyers report 36 mois.
- Dubaï multi-devises.
- Trips totals/preparationScore.
- Business stock/marge.

### Intégration

- Repositories Supabase.
- Insert/update/delete par feature.
- Upload/download attachments.

### RLS

Cas obligatoires :

- User A ne voit pas User B.
- User A ne peut pas insérer avec `user_id` de User B.
- User A ne peut pas modifier `user_id`.
- Storage path User B inaccessible.

### Migration

Fixtures :

- Budget avec confirmé/en attente/incertain.
- Tenant avec retard plusieurs mois, dette, paiement partiel.
- Dubaï multi-devises, charges, cash movements, attachments.
- Trip avec vol/logement/activité/checklist.
- Business avec modules, contacts, stock, tâches.

### Parity

Créer `MIGRATION_PARITY.md` pour suivre :

- écran.
- fonctionnalité.
- calcul.
- formulaire.
- source Swift.
- implémentation PWA.
- statut.
- différence acceptée.

## 30. Sécurité

Checklist :

- RLS activé sur toutes les tables privées.
- Storage privé.
- Policies Storage par `auth.uid()`.
- Service role jamais côté frontend.
- Validation MIME.
- Limites taille upload.
- Extension fichier nettoyée.
- Chemins Storage non prédictifs hors user_id/attachment_id.
- Signed URLs courtes.
- Rate limiting sur routes import/upload.
- Validation Zod de tous les payloads.
- Contraintes SQL pour intégrité.
- Pas de données jnor7 hardcodées.
- Vercel env vars séparées par environnement.

## 31. Environnements

Environnements recommandés :

1. Local dev
   - Next.js local.
   - Supabase local CLI si possible.
   - Données fixtures.

2. Supabase dev
   - Projet dev cloud.
   - Import de faux exports.
   - Tests RLS.

3. Vercel preview
   - Branch previews.
   - Supabase dev uniquement.

4. Production
   - Supabase production séparé.
   - Vercel production.
   - Import données réelles seulement après validation sur dev.

Règle :

- Ne jamais tester la première migration de données réelles directement en production.

## 32. Décisions encore à prendre

Avant Phase 3 :

- Export unique ou imports multiples successifs ?
- Option A legacy_id export-only ou Option B migrationID Swift plus tard ?
- Limite taille fichiers attachments.
- Faut-il garder `app_theme` dans la PWA V1 ou l'ignorer ?
- Supabase local obligatoire ou projet dev cloud suffisant ?
- Les formulaires Add/Edit doivent-ils être seulement sheets ou aussi routes directes ?
- Faut-il importer les vieux blocs morts Swift dans la matrice parity comme "non reproduit" ?

## 33. Risques principaux

1. Identifiants Swift non stables.
   - Mitigation : `legacy_id`, batch, import idempotent, réflexion Option B avant migration réelle.

2. Attachments lourds.
   - Mitigation : ZIP + fichiers séparés + Supabase Storage privé.

3. Calculs Dubaï multi-devises.
   - Mitigation : tests parity avec fixtures exactes.

4. Loyers récursifs.
   - Mitigation : fonction TypeScript pure alignée Swift + fixtures retard.

5. Refactor web trop gros.
   - Mitigation : features isolées, pas de gros composant central.

6. RLS mal configuré.
   - Mitigation : tests RLS obligatoires avant données réelles.

7. Migration partielle.
   - Mitigation : `migration_batches`, status, cleanup par batch, rapport final.

## 34. Ordre recommandé pour Phase 3

1. Créer repo Next.js minimal.
2. Installer TypeScript/Tailwind/Supabase client/TanStack Query/Zod.
3. Créer design tokens et shell app.
4. Créer Supabase schema local/dev uniquement.
5. Écrire fonctions domaine Budget/Loyers/Dubaï avec tests unitaires.
6. Construire auth + profiles.
7. Construire Budget PWA V1.
8. Construire migration parser mock avec fixture JSON.
9. Construire import ZIP en dev.
10. Seulement ensuite brancher export Swift réel.

## 35. Conclusion

L'architecture cible doit être feature-first, sécurisée par RLS, proche des modèles SwiftData, et pensée pour une migration idempotente.

Le point le plus sensible reste l'identité historique des données Swift. Sans UUID métier actuel, l'import unique est simple, mais l'import répété fiable exige soit une stratégie de déduplication heuristique, soit l'ajout ultérieur d'un `migrationID` stable dans Swift après sauvegarde.

PHASE 2 ARCHITECTURE — DOCUMENT PRINCIPAL PRÊT POUR VALIDATION
