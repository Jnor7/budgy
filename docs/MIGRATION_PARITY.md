# Parité Budget JR → Budgy

Statuts : ✅ implémenté, ⚠️ partiel, ❌ non implémenté.

| Domaine | Source Swift | Budgy | Statut | Différence connue |
|---|---|---|---|---|
| Navigation 4 onglets | `ContentView`, `JRBottomTabBubble` | `components/app-shell.tsx` | ✅ | Icônes Lucide équivalentes aux SF Symbols |
| Accueil | `AccueilView_Enhanced` | `app/(app)/page.tsx` | ✅ | Ensemble principal des cartes porté; quelques insights secondaires restent à enrichir |
| Budget mensuel | `BudgetView_Enhanced` | `app/(app)/budget/page.tsx` | ✅ | Calculs réalisé/potentiel identiques |
| Statuts Budget | `BudgetEntry.isConfirmed` | `lib/domain/budget.ts` | ✅ | `recu`, `peu`, `non` préservés |
| Copier le mois | `copyCurrentMonthToNextMonth` | Budget page | ✅ | Jour borné au dernier jour et anti-doublon |
| CSV Revolut | `CSVImporter.swift` | Budget page | ⚠️ | Import simple; parsing RFC CSV avec guillemets à compléter |
| Abonnements | `Subscription` | `/subscriptions`, Accueil, repository | ✅ | CRUD, actif/inactif, total mensuel et prochain prélèvement |
| Loyers | `TenantViews.swift` | `rentals` (ex `business/tenants`, redirigé) | ✅ | Paiements, remise à zéro, dettes et reports présents |
| Report 36 mois | `carryOverForMonth` | `lib/domain/tenants.ts` | ✅ | Couvert par tests métier — **non modifié en V2** |
| Business Home | `BusinessHomeView` | `business/page.tsx` | ✅ | Cartes Loyers, Dubaï et business configurables |
| Business configurable | `Business*` | `business/generic` | ✅ | 11 flags et sous-domaines actifs portés |
| Contacts | `BusinessContact` | détail business | ✅ | Téléphone/e-mail non exposés dans le formulaire compact actuel |
| Stock générique | `BusinessItem` | détail business | ✅ | SKU et prix de vente restent à exposer |
| Transactions business | `BusinessTransaction` | détail business | ✅ | Revenu/dépense et KPI intégrés |
| Réservations | `BusinessBooking` | détail business | ✅ | Statut conservé, Picker visuel à enrichir |
| Tâches | `BusinessTask` | détail business | ✅ | Priorités basse/moyenne/haute préservées |
| Dubaï théorique | `DubaiPart` | `lib/domain/dubai.ts`, page Dubaï | ✅ | Stock manuel séparé des ventes réelles |
| Dubaï réel | ventes, charges, cash | page Dubaï | ✅ | Création/suppression présente; édition détaillée des ventes/charges à compléter |
| Devises Dubaï | `DubaiCurrencyConverter` | `lib/domain/dubai.ts` | ✅ | Taux exacts et pivot EUR, alias CFA accepté côté domaine |
| Pièces jointes | `Attachment` | `AttachmentManager`, Storage privé | ✅ | Upload, aperçu image/PDF, téléchargement et suppression pour Business/Dubaï |
| Voyages | `Trip` | `trips` | ✅ | CRUD, budget, détail et statut terminé |
| Vols | `Flight` | détail voyage | ✅ | AirportPicker offline inclus |
| Logements | `Accommodation` | détail voyage | ✅ | Création, édition, suppression |
| Activités | `TripActivity` | détail voyage | ✅ | Création, édition, suppression |
| Check-list rapide | `TripChecklistItem` | détail voyage | ✅ | Tap ajoute/retire et titre personnalisé optionnel |
| Voyage → Budget | formulaires Voyage | détail voyage | ✅ | Création initiale uniquement, sans synchronisation ultérieure |
| AirportDatabase | `AirportDatabase.swift` | `lib/airports/airports.ts` | ✅ | 207 codes IATA uniques portés depuis Swift |
| Auth | nouvelle cible PWA | `/auth`, `proxy.ts`, réglages | ✅ | Session, callback, reset, garde des routes et déconnexion; validation distante requise |
| RLS | architecture Phase 2 | migrations SQL | ✅ | SELECT/INSERT/UPDATE/DELETE par `auth.uid()` |
| Import ZIP | architecture Phase 2 | `/settings/migration`, RPC SQL | ✅ | Checksum, transaction DB, anti-doublon, upload et nettoyage Storage; validation distante requise |
| PWA | nouvelle cible PWA | manifest + service worker | ✅ | Cache shell simple, pas de synchro offline complexe |
| Onboarding | `OnboardingView.swift` | `/onboarding`, `/settings` | ✅ | Trois étapes, cookie persistant et relance manuelle |

## Décision de vérité

Une ligne n'est marquée ✅ que si un parcours fonctionnel existe dans l'interface ou si la fonction métier/SQL est effectivement présente et testée. Les éléments ⚠️ ne doivent pas être considérés prêts pour une migration de production sans l'étape indiquée.

---

## Parité V1 → V2 (§73 : aucune régression)

Toutes les lignes ✅ ci-dessus restent ✅ après la V2. Aucune fonction métier historique
n'a été réécrite ; seule l'architecture autour a évolué. Vérification ligne par ligne :

| Fonction historique | Statut V2 | Preuve |
|---|---|---|
| `budgetSummary`, `isConfirmed`, `displayPotential` | Inchangé, code source identique | `lib/domain/budget.ts` (V2 y ajoute `expenseBreakdown`/`monthSpent`, en aval, sans toucher aux fonctions existantes) |
| `carryOverForMonth`, `totalDueForMonth` | Inchangé | `lib/domain/tenants.ts` non modifié ; `tests/tenants.test.ts` (4 tests) toujours au vert |
| `partMetrics`, `dubaiCashSummary`, `convertCurrency` | Inchangé | `lib/domain/dubai.ts` non modifié ; `tests/dubai.test.ts` (3 tests) toujours au vert |
| `tripTotals` | Inchangé | `lib/domain/trips.ts` non modifié ; `tests/trips.test.ts` toujours au vert |
| Import ZIP Budget JR (`import_budgy_archive`) | Inchangé | Migration `202608180006` non modifiée ; `tests/migration.test.ts` toujours au vert |
| RLS des 21 tables V1 (`budget_entries`, `tenants`, `businesses`, `dubai_*`, `attachments`, etc.) | Inchangé | Aucune migration V2 ne touche à ces policies ; seules `trips` et ses 4 tables filles sont réécrites |
| Business Dubaï (stock, ventes, cash, devises) | Inchangé, fonctionnellement identique | `/business/dubai` conserve son code d'origine ; le template `import_export` est une classification pour les *nouveaux* business, pas une réécriture de l'existant |
| Auth, PWA, onboarding cookie | Inchangé dans son mécanisme | `proxy.ts` non modifié ; l'onboarding gagne un écran de sélection de modules mais garde le même cookie `budgy_onboarding_done` |

**Suite de tests** : 17 tests V1 + 27 tests V2 = 44/44 au vert (`npm test`).
**Build** : `npm run lint`, `npm run typecheck`, `npm run build` passent tous sans erreur.

Aucune ligne de ce tableau parité n'est passée de ✅ à ⚠️ ou ❌ suite à la V2.

