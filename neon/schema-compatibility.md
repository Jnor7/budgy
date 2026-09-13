# Compatibilité du schéma Budgy avec Neon

Source : audit statique des 15 migrations du dépôt. Aucun état distant n'a été interrogé.

## 1. Cartographie des 33 tables

Légende :

- **Auth direct** : au moins une FK vers `auth.users(id)`.
- **Storage** : contient une référence d'objet ou une URL Supabase Storage.
- **Realtime** : ajoutée à la publication `supabase_realtime`.
- **Import strict direct** : le schéma, les données et les contraintes peuvent être restaurés sans créer de substitut à `auth.users`.

| Table | Domaine | Auth direct | Storage | Realtime | Classe d'import |
|---|---|---:|---:|---:|---|
| `profiles` | Identité applicative | Oui | Avatar URL | Non | Avec adaptation Auth + Storage |
| `user_preferences` | Préférences | Oui | Non | Non | Avec adaptation Auth |
| `migration_batches` | Import historique | Oui | Non | Non | Avec adaptation Auth/RPC |
| `user_modules` | Navigation | Oui | Non | Non | Avec adaptation Auth |
| `budget_entries` | Budget | Oui | Non | Non | Avec adaptation Auth |
| `subscriptions` | Abonnements | Oui | Non | Non | Avec adaptation Auth |
| `tenants` | Locatif | Oui | Non | Non | Avec adaptation Auth |
| `rent_payments` | Locatif | Oui | Non | Non | Avec adaptation Auth |
| `tenant_debts` | Locatif | Oui | Non | Non | Avec adaptation Auth |
| `dubai_parts` | Dubaï | Oui | Non | Non | Avec adaptation Auth |
| `dubai_sales` | Dubaï | Oui | Non | Non | Avec adaptation Auth |
| `dubai_expenses` | Dubaï | Oui | Non | Non | Avec adaptation Auth |
| `dubai_cash_movements` | Dubaï | Oui | Non | Non | Avec adaptation Auth |
| `businesses` | Business | Oui | Non | Non | Avec adaptation Auth |
| `business_contacts` | Business | Oui | Non | Non | Avec adaptation Auth |
| `business_items` | Business | Oui | Non | Non | Avec adaptation Auth |
| `business_transactions` | Business | Oui | Non | Non | Avec adaptation Auth |
| `business_bookings` | Business | Oui | Non | Non | Avec adaptation Auth |
| `business_tasks` | Business | Oui | Non | Non | Avec adaptation Auth |
| `attachments` | Business/Dubaï | Oui | Chemin privé | Non | Avec adaptation Auth + Storage |
| `trips` | Travel | Oui | Non (cover Unsplash) | Oui | Avec adaptation Auth + Realtime |
| `flights` | Travel | Oui | Non | Oui | Avec adaptation Auth + Realtime |
| `accommodations` | Travel | Oui | Non | Oui | Avec adaptation Auth + Realtime |
| `trip_activities` | Travel | Oui | Non | Oui | Avec adaptation Auth + Realtime |
| `trip_checklist_items` | Travel | Oui (2 FK) | Non | Oui | Avec adaptation Auth + Realtime |
| `trip_members` | Travel | Oui (2 FK) | Non | Oui | Avec adaptation Auth + Realtime |
| `trip_invitations` | Travel | Oui (2 FK) | Non | Oui | Avec adaptation Auth + Realtime |
| `notifications` | Travel | Oui | Non | Oui | Avec adaptation Auth + Realtime |
| `trip_expenses` | Travel | Oui (2 FK) | Non | Oui | Avec adaptation Auth + Realtime |
| `trip_expense_splits` | Travel | Oui | Non | Oui | Avec adaptation Auth + Realtime |
| `travel_friend_requests` | Travel | Oui (2 FK) | Non | Oui | Avec adaptation Auth + Realtime |
| `travel_friends` | Travel | Oui (2 FK) | Non | Oui | Avec adaptation Auth + Realtime |
| `airports` | Référentiel | Non | Non | Non | Importable directement |

