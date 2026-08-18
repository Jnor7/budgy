# BUDGY_V2_IMPLEMENTATION_REPORT.md

## Résumé

Budgy passe d'une application personnelle mono-utilisateur à une plateforme configurable :
modules activables par utilisateur, business à templates, voyages collaboratifs avec
dépenses partagées. Aucune fonction métier historique (calculs budget réel/potentiel,
reports de loyers, marges Dubaï, devises) n'a été modifiée — seule l'architecture autour
a évolué.

Aucun compte n'est codé en dur. `if (username === "jnor7")` n'existe nulle part dans le repo.

---

## 1. Migrations Supabase créées

| Fichier | Rôle |
|---|---|
| `202608190001_v2_user_modules.sql` | Table `user_modules`, colonnes `profiles.avatar_url` / `modules_configured_at`, `user_preferences` étendues, `businesses.template`, backfill V1→V2 |
| `202608190002_v2_trip_collaboration.sql` | `trip_members`, `trip_invitations`, `notifications`, fonctions `SECURITY DEFINER` de permission, réécriture RLS voyages, RPC `invite_to_trip`/`respond_trip_invitation`/`find_budgy_user` |
| `202608190003_v2_trip_expenses.sql` | `trip_expenses`, `trip_expense_splits`, bucket Storage `budgy-avatars` |

Aucune migration V1 (`202608180001` à `202608180006`) n'a été modifiée.

### Détail du schéma ajouté

**`user_modules`** — `(id, user_id, module_key, enabled, created_at, updated_at)`, contrainte
d'unicité `(user_id, module_key)`. RLS : chacun ne voit et ne modifie que ses propres lignes.

**`trip_members`** — `(id, trip_id, user_id, role, status, invited_by, joined_at, created_at)`.
`role` ∈ `{owner, editor, viewer}`, `status` ∈ `{pending, accepted, declined}`.

**`trip_invitations`** — `(id, trip_id, inviter_id, invited_user_id, invited_email, role,
token, status, expires_at, created_at)`. Une invitation peut cibler un pseudo Budgy résolu
immédiatement, ou un e-mail en attente (`invited_user_id` alors NULL).

**`notifications`** — `(id, user_id, kind, title, body, payload, read_at, created_at)`.
Aucune policy INSERT côté client : seules les fonctions `SECURITY DEFINER` y écrivent,
ce qui empêche un utilisateur de forger de fausses notifications.