Résultat strict : **1 table (`airports`) est importable avec ses contraintes sans substitut Auth ; 32 tables sont bloquées par au moins une FK directe vers `auth.users`**. Les données des 33 tables restent transférables une fois la cible d'identité préparée.

### Classes transversales

- Tables applicatives PostgreSQL pures quant aux types et données : les 33 tables `public`.
- Tables dépendantes directement d'Auth : les 32 tables autres que `airports`.
- Tables dépendantes de Storage : `profiles`, `attachments`.
- Tables déclarées Realtime : `trips`, `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`, `trip_members`, `trip_invitations`, `notifications`, `trip_expenses`, `trip_expense_splits`, `travel_friend_requests`, `travel_friends`.
- Tables spécifiques Supabase hors inventaire des 33 : `auth.*`, `storage.buckets`, `storage.objects` et objets du schéma `realtime`.

## 2. Les 38 FK vers `auth.users`

### Cible recommandée

Ne pas faire pointer ces colonnes directement vers l'identifiant interne Neon Auth tant que la reprise exacte des UUID Supabase n'est pas garantie. La cible recommandée est une future table applicative canonique, par exemple `public.app_users(id uuid)`, liée de façon unique au `sub` Neon Auth (`text`). Toutes les lignes ci-dessous seraient donc reliées **indirectement** à Neon Auth.

| # | Table | Colonne | ON DELETE actuel | Cible Neon Auth à terme | Risque si `auth.users` disparaît |
|---:|---|---|---|---|---|
| 1 | `profiles` | `user_id` | CASCADE | Indirecte via UUID canonique | Profil impossible à restaurer avec la FK actuelle |
| 2 | `user_preferences` | `user_id` | CASCADE | Indirecte via UUID canonique | Préférences orphelines ou restauration bloquée |
| 3 | `migration_batches` | `user_id` | CASCADE | Indirecte via UUID canonique | Historique d'import bloqué |
| 4 | `user_modules` | `user_id` | CASCADE | Indirecte via UUID canonique | Configuration des modules bloquée |
| 5 | `tenants` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; données locatives bloquées |
| 6 | `rent_payments` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 7 | `tenant_debts` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 8 | `dubai_parts` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 9 | `dubai_sales` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 10 | `dubai_expenses` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 11 | `dubai_cash_movements` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 12 | `businesses` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 13 | `business_contacts` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 14 | `business_items` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 15 | `business_transactions` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 16 | `business_bookings` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 17 | `business_tasks` | `user_id` | CASCADE | Indirecte via UUID canonique | Propriétaire introuvable ; import bloqué |
| 18 | `budget_entries` | `user_id` | CASCADE | Indirecte via UUID canonique | Isolation financière et import bloqués |
| 19 | `subscriptions` | `user_id` | CASCADE | Indirecte via UUID canonique | Isolation financière et import bloqués |
| 20 | `trips` | `user_id` | CASCADE | Indirecte via UUID canonique | Owner perdu ; graphe Travel à risque de cascade |
| 21 | `flights` | `user_id` | CASCADE | Indirecte via UUID canonique | Auteur introuvable ; import bloqué |
| 22 | `accommodations` | `user_id` | CASCADE | Indirecte via UUID canonique | Auteur introuvable ; import bloqué |
| 23 | `trip_activities` | `user_id` | CASCADE | Indirecte via UUID canonique | Auteur introuvable ; import bloqué |
| 24 | `trip_checklist_items` | `user_id` | CASCADE | Indirecte via UUID canonique | Auteur introuvable ; import bloqué |
| 25 | `attachments` | `user_id` | CASCADE | Indirecte via UUID canonique | Métadonnées et accès Storage bloqués |
| 26 | `trip_checklist_items` | `assigned_to` | SET NULL | Indirecte via UUID canonique | Assignations perdues si la cible manque |
| 27 | `trip_members` | `user_id` | CASCADE | Indirecte via UUID canonique | Membres supprimés/perdus |
| 28 | `trip_members` | `invited_by` | SET NULL | Indirecte via UUID canonique | Provenance d'invitation perdue |
| 29 | `trip_invitations` | `inviter_id` | CASCADE | Indirecte via UUID canonique | Invitations supprimées/perdues |
| 30 | `trip_invitations` | `invited_user_id` | CASCADE | Indirecte via UUID canonique | Invitation ciblée impossible à relier |
| 31 | `notifications` | `user_id` | CASCADE | Indirecte via UUID canonique | Notifications supprimées/perdues |
| 32 | `trip_expenses` | `user_id` | CASCADE | Indirecte via UUID canonique | Auteur de dépense introuvable |
| 33 | `trip_expenses` | `paid_by` | CASCADE | Indirecte via UUID canonique | Payeur introuvable ; calculs compromis |
| 34 | `trip_expense_splits` | `user_id` | CASCADE | Indirecte via UUID canonique | Bénéficiaire de part introuvable |
| 35 | `travel_friend_requests` | `sender_id` | CASCADE | Indirecte via UUID canonique | Demande supprimée/perdue |
| 36 | `travel_friend_requests` | `recipient_id` | CASCADE | Indirecte via UUID canonique | Demande supprimée/perdue |
| 37 | `travel_friends` | `user_a` | CASCADE | Indirecte via UUID canonique | Relation d'amitié supprimée/perdue |
| 38 | `travel_friends` | `user_b` | CASCADE | Indirecte via UUID canonique | Relation d'amitié supprimée/perdue |

Attention : reproduire `ON DELETE CASCADE` directement sur une table Auth gérée rendrait la suppression d'un compte capable d'effacer une grande partie des données financières et collaboratives. La conception cible doit distinguer suppression/désactivation Auth et purge métier volontaire.

## 3. Stratégie de conservation des identifiants

### Constat

- Les 38 FK et toute la RLS supposent aujourd'hui un UUID identique à `auth.users.id`.
- Neon RLS expose `auth.user_id()` comme le claim JWT `sub` en `text`.
- L'extension officielle expose aussi `auth.uid()` en `uuid`, mais renvoie `NULL` si `sub` n'est pas un UUID valide.
- Neon Auth actuel repose sur Better Auth et conserve ses objets dans `neon_auth.*`.
- L'API actuelle permet de créer et gérer des utilisateurs, mais la documentation examinée ne garantit pas qu'un import peut imposer l'ancien UUID Supabase comme identifiant interne/claim `sub`.

### Stratégie recommandée

1. Garder sans modification chaque UUID Supabase dans toutes les tables Budgy.
2. Créer ultérieurement une table d'identité applicative canonique avec `id uuid` égal à l'ancien `auth.users.id`.
3. Ajouter une correspondance unique et non nulle après migration du compte : `neon_auth_sub text -> budgy_user_id uuid`.
4. Faire référencer les 38 FK par l'UUID canonique, pas directement par `neon_auth.user(id)`.
5. Résoudre l'utilisateur courant par une fonction serveur/RLS contrôlée, conceptuellement `budgy.current_user_id()`, qui lit `auth.user_id()` puis retourne le UUID canonique.
6. Faire échouer fermement la fonction (`NULL`, donc aucune policy ne passe) si la correspondance est absente ou ambiguë.
7. N'autoriser la création/mise à jour de la correspondance qu'à un rôle serveur minimal ; jamais au client authentifié.
8. Si un test officiel démontre plus tard que Neon Auth accepte et émet exactement l'ancien UUID comme `sub`, simplifier vers `auth.uid()` pourra être envisagé, mais seulement après preuve de parité.

Cette approche évite une réécriture de masse et découple l'identité de connexion de l'identité métier durable.

## 4. Analyse des 121 policies

Les 121 policies finales sont couvertes par les familles suivantes. « Direct » signifie une adaptation mécanique **vers la future fonction UUID canonique**, pas une substitution aveugle par `auth.user_id()`.