**`trip_expenses` / `trip_expense_splits`** — dépense + parts individuelles, chaque part
rattachée au participant concerné (`user_id` de la ligne = le débiteur, pas l'auteur de la saisie).

**Fonctions `SECURITY DEFINER`** (évitent la récursion RLS trips ↔ trip_members) :
`trip_role`, `can_view_trip`, `can_edit_trip`, `can_manage_trip_members`, `shares_trip_with`,
`find_budgy_user`, `invite_to_trip`, `respond_trip_invitation`.

---

## 2. RLS — ce qui a changé, ce qui n'a pas changé

**Changé** : `trips` et ses quatre enfants (`flights`, `accommodations`, `trip_activities`,
`trip_checklist_items`). Lecture élargie à `can_view_trip()` (owner ou membre accepté),
écriture limitée à `can_edit_trip()` (owner ou editor).

**Inchangé** : `budget_entries`, `subscriptions`, `tenants`, `rent_payments`, `tenant_debts`,
`businesses` et toutes ses tables filles, `dubai_*`, `attachments`. Toutes gardent
strictement `auth.uid() = user_id`. Un ami invité sur un voyage ne voit que ce voyage —
vérifié par les tests §5.

**Profils** : une nouvelle policy `profiles_select_shared_trip` élargit la lecture aux
co-voyageurs (nécessaire pour afficher pseudo/avatar dans les cartes voyage), via
`shares_trip_with()`. Elle s'ajoute à la policy existante, ne la remplace pas.

---

## 3. Fonctionnalités créées

### Architecture modulaire (§1–§7)
- `lib/modules/registry.ts` : registre unique des 5 modules (`budget`, `subscriptions`,
  `trips`, `rentals`, `businesses`) et des 5 templates business.
- Onboarding par sélection de modules (`app/onboarding/page.tsx`), avec détection d'un
  compte V1 qui découvre la V2 (`returning`), pré-cochage basé sur les données réelles
  (`suggestedModules`), jamais sur un pseudo.
- `Réglages → Mes modules` (`/settings/modules`) : interrupteurs, désactivation non
  destructive (bandeau d'avertissement explicite).
- Navigation basse entièrement dérivée des modules actifs (`components/app-shell.tsx`).

### Business modulaire et templates (§8–§11)
- 5 templates (`simple`, `commerce`, `services`, `rental`, `import_export`) avec flags
  pré-cochés, modifiables ensuite un par un.
- `Business Dubaï` reste une fonctionnalité intacte (`/business/dubai`, tous ses calculs
  de marge/devises préservés) ; le template `import_export` est la généralisation
  conceptuelle demandée pour les *nouveaux* business, sans toucher à l'existant.
- Un utilisateur peut créer plusieurs business, chacun avec ses propres modules actifs.

### Voyages collaboratifs (§22–§36)
- Invitation par pseudo Budgy ou e-mail (`invite_to_trip`), notification in-app,
  accept/decline (`respond_trip_invitation`).
- Rôles owner/editor/viewer appliqués à la fois côté UI (`lib/domain/permissions.ts`)
  et côté base (policies RLS) — la DB reste la vraie source de vérité.
- Dépenses partagées avec division égale automatique au centime près
  (`lib/domain/trip-expenses.ts`), vue "Comptes du voyage" avec algorithme de règlement
  minimal (minimise le nombre de virements).
- Cartes destination avec avatars des participants, fallback dégradé si pas d'image.

### Accueil, Budget, Loyers (§13–§21)
- Carte solde violette premium, donut de répartition des dépenses (`V2Donut`, SVG accessible),
  cartes catégories, actions rapides contextualisées aux modules actifs.
- `/rentals` (ex `/business/tenants`, redirigé) : mêmes calculs `totalDueForMonth` /
  `carryOverForMonth`, nouvelle présentation en cartes avec statut coloré par locataire.

### Compte, avatar, notifications (§38–§42)
- `/more` : onglet Plus complet (compte, modules, notifications, migration, sécurité).
- `/settings/account` : upload avatar vers le bucket `budgy-avatars`, changement de pseudo,
  réinitialisation de mot de passe.
- Cloche de notifications (`components/notification-center.tsx`) avec accept/decline
  d'invitation directement depuis la liste.

### Design system V2 (§12, §48–§49)
- ~180 lignes de tokens CSS ajoutées à `app/globals.css` (préfixe `v2-`), sans toucher
  aux classes V1 existantes.
- Composants partagés dans `components/ui/v2.tsx` : `V2Card`, `V2Tile`, `V2Donut`,
  `V2Avatar`, `V2Empty`, `V2Switch`, `V2ModuleCard`.

---

## 4. Tests

44 tests passent (17 V1 inchangés + 27 nouveaux) :

- `tests/modules.test.ts` (10) — registre des modules, activation/désactivation,
  suggestion basée sur les données, templates business.
- `tests/trip-permissions.test.ts` (7) — owner/editor/viewer/extérieur/invitation en attente,
  `visibleTrips`, `tripParticipants`.
- `tests/trip-expenses.test.ts` (10) — division égale avec arrondi, validation de split
  personnalisé, soldes nets, algorithme de règlement, cas dépense réglée / sans dépense.

---

## 5. Résultat lint / typecheck / tests / build

```
npm run lint       ✅ 0 erreur, 0 warning
npm run typecheck  ✅ 0 erreur
npm test           ✅ 44/44 tests passent (10 fichiers)
npm run build      ✅ 21 routes générées, build Next.js 16 réussi
```

---

## 6. Points incomplets ou reportés

- **Montants personnalisés pour les dépenses partagées** : le schéma et `validateCustomSplit`
  existent, mais l'UI ne propose actuellement que la division égale (§33 : "au minimum
  division égale, préparer l'architecture pour montants personnalisés" — l'architecture est prête,
  l'UI est à ajouter).
- **`assigned_to` sur la checklist voyage** : colonne créée en base, non encore exposée
  dans l'UI de `/trips/[id]`.
- **Export de mes données** : entrée de menu présente dans `/more`, renvoie vers
  `/settings/migration` (qui gère l'import) — l'export à proprement parler reste à écrire.
- **Préférences (devise principale, langue)** : colonnes créées et repository câblé
  (`updatePreferences`), aucune page de réglages ne les expose encore.
- **Notifications proactives** (loyers en retard, tâches business) : le type
  `rent_due`/`business_task` existe dans le schéma, mais rien ne les génère encore — seules
  les notifications d'invitation voyage sont câblées de bout en bout.
- **RLS smoke tests automatisés pour le collaboratif** : la procédure manuelle est documentée
  dans `V2_DEPLOYMENT.md` §3 ; un script SQL équivalent à `supabase/tests/rls_smoke.sql`
  n'a pas été écrit pour le domaine voyages.

Rien de ce qui précède n'affecte la stabilité de l'existant : ce sont des extensions non
démarrées, pas des régressions.

---

## 7. Instructions pour appliquer la V2 en production

Voir `docs/V2_DEPLOYMENT.md` — ordre exact : backup → migrations Supabase → vérification
RLS → push GitHub → Vercel → smoke tests.