| Famille | Nombre | Supabase actuel | Neon cible | Classe |
|---|---:|---|---|---|
| 16 tables privées, CRUD complet | 64 | `auth.uid() = user_id` | `budgy.current_user_id() = user_id` | Remplacement direct après mapping |
| Profil propre, préférences, batches, modules | 6 | Comparaison directe à `auth.uid()` | Comparaison au UUID canonique | Remplacement direct après mapping |
| Profil visible en contexte Travel | 1 | Own + `shares_trip_with` + contexte ami | Helpers portés avec identité canonique | Complexe |
| Voyage principal | 4 | 3 owner directs, 1 `can_view_trip` | 3 directs + helper porté | Mixte |
| Enfants Travel (`flights`, `accommodations`, `trip_activities`, checklist) | 16 | `can_view_trip` / `can_edit_trip` | Helpers portés | Complexe |
| Membres et invitations | 8 | Helpers, rôles, acteur et destinataire | Helpers + identité + invariants transactionnels | Complexe |
| Notifications personnelles | 3 | `auth.uid() = user_id` | UUID canonique | Remplacement direct après mapping |
| Référentiel aéroports | 1 | Rôle `authenticated`, `using (true)` | Rôle Neon authentifié + RLS | Adaptation de rôle |
| Dépenses et répartitions | 8 | Helpers Travel + acteur/payeur/bénéficiaire | Helpers portés + UUID canonique | Complexe |
| Demandes et amis Travel | 2 | `auth.uid()` dans les deux côtés de la relation | UUID canonique dans les deux côtés | Adaptation contrôlée |
| Storage pièces jointes | 4 | `storage.objects`, bucket, dossier = `auth.uid()` | Règles du stockage cible | À exclure de PostgreSQL |
| Storage avatars | 4 | Lecture publique + écritures `storage.objects` | Règles du stockage cible | À exclure de PostgreSQL |
| **Total** | **121** |  |  |  |

### Matrice de remplacement

| Forme actuelle | Remplacement cible | Condition |
|---|---|---|
| `auth.uid() = user_id` | `budgy.current_user_id() = user_id` | Mapping unique et transaction authentifiée |
| `user_id = auth.uid()` | `user_id = budgy.current_user_id()` | Même condition |
| `auth.uid() IS NOT NULL` | `auth.user_id() IS NOT NULL` ou UUID canonique non nul | Choisir selon si seule l'authentification ou l'identité métier est requise |
| Paramètre par défaut `... uuid default auth.uid()` | Retirer le défaut ou utiliser la fonction UUID canonique | Ne pas caster librement un `text` en UUID |
| Rôle Supabase `authenticated` | Rôle fourni par Neon Data API/Neon RLS | Vérifier le mécanisme choisi ; Data API et Neon RLS ne se cumulent pas |
| `storage.foldername(...)` + `auth.uid()` | ACL/chemins du stockage cible | Non portable en policy PostgreSQL |

### Policies complexes à tester séparément

- visibilité d'un voyage et de ses enfants ;
- owner/editor/viewer et gestion des membres ;
- invitations par UUID ou e-mail ;
- visibilité des profils entre co-voyageurs ou amis ;
- dépenses, payeur et répartitions ;
- demandes d'ami et relation canonique ;
- policies s'appuyant sur une fonction `security definer`.

### Fonctions/RPC appelant l'identité Supabase

21 fonctions actives nécessitent une revue Auth :

`handle_new_user`, `import_budgy_archive`, `trip_role`, `can_view_trip`, `can_edit_trip`, `can_manage_trip_members`, `shares_trip_with`, `find_budgy_user`, `invite_to_trip`, `respond_trip_invitation`, `search_airports`, `list_airport_country_codes`, `has_travel_friend_context`, `find_travel_user`, `search_travel_profiles`, `send_travel_friend_request`, `respond_travel_friend_request`, `remove_travel_friend`, `notify_trip_expense_created`, `notify_trip_checklist_assignment`, `update_trip_cover`.

`set_updated_at` est la seule fonction active sans dépendance d'identité. `invite_to_trip` dépend en plus directement de `auth.users.email`. `handle_new_user` et son trigger sur `auth.users` doivent être remplacés, pas portés tels quels.

## 5. Extensions, triggers et objets

### Compatible

- Types PostgreSQL standards, UUID, JSONB, tableaux, dates et numériques.
- PK, index, contraintes uniques/check et FK entre tables `public`.
- Extension `pgcrypto`, supportée par Neon ; valider sa version dans la branche cible.
- `set_updated_at()` et ses trois triggers.
- Les deux triggers de notifications après adaptation de l'acteur courant.

### Incompatible tel quel

- `auth.users`, trigger `on_auth_user_created`, `auth.uid()` Supabase et métadonnées GoTrue.
- Rôles et grants Supabase `anon`, `authenticated`, `service_role` tels quels.
- `storage.buckets`, `storage.objects`, `storage.foldername()` et les 8 policies Storage.
- Publication `supabase_realtime` et service WebSocket Supabase.
- Exposition PostgREST automatique des RPC et Data API Supabase.

### À adapter

- 38 FK Auth.
- 113 policies métier.
- 21 fonctions/RPC liées à l'identité et 18 fonctions `security definer` à réauditer.
- Trigger de provisionnement de profil/préférences.
- Accès à l'e-mail Auth dans `invite_to_trip`.
- Contrats de transport `.from(...)` et `.rpc(...)`.

## 6. Storage et Realtime

### Storage

- `profiles.avatar_url` contient une URL publique du bucket `budgy-avatars`.
- `attachments.storage_path` contient le chemin d'un objet privé de `budgy-attachments`.
- Les lignes SQL sont importables, mais ne prouvent ni la présence de l'objet ni ses droits.
- Les schémas/tables Storage Supabase et leurs policies sont exclus de l'import Neon.

### Realtime

Les 12 tables publiées restent des tables PostgreSQL importables. Seule la publication/service Supabase est exclue. Sans remplacement, les écritures continuent mais la synchronisation multi-client disparaît pour covers, itinéraire, checklist, membres, dépenses et notifications.

## 7. Import Data Assistant

### Verdict

Méthode adaptée à une **répétition contrôlée** puisque la taille annoncée est inférieure à 10 Go. Elle effectue des contrôles de compatibilité et crée une branche avec les données, mais ne transforme pas les composants gérés Supabase.

### IMPORTABLE TEL QUEL

- table `public.airports`, ses données, index et contraintes ;
- types, séquences/valeurs par défaut PostgreSQL standard ;
- relations internes `public -> public` ;
- contraintes `check`, index simples/partiels et index d'expression compatibles ;
- `pgcrypto` sous réserve de la version cible ;
- fonction et triggers `set_updated_at`.

### IMPORTABLE AVEC ADAPTATION

- données des 32 autres tables après création d'une cible d'identité canonique ;
- leurs 38 FK après redirection vers cette cible ;
- 113 policies métier après port de l'identité et des rôles ;
- 21 fonctions/RPC et deux triggers de notification après adaptation Auth ;
- `profiles.avatar_url` et `attachments.storage_path`, en sachant que les objets sont migrés séparément ;
- 12 tables Realtime comme tables ordinaires, sans leur publication Supabase.

### À EXCLURE

- schémas `auth`, `storage`, `realtime` de Supabase ;
- schéma Neon Auth `neon_auth` de toute restauration source ;
- utilisateurs, identités, sessions et tokens Supabase du dump général ;
- buckets, objets et policies Storage ;
- publication `supabase_realtime` ;
- rôles/propriétaires/grants internes Supabase ;
- trigger `on_auth_user_created` et fonction `handle_new_user` dans leur forme actuelle ;
- secrets, clés API et configuration Vercel.

### Condition d'utilisation

Avant de lancer l'assistant lors d'une phase autorisée, vérifier qu'il permet d'exclure proprement ces schémas/objets dans le flux proposé. Si ce contrôle n'est pas suffisant, préférer un `pg_dump`/`pg_restore` sélectif hors pool, avec archive séparée et liste explicite des objets. Aucun de ces imports n'est lancé en phase 2.
