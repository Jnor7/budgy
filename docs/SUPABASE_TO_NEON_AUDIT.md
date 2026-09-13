# Budgy — Audit Supabase vers Neon (phase 1)

Date de l'audit : 13 septembre 2026  
Périmètre : dépôt local `Budgy-Git-V2`, code applicatif, migrations SQL et tests versionnés.  
Nature : audit statique uniquement. Aucune connexion à Supabase ou Neon, aucune migration et aucune modification de configuration n'ont été effectuées.

## 1. Résumé exécutif

Budgy ne dépend pas seulement d'un PostgreSQL hébergé par Supabase. L'application utilise les cinq briques suivantes :

1. PostgreSQL pour les données métier ;
2. Supabase Auth et ses sessions/cookies ;
3. la Data API Supabase (`from(...)`) et l'exposition PostgREST des RPC (`rpc(...)`) directement depuis le navigateur ;
4. Supabase Storage pour les pièces jointes et avatars ;
5. Supabase Realtime pour rafraîchir les voyages collaboratifs.

Inventaire issu des migrations versionnées :

- 33 tables métier dans le schéma `public` ;
- 0 vue et 0 vue matérialisée ;
- 22 fonctions PostgreSQL actives ;
- 6 triggers ;
- 0 enum PostgreSQL (les pseudo-enums sont des colonnes `text` avec contraintes `check`) ;
- 1 extension explicitement créée : `pgcrypto` ;
- 2 buckets Supabase Storage ;
- 33 tables `public` avec RLS activée ;
- 121 policies finales si l'on compte les 113 policies métier et les 8 policies Storage ;
- 38 colonnes de clés étrangères vers `auth.users(id)` ;
- 12 tables ajoutées à la publication `supabase_realtime`, dont 9 réellement écoutées par le client.

Conclusion : les tables, index, contraintes, données et une grande partie du PL/pgSQL sont transférables vers Neon PostgreSQL. En revanche, `auth.uid()`, `auth.users`, les rôles `anon`/`authenticated`, `storage.*`, la publication `supabase_realtime`, les clients Supabase côté navigateur et le transport RPC PostgREST nécessitent une adaptation explicite.

> Limite de preuve : cet audit décrit le schéma attendu après application des 15 migrations du dépôt. L'état réellement déployé dans Supabase n'a volontairement pas été interrogé ; une dérive distante éventuelle ne peut donc pas être exclue.

## 2. Base de données

### 2.1 Tables utilisées

#### Identité, préférences et migration

| Table | Usage |
|---|---|
| `profiles` | Pseudo, `avatar_url`, marqueur de configuration des modules ; correspondance 1:1 avec `auth.users`. |
| `user_preferences` | Devises, locale et affichage compact ; correspondance 1:1 avec `auth.users`. |
| `user_modules` | Modules activés et ordre de navigation par utilisateur. |
| `migration_batches` | Journal transactionnel et anti-doublon de l'import Budget JR. |

#### Budget et abonnements

| Table | Usage |
|---|---|
| `budget_entries` | Revenus et dépenses du budget personnel. |
| `subscriptions` | Abonnements personnels. |

#### Gestion locative

| Table | Usage |
|---|---|
| `tenants` | Locataires. |
| `rent_payments` | Paiements mensuels d'un locataire. |
| `tenant_debts` | Dettes et reports d'un locataire. |

#### Business et Dubaï

| Table | Usage |
|---|---|
| `dubai_parts` | Pièces/stock Dubaï. |
| `dubai_sales` | Ventes liées à une pièce Dubaï. |
| `dubai_expenses` | Dépenses éventuellement liées à une pièce Dubaï. |
| `dubai_cash_movements` | Mouvements de trésorerie Dubaï. |
| `businesses` | Activités et configuration de modules métier. |
| `business_contacts` | Contacts d'une activité. |
| `business_items` | Produits/services/stock d'une activité. |
| `business_transactions` | Transactions d'une activité. |
| `business_bookings` | Réservations d'une activité. |
| `business_tasks` | Tâches d'une activité. |
| `attachments` | Métadonnées des pièces jointes rattachées à `dubai_parts` ou `businesses`. |

#### Travel

| Table | Usage |
|---|---|
| `trips` | Voyage, pays, budget et métadonnées de cover Unsplash. |
| `flights` | Vols d'un voyage. |
| `accommodations` | Hébergements d'un voyage. |
| `trip_activities` | Activités d'un voyage. |
| `trip_checklist_items` | Checklist collaborative et assignation à un utilisateur. |
| `trip_members` | Membres, rôle et statut dans un voyage. |
| `trip_invitations` | Invitations par utilisateur ou e-mail. |
| `notifications` | Notifications applicatives personnelles. |
| `trip_expenses` | Dépenses partagées. |
| `trip_expense_splits` | Répartition et règlement des dépenses. |
| `travel_friend_requests` | Demandes d'ami de voyage. |
| `travel_friends` | Relations d'amitié Travel canoniques. |
| `airports` | Annuaire OurAirports en lecture seule côté application. |

Le repository applicatif charge dynamiquement les 29 tables déclarées dans `entityTables`. `profiles`, `user_preferences`, `notifications` et `airports` ont en plus des accès dédiés ; `migration_batches` est manipulée par la RPC d'import.

### 2.2 Vues, enums et extensions

- Vues : aucune instruction `create view` ou `create materialized view` dans les migrations.
- Enums PostgreSQL : aucun `create type ... as enum`. Les valeurs `currency`, `status`, `role`, `kind`, etc. sont sécurisées par des contraintes `check` sur des colonnes `text`.
- Extension : `pgcrypto`, utilisée directement ou indirectement par `gen_random_uuid()`, `gen_random_bytes()` et `encode()`.
- Neon : les contraintes `check` sont portables. La disponibilité/activation de `pgcrypto` doit être confirmée dans la branche Neon cible avant import.

### 2.3 Relations et clés étrangères

#### Dépendances vers Supabase Auth

Les migrations définissent 38 clés étrangères vers `auth.users(id)` :

- `profiles.user_id` ;
- `user_preferences.user_id` ;
- `migration_batches.user_id` ;
- `user_modules.user_id` ;
- le `user_id` des 21 tables métier V1 : `tenants`, `rent_payments`, `tenant_debts`, `dubai_parts`, `dubai_sales`, `dubai_expenses`, `dubai_cash_movements`, `businesses`, `business_contacts`, `business_items`, `business_transactions`, `business_bookings`, `business_tasks`, `budget_entries`, `subscriptions`, `trips`, `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`, `attachments` ;
- `trip_checklist_items.assigned_to` ;
- `trip_members.user_id`, `trip_members.invited_by` ;
- `trip_invitations.inviter_id`, `trip_invitations.invited_user_id` ;
- `notifications.user_id` ;
- `trip_expenses.user_id`, `trip_expenses.paid_by` ;
- `trip_expense_splits.user_id` ;
- `travel_friend_requests.sender_id`, `travel_friend_requests.recipient_id` ;
- `travel_friends.user_a`, `travel_friends.user_b`.

La plupart utilisent `on delete cascade`; les références d'assignation/invitation utilisent parfois `on delete set null`. Ces FK ne peuvent pas être recréées dans Neon tant qu'un remplacement de `auth.users` et une stratégie de conservation des UUID n'ont pas été décidés.

#### Relations métier internes

- toutes les 21 tables V1 portent `migration_batch_id -> migration_batches.id` avec `on delete set null` ;
- `rent_payments.tenant_id -> tenants.id` et `tenant_debts.tenant_id -> tenants.id` (`cascade`) ;
- `dubai_sales.part_id -> dubai_parts.id` et `dubai_expenses.part_id -> dubai_parts.id` (`cascade`) ;
- `business_contacts`, `business_items`, `business_transactions`, `business_bookings`, `business_tasks` et `attachments` référencent `businesses.id` (`cascade`) ;
- `attachments.dubai_part_id -> dubai_parts.id` (`cascade`) ; une contrainte impose exactement un parent entre `dubai_part_id` et `business_id` ;
- `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`, `trip_members`, `trip_invitations`, `trip_expenses` et `trip_expense_splits` référencent `trips.id` (`cascade`) ;
- `trip_expense_splits.expense_id -> trip_expenses.id` (`cascade`).

Ces relations métier sont transférables telles quelles.

### 2.4 Fonctions PostgreSQL et RPC

| Fonction | Rôle | Appelée directement par le client | Dépendance Supabase |
|---|---|---:|---|
| `set_updated_at()` | Trigger générique `updated_at`. | Non | Faible. |
| `handle_new_user()` | Crée profil et préférences après insertion Auth. | Non | Très forte : trigger sur `auth.users`, métadonnées Auth. |
| `import_budgy_archive(jsonb, integer, text)` | Import atomique des 21 collections historiques, anti-doublon et activation de modules. | Oui | `auth.uid()`, rôle `authenticated`, PostgREST RPC. |
| `trip_role(uuid, uuid)` | Calcule owner/editor/viewer. | Indirecte | Paramètre par défaut `auth.uid()`, `security definer`. |
| `can_view_trip(uuid, uuid)` | Autorisation de lecture Travel. | Indirecte/RLS | `auth.uid()`, `security definer`. |
| `can_edit_trip(uuid, uuid)` | Autorisation owner/editor. | Indirecte/RLS | `auth.uid()`, `security definer`. |
| `can_manage_trip_members(uuid, uuid)` | Autorisation owner. | Indirecte/RLS | `auth.uid()`, `security definer`. |
| `shares_trip_with(uuid, uuid)` | Visibilité d'un profil entre co-voyageurs. | Indirecte/RLS | `auth.uid()`, `security definer`. |
| `find_budgy_user(text)` | Recherche exacte d'un profil pour invitation. | Oui, méthode présente | `auth.uid()`, `security definer`, rôle `authenticated`. |
| `invite_to_trip(uuid, text, text, text)` | Invitation, membre pending et notification atomiques. | Oui | `auth.uid()`, lecture directe de `auth.users.email`, rôle `authenticated`. |
| `respond_trip_invitation(uuid, boolean)` | Accepte/refuse invitation, membre et notifications. | Oui | `auth.uid()`, rôle `authenticated`. |
| `search_airports(text, integer)` | Recherche OurAirports. | Oui | Teste `auth.uid()`, rôle `authenticated`. |
| `list_airport_country_codes()` | Pays présents dans OurAirports. | Oui | Teste `auth.uid()`, rôle `authenticated`. |
| `has_travel_friend_context(uuid, uuid)` | Autorise la visibilité minimale des profils Travel. | Indirecte/RLS | `auth.uid()`, `security definer`. |
| `find_travel_user(text)` | Recherche exacte Travel historique. | Non trouvée dans le flux actuel | `auth.uid()`, `security definer`. |
| `search_travel_profiles(text, integer)` | Typeahead préfixé, 2 caractères, 8 résultats max. | Oui | `auth.uid()`, `security definer`, rôle `authenticated`. |
| `send_travel_friend_request(text)` | Crée demande et notification. | Oui | `auth.uid()`, `security definer`. |
| `respond_travel_friend_request(uuid, boolean)` | Répond, crée l'amitié et notifie. | Oui | `auth.uid()`, `security definer`. |
| `remove_travel_friend(uuid)` | Supprime une amitié si l'acteur est concerné. | Oui | `auth.uid()`, `security definer`. |
| `notify_trip_expense_created()` | Notifie les autres participants. | Trigger | `auth.uid()`, `security definer`. |
| `notify_trip_checklist_assignment()` | Notifie l'utilisateur assigné. | Trigger | `auth.uid()`, `security definer`. |
| `update_trip_cover(...)` | Met à jour atomiquement toutes les métadonnées Unsplash. | Oui | `auth.uid()`, `security definer`, rôle `authenticated`. |

Le repository appelle 11 RPC exposées par Supabase : `find_budgy_user`, `invite_to_trip`, `respond_trip_invitation`, `update_trip_cover`, `search_travel_profiles`, `send_travel_friend_request`, `respond_travel_friend_request`, `remove_travel_friend`, `search_airports`, `list_airport_country_codes` et `import_budgy_archive`.

Les fonctions métier peuvent rester dans PostgreSQL après remplacement de l'identité courante et révision des droits. L'appel `.rpc(...)` est en revanche une API Supabase/PostgREST et doit être remplacé par des endpoints serveur, Server Actions ou requêtes serveur explicites.

### 2.5 Triggers

| Trigger | Table | Fonction |
|---|---|---|
| `profiles_updated_at` | `profiles` | `set_updated_at()` |
| `preferences_updated_at` | `user_preferences` | `set_updated_at()` |
| `user_modules_updated_at` | `user_modules` | `set_updated_at()` |
| `on_auth_user_created` | `auth.users` | `handle_new_user()` |
| `trip_expense_notify_members` | `trip_expenses` | `notify_trip_expense_created()` |
| `trip_checklist_notify_assignment` | `trip_checklist_items` | `notify_trip_checklist_assignment()` |

Les trois triggers `updated_at` sont portables. Les deux triggers de notification sont portables après remplacement de `auth.uid()`. `on_auth_user_created` ne l'est pas tel quel, car `auth.users` est un objet Supabase Auth.

### 2.6 RLS finale

La RLS PostgreSQL est activée sur les 33 tables `public`. Les policies finales se répartissent ainsi :

#### Domaine privé par `user_id` — 64 policies

Les 16 tables suivantes ont quatre policies nommées `<table>_select_own`, `<table>_insert_own`, `<table>_update_own`, `<table>_delete_own`, toutes fondées sur `auth.uid() = user_id` :

`tenants`, `rent_payments`, `tenant_debts`, `dubai_parts`, `dubai_sales`, `dubai_expenses`, `dubai_cash_movements`, `businesses`, `business_contacts`, `business_items`, `business_transactions`, `business_bookings`, `business_tasks`, `budget_entries`, `subscriptions`, `attachments`.

#### Identité et préférences — 7 policies

- `profiles_select_own`, `profiles_update_own`, `profiles_insert_own` ;
- `profiles_select_travel_context` : profil propre, voyage partagé ou contexte d'amitié Travel ;
- `preferences_all_own` ;
- `migration_batches_all_own` ;
- `user_modules_all_own`.

#### Voyage principal et enfants — 20 policies

- `trips_select_visible` s'appuie sur `can_view_trip(id)` ;
- `trips_insert_own`, `trips_update_own`, `trips_delete_own` restent réservées au propriétaire via `user_id` ;
- pour `flights`, `accommodations`, `trip_activities`, `trip_checklist_items` : quatre policies `<table>_{select,insert,update,delete}_shared`, avec lecture par membre et écriture owner/editor.

#### Collaboration — 12 policies

- `trip_members_select`, `trip_members_insert`, `trip_members_update`, `trip_members_delete` ;
- `trip_invitations_select`, `trip_invitations_insert`, `trip_invitations_update`, `trip_invitations_delete` ;
- `notifications_select_own`, `notifications_update_own`, `notifications_delete_own` ; aucune policy INSERT client ;
- `airports_read_authenticated`.

#### Dépenses partagées — 8 policies

- `trip_expenses_select`, `trip_expenses_insert`, `trip_expenses_update`, `trip_expenses_delete` ;
- `trip_expense_splits_select`, `trip_expense_splits_write`, `trip_expense_splits_update`, `trip_expense_splits_delete`.

#### Amis Travel — 2 policies

- `travel_friend_requests_select_concerned` ;
- `travel_friends_select_concerned`.

Les écritures de ces deux tables passent exclusivement par des fonctions `security definer`.

#### Storage — 8 policies

- `attachments_storage_select`, `attachments_storage_insert`, `attachments_storage_update`, `attachments_storage_delete` ;
- `avatars_storage_read`, `avatars_storage_insert`, `avatars_storage_update`, `avatars_storage_delete`.

Les policies métier utilisent `auth.uid()` directement ou des fonctions qui finissent par l'utiliser. PostgreSQL RLS existe dans Neon et peut être conservé, mais pas avec ce fournisseur d'identité implicite. Il faudra soit injecter l'identité authentifiée dans chaque transaction et remplacer `auth.uid()` par une fonction contrôlée, soit déplacer l'autorisation dans une couche serveur tout en gardant éventuellement la RLS en défense supplémentaire.

## 3. Code applicatif

### 3.1 Création des clients

- `lib/supabase/client.ts` : singleton navigateur via `createBrowserClient<Database>()` de `@supabase/ssr`.
- `lib/supabase/server.ts` : client serveur via `createServerClient<Database>()` et cookies Next.js.
- `proxy.ts` : second client serveur pour vérifier `auth.getUser()`, rafraîchir les cookies et protéger les routes.
- Aucun appel nu à `createClient()` n'a été trouvé ; Budgy utilise les variantes SSR navigateur/serveur.
- `lib/data/supabase-repository.ts` importe le type `SupabaseClient` depuis `@supabase/supabase-js`.

### 3.2 DATABASE

Fichier central : `lib/data/supabase-repository.ts`.

- `loadAll()` fait un `select('*')` parallèle sur les 29 tables de `entityTables`.
- CRUD générique : `insert`, `update(...).eq('id', id).select('id').maybeSingle()`, `delete(...).eq('id', id)`.
- Upserts : `user_modules` et `user_preferences`.
- Accès dédiés : `profiles`, `airports`, `notifications`.
- Les conversions camelCase/snake_case sont centralisées dans `lib/data/entity-map.ts`.
- `scripts/import-airports.mjs` n'utilise pas le SDK : il envoie les lots OurAirports directement à `/rest/v1/airports?on_conflict=id` avec la service-role key.

Les composants métier consomment majoritairement `useBudgyData()` et ne connaissent pas directement Supabase. Cette abstraction réduit la surface de réécriture si le futur repository Neon conserve le même contrat.

### 3.3 AUTH

- `services/auth.ts` : `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `signOut`.
- `app/auth/page.tsx` : écrans connexion, inscription et mot de passe oublié.
- `app/auth/callback/route.ts` : échange du code e-mail avec `exchangeCodeForSession`.
- `app/auth/reset-password/page.tsx` : remplacement du mot de passe via `auth.updateUser`.
- `proxy.ts` : `auth.getUser`, redirections vers `/auth` et `/onboarding`, propagation des cookies rafraîchis.
- `lib/data/data-provider.tsx` : `auth.onAuthStateChange`, validation initiale par `auth.getUser`, montage/démontage du repository selon la session.
- `app/(app)/settings/account/page.tsx` : lecture de l'e-mail courant par `auth.getUser`.
- `app/(app)/more/page.tsx` et `app/(app)/settings/page.tsx` : déconnexion via le service Auth.

### 3.4 STORAGE

- `services/attachments.ts` : upload, URL signée et suppression du bucket privé.
- `components/attachment-manager.tsx` : orchestration UI des pièces jointes et de leur ligne SQL.
- `app/(app)/settings/migration/page.tsx` : upload des pièces jointes d'archive avant la RPC puis nettoyage sur échec/doublon.
- `app/(app)/settings/account/page.tsx` : upload et URL publique des avatars.

### 3.5 REALTIME

Un seul abonnement client existe, dans `lib/data/data-provider.tsx`. Le canal `budgy-travel-${uid}` écoute des événements `postgres_changes` `*` sur neuf tables et déclenche, après un debounce de 180 ms, un rechargement complet des données :

`trips`, `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`, `trip_members`, `trip_expenses`, `trip_expense_splits`, `notifications`.

### 3.6 RPC

Tous les appels RPC applicatifs sont concentrés dans `lib/data/supabase-repository.ts`. Les pages et composants passent ensuite par `DataProvider`. Ce regroupement est favorable à la migration : un adaptateur Neon serveur peut préserver les méthodes publiques du provider.

### 3.7 Dépendances npm

- `@supabase/ssr` `^0.12.4` ;
- `@supabase/supabase-js` `^2.112.3` ;
- entrées correspondantes dans `package-lock.json`.

Ces dépendances ne sont pas supprimées pendant la phase d'audit. Elles ne pourront être retirées qu'après remplacement complet des cinq usages Supabase.

## 4. Auth détaillée

### 4.1 Inscription

1. Le navigateur appelle `signUp({ email, password, options.data.username, emailRedirectTo })`.
2. Supabase Auth crée l'utilisateur dans `auth.users` et place le pseudo dans `raw_user_meta_data`.
3. Le trigger `on_auth_user_created` exécute `handle_new_user()` en `security definer`.
4. La fonction crée `profiles(user_id, username)` et `user_preferences(user_id)`.
5. Si une session est retournée immédiatement, l'utilisateur part vers l'onboarding ; sinon l'UI demande de confirmer l'e-mail.

### 4.2 Connexion, callback et session

- Connexion e-mail/mot de passe par `signInWithPassword`.
- Confirmation/récupération par code via `/auth/callback`, puis `exchangeCodeForSession`.
- La session est portée par les cookies gérés par `@supabase/ssr`.
- Le proxy appelle `getUser()` côté serveur à chaque route protégée et recopie les cookies rafraîchis.
- Le `DataProvider` appelle également `getUser()` côté navigateur et écoute `onAuthStateChange` pour attacher ou détacher le repository.
- Déconnexion par `auth.signOut()` puis redirection/refresh Next.js.
- Mot de passe oublié par `resetPasswordForEmail`; nouveau mot de passe par `updateUser({ password })`.

### 4.3 Profil, avatar et identifiants

- `profiles.user_id` est exactement l'UUID Supabase Auth.
- `username` est unique sans tenir compte de la casse via `profiles_username_ci_unique`.
- `avatar_url` contient une URL publique Supabase Storage pour les avatars distants, ou une chaîne vide.
- Les données financières utilisent presque partout un `user_id` qui référence le même UUID Auth.
- Travel multiplie les références à cet UUID : owner du voyage, membre, invitant, invité, personne assignée, payeur, bénéficiaire d'une part, demandeur/destinataire d'amitié et destinataire de notification.

### 4.4 Conséquence Neon

Neon fournit PostgreSQL mais ne remplace pas Supabase Auth. Il faut choisir un fournisseur Auth ou une implémentation Auth applicative, conserver ou mapper les UUID existants, reconstruire les flux e-mail/callback/reset/session, puis fournir l'identité validée à la couche base. La copie seule de `public.profiles` ne migre ni les mots de passe, ni les confirmations e-mail, ni les sessions actives.

## 5. Storage

### 5.1 Buckets

| Bucket | Visibilité | Limites SQL | Usage |
|---|---|---|---|
| `budgy-attachments` | Privé | limite et types MIME à `null`; le code limite à 10 Mo | Documents liés à une activité ou pièce Dubaï. |
| `budgy-avatars` | Public | 5 MiB ; PNG, JPEG, WebP | Photos de profil. |

### 5.2 Pièces jointes

- Chemin objet : `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`.
- Upload : `storage.from('budgy-attachments').upload(..., upsert: false)`.
- Lecture/téléchargement : URL signée valable 15 minutes via `createSignedUrl`.
- Suppression : `remove([storagePath])` puis suppression de la ligne `attachments`.
- Base : la table stocke `file_name`, `mime_type`, `storage_path`, `size_bytes` et le parent ; elle ne stocke pas l'URL signée.
- Import historique : les fichiers sont envoyés avant l'appel SQL ; un nettoyage best-effort est tenté si l'import échoue ou était déjà présent.
- Mode local : `storagePath` peut être une Data URL, avec une limite applicative de 1,5 Mo.

### 5.3 Avatars

- Chemin objet : `${userId}/avatar-${Date.now()}.${extension}`.
- Upload public avec `upsert: true`.
- `getPublicUrl()` produit l'URL enregistrée dans `profiles.avatar_url`.
- La suppression visible de l'avatar vide uniquement `profiles.avatar_url`; aucun appel Storage de suppression de l'ancien objet n'a été trouvé. Des objets orphelins peuvent donc exister.

### 5.4 Autres URLs

- Les covers Travel ne sont pas dans Supabase Storage : ce sont des URLs Unsplash et leurs métadonnées stockées dans `trips`.
- `accommodations.image_url` existe mais aucun upload Storage dédié n'a été trouvé.
- Les URLs Storage publiques d'avatar devront être réécrites ou conservées temporairement derrière une stratégie de compatibilité ; les chemins privés de pièces jointes devront être migrés avec les objets.

## 6. Realtime

### 6.1 Publication SQL

La migration V3 ajoute conditionnellement 12 tables à `supabase_realtime` :

`trips`, `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`, `trip_members`, `trip_invitations`, `notifications`, `trip_expenses`, `trip_expense_splits`, `travel_friend_requests`, `travel_friends`.

Cette publication est un objet spécifique à l'infrastructure Supabase Realtime. Elle ne sera pas présente telle quelle dans Neon.

### 6.2 Écoute applicative réelle

Le client écoute seulement neuf tables :

- voyage et cover : `trips` ;
- itinéraire : `flights`, `accommodations`, `trip_activities` ;
- checklist : `trip_checklist_items` ;
- membres : `trip_members` ;
- dépenses : `trip_expenses`, `trip_expense_splits` ;
- signal transversal : `notifications`.

`trip_invitations`, `travel_friend_requests` et `travel_friends` sont publiées mais non écoutées directement. Leur UI se rafraîchit souvent indirectement parce que les RPC créent aussi une notification, ou explicitement parce que les actions locales appellent `reload()`.

### 6.3 Ce qui casserait sans Realtime

- une cover modifiée par un autre owner/editor ne s'afficherait plus automatiquement ;
- les vols, logements et activités ajoutés/modifiés par un collaborateur resteraient obsolètes jusqu'à un rechargement ;
- les changements de checklist et d'assignation ne seraient plus synchronisés visuellement ;
- l'arrivée/retrait d'un membre ne serait plus reflété automatiquement ;
- les dépenses et répartitions partagées seraient périmées chez les autres participants ;
- les notifications entrantes ne déclencheraient plus le rechargement qui révèle invitations et demandes d'ami ;
- l'auteur d'une action conserverait généralement son état optimiste/local, mais les autres appareils et membres auraient un état ancien jusqu'à `reload()`, navigation ou nouveau chargement.

La fonctionnalité de base ne perd pas immédiatement ses écritures PostgreSQL ; c'est la cohérence multi-client et la collaboration en temps quasi réel qui disparaissent.

## 7. Migrations

### 7.1 Historique cumulatif représentant le schéma attendu

Les 15 migrations sont cumulatives et doivent être lues dans l'ordre. Il n'existe pas de snapshot SQL final unique.

| Migration | Contribution |
|---|---|
| `202608180001_base.sql` | `pgcrypto`, profils, préférences, batches, triggers Auth/updated_at. |
| `202608180002_entities.sql` | 21 tables métier V1 et leurs FK. |
| `202608180003_indexes.sql` | Index métier, recherche et anti-doublon historique. |
| `202608180004_rls.sql` | RLS privée initiale sur les tables V1. |
| `202608180005_storage.sql` | Bucket et policies `budgy-attachments`. |
| `202608180006_remote_import.sql` | Première version de `import_budgy_archive`. |
| `202608190001_v2_user_modules.sql` | Modules, avatar, préférences et templates business. |
| `202608190002_v2_trip_collaboration.sql` | Membres, invitations, notifications, helpers de permission et RLS Travel. |
| `202608190003_v2_trip_expenses.sql` | Dépenses/splits et bucket avatars. |
| `202608190004_historical_import_mapping_modules.sql` | Remplace la fonction d'import par sa version finale corrigée. |
| `202608190005_v25_module_order.sql` | Ordre des modules. |
| `20260819145454_v3_travel_reimagined.sql` | Métadonnées Travel, aéroports, amis, notifications et publication Realtime. |
| `20260819200122_travel_friend_search_v302.sql` | Recherche préfixée de profils Travel. |
| `20260819212059_v304_travel_cover_sync.sql` | Timestamp et RPC atomique de cover. |
| `20260819214714_v3041_country_selector.sql` | Liste des pays dérivée des aéroports. |

La version active de `import_budgy_archive` est celle de `202608190004`, qui remplace celle de `202608180006`. La policy `profiles_select_shared_trip` de V2 est supprimée puis remplacée par `profiles_select_travel_context` en V3. La contrainte `notifications_kind_check` est également remplacée en V3.

### 7.2 Objets impossibles à copier tels quels

- le schéma géré `auth`, en particulier `auth.users` et `auth.uid()` ;
- le trigger `on_auth_user_created` sur `auth.users` ;
- les rôles/grants Supabase `anon` et `authenticated` ;
- les tables et helpers gérés `storage.buckets`, `storage.objects`, `storage.foldername()` ;
- les 8 policies Storage ;
- la publication nommée `supabase_realtime` et le service WebSocket qui la consomme ;
- l'exposition automatique des tables/fonctions par la Data API/PostgREST ;
- le script OurAirports basé sur URL REST Supabase et service-role key ;
- les sessions et cookies produits par Supabase Auth.

### 7.3 Objets transférables après adaptation

- fonctions de permission Travel et policies RLS après remplacement de `auth.uid()` ;
- RPC métier atomiques après remplacement de l'identité et du transport PostgREST ;
- triggers de notification après remplacement de l'acteur courant ;
- profils et toutes les FK utilisateur après création d'une table d'identité cible ou conservation contrôlée des UUID.

## 8. A — Transférable tel quel vers Neon PostgreSQL

- colonnes et types PostgreSQL standards des 33 tables `public` ;
- données métier, sous réserve du respect de l'ordre des FK ;
- PK UUID, contraintes uniques, contraintes `check`, index simples/partiels et index d'expression ;
- relations internes entre tables `public` ;
- JSONB, tableaux, dates, timestamps, numériques et doubles ;
- fonction `set_updated_at()` et ses trois triggers associés ;
- logique PL/pgSQL ne faisant pas appel à un schéma Supabase, une fois l'identité isolée ;
- RLS en tant que fonctionnalité PostgreSQL, mais pas ses expressions `auth.uid()` actuelles.

## 9. B — Nécessite adaptation

- les 38 FK vers `auth.users` ;
- les 61 occurrences historiques de `auth.uid()` dans les fichiers de migration, dont plusieurs appartiennent à des définitions ensuite remplacées ;
- les policies RLS et paramètres par défaut des helpers Travel ;
- les fonctions `security definer`, qui devront recevoir ou lire une identité de confiance et conserver des droits d'exécution minimaux ;
- le repository basé sur `.from(...)`, filtres PostgREST et `.rpc(...)` ;
- le script d'import OurAirports ;
- le type `Database`, actuellement très générique pour les tables (`Record<string, ...>`) et listant explicitement les RPC ;
- les URLs d'avatar et chemins de pièces jointes ;
- le mode `NEXT_PUBLIC_BUDGY_DATA_MODE=auto|local|supabase` ;
- les textes UI et diagnostics qui nomment Supabase.

## 10. C — Dépend fortement de Supabase

- Auth complète : inscription, confirmation e-mail, connexion, reset, session, refresh cookie et déconnexion ;
- accès direct aux données depuis le navigateur avec JWT + publishable/anon key ;
- Storage, URLs publiques et URLs signées ;
- Realtime `postgres_changes` ;
- Data API/PostgREST et transport RPC ;
- trigger de provisionnement automatique sur `auth.users` ;
- rôles `anon`/`authenticated` et grants correspondants ;
- chargement OurAirports via REST avec `SUPABASE_SERVICE_ROLE_KEY`.

## 11. D — Risques de migration

1. **Continuité des identifiants** : changer les UUID utilisateur sans mapping casserait 38 FK et toutes les autorisations Travel.
2. **Mots de passe et sessions** : les données `public` ne suffisent pas à migrer Supabase Auth ; une réauthentification ou un reset global peut être nécessaire selon le fournisseur cible.
3. **Faille d'autorisation** : désactiver simplement la RLS ou remplacer `auth.uid()` par un identifiant fourni par le client créerait un risque critique d'accès horizontal aux données financières.
4. **Connexion navigateur** : les identifiants Neon ne doivent jamais être exposés dans des variables `NEXT_PUBLIC_*`; l'accès DB doit passer par une couche serveur.
5. **`security definer`** : 18 fonctions actives l'utilisent. Une mauvaise reconstruction des grants ou de l'identité pourrait contourner la RLS.
6. **Sémantique RPC** : invitations, amitiés, import et cover reposent sur des transactions atomiques. Les décomposer en plusieurs appels applicatifs introduirait des états partiels.
7. **Storage** : il faut migrer à la fois les objets, les chemins/URLs en base, les permissions et la signature des téléchargements privés.
8. **Realtime** : sans remplacement avant bascule, Travel semblera fonctionner pour l'auteur mais restera obsolète chez les collaborateurs.
9. **État distant inconnu** : une dérive entre migrations Git et Supabase déployé peut omettre tables, policies, données ou fonctions lors de l'export.
10. **Import historique** : `import_budgy_archive` dépend du contexte Auth et de la forme exacte des 21 tables ; une régression peut réintroduire des doublons ou des imports partiels.
11. **Avatars orphelins** : l'ancien bucket peut contenir plusieurs fichiers non référencés, car vider `avatar_url` ne supprime pas l'objet.
12. **Pool de connexions** : toute identité injectée dans une variable de session PostgreSQL doit être transactionnelle et remise à zéro avec certitude dans un environnement poolé.

## 12. E — Plan recommandé par étapes

### Étape 0 — Preuve de l'état source

- exporter le schéma réellement déployé, la liste des policies/grants, les comptes, le nombre de lignes par table et l'inventaire Storage ;
- comparer ce snapshot aux 15 migrations Git ;
- figer un mapping des UUID utilisateur.

### Étape 1 — Décider l'architecture Auth et sécurité

- choisir le fournisseur Auth cible ;
- décider si les UUID Supabase sont conservés comme identifiants internes ou mappés dans une table `users` ;
- définir une fonction d'identité PostgreSQL fiable ou une stratégie d'autorisation serveur ;
- porter et tester la RLS avant toute donnée réelle.

### Étape 2 — Construire un schéma Neon adapté hors production

- rejouer les objets PostgreSQL portables dans une branche Neon isolée ;
- remplacer `auth.users`, `auth.uid()`, rôles et grants ;
- conserver les transactions RPC métier ;
- vérifier `pgcrypto`, FK, contraintes, index, triggers et policies.

### Étape 3 — Remplacer la couche d'accès aux données

- interdire toute connexion Neon directe depuis le navigateur ;
- créer un repository serveur avec le même contrat que `SupabaseRepository` ;
- remplacer `.from(...)` et `.rpc(...)` par des appels serveur typés ;
- préserver l'optimistic UI et les erreurs « aucune ligne affectée ».

### Étape 4 — Migrer Auth

- reconstruire inscription, connexion, confirmation, reset, callback, session et middleware ;
- créer profil/préférences lors du provisionnement du nouvel utilisateur ;
- tester toutes les transitions de session et tous les rôles Travel.

### Étape 5 — Migrer Storage

- choisir le stockage objet cible ;
- copier `budgy-attachments` et `budgy-avatars` ;
- reconstruire URLs publiques, URLs signées, upload, delete et règles de chemin ;
- réécrire `avatar_url` et valider chaque `attachments.storage_path`.

### Étape 6 — Remplacer Realtime

- choisir un mécanisme WebSocket/SSE/change-data-capture compatible ;
- reproduire au minimum les neuf abonnements réellement consommés ;
- tester deux comptes et deux appareils sur cover, membres, itinéraire, checklist, dépenses et notifications.

### Étape 7 — Répétition de migration

- importer un snapshot anonymisé puis complet dans une branche Neon ;
- comparer les comptes et checksums par table ;
- exécuter les tests RLS avec plusieurs utilisateurs et rôles ;
- vérifier tous les objets Storage et URLs.

### Étape 8 — Bascule contrôlée

- prévoir une fenêtre de gel ou une réplication finale ;
- effectuer un dernier delta et les contrôles de parité ;
- basculer l'application avec stratégie de rollback ;
- conserver Supabase en lecture seule jusqu'à validation.

### Étape 9 — Nettoyage différé

- seulement après validation : retirer dépendances, variables, anciennes migrations/runtime Supabase et textes obsolètes ;
- ne jamais supprimer l'ancien environnement avant sauvegarde et délai de réversibilité.

## 13. F — Nombre de fichiers concernés

Surface fonctionnelle identifiée pour une migration future : **23 fichiers**.

- 3 configuration/dépendances : `.env.example`, `package.json`, `package-lock.json` ;
- 3 clients/config Supabase : `lib/supabase/config.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts` ;
- 1 middleware : `proxy.ts` ;
- 2 services : `services/auth.ts`, `services/attachments.ts` ;
- 4 accès/modèle de données : `lib/data/supabase-repository.ts`, `lib/data/data-provider.tsx`, `lib/data/migration-state.ts`, `lib/data/entity-map.ts` ;
- 1 type DB : `types/database.ts` ;
- 7 écrans/flux : `app/auth/page.tsx`, `app/auth/callback/route.ts`, `app/auth/reset-password/page.tsx`, `app/(app)/settings/account/page.tsx`, `app/(app)/settings/migration/page.tsx`, `app/(app)/more/page.tsx`, `app/(app)/settings/page.tsx` ;
- 1 composant Storage : `components/attachment-manager.tsx` ;
- 1 script admin : `scripts/import-airports.mjs`.

Surface SQL et validation distincte :

- 15 migrations SQL ;
- 12 tests applicatifs contenant des contrats Supabase/SQL ;
- 2 tests SQL Supabase RLS ;
- 17 documents existants (README inclus) mentionnent Supabase et devront éventuellement être actualisés après migration.

Soit **52 fichiers fonctionnels, SQL ou de test** à examiner pendant l'implémentation (23 + 15 + 12 + 2), ou **69** en incluant la documentation historique. Les composants métier utilisant uniquement `useBudgyData()` ne sont pas comptés, car leur contrat peut rester stable.

## 14. G — Variables d'environnement à remplacer

| Variable actuelle | Usage actuel | Traitement recommandé |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Data API/Auth/Realtime côté client et serveur | À supprimer après bascule. Ne pas la remplacer par une URL PostgreSQL publique. Utiliser une `DATABASE_URL` strictement serveur. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase du client SSR | À supprimer ; remplacer seulement par les variables publiques du fournisseur Auth choisi, si nécessaire. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Alias de compatibilité accepté par le code | À supprimer avec le client Supabase. |
| `SUPABASE_URL` | URL REST utilisée par l'import OurAirports | Remplacer par une connexion DB serveur ou un endpoint admin interne. |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass admin pour l'import OurAirports | À supprimer ; remplacer par un secret DB/admin serveur à privilèges minimaux, jamais public. |
| `NEXT_PUBLIC_BUDGY_DATA_MODE` | Sélection `auto`, `local` ou `supabase` | À renommer ou adapter (`remote`/`neon`) sans exposer de secret. Le mode local peut être conservé. |

Variables cibles probables, à finaliser après choix d'architecture :

- `DATABASE_URL` : connexion Neon poolée, serveur uniquement ;
- `DIRECT_URL` ou `DATABASE_URL_UNPOOLED` : migrations/administration, serveur uniquement si l'outil choisi l'exige ;
- variables du fournisseur Auth choisi ;
- variables du stockage objet choisi (endpoint, bucket, clé d'accès et secret, tous serveur sauf URL publique explicitement sûre) ;
- variable du service Realtime choisi si un service distinct est retenu.

`UNSPLASH_ACCESS_KEY` et `OURAIRPORTS_CSV_URL` ne sont pas des variables Supabase et peuvent rester inchangées dans leur rôle actuel.

## 15. Verdict

- **Transfert SQL direct** : tables métier, données, index, checks, FK internes et logique PostgreSQL indépendante.
- **Adaptation obligatoire** : identité utilisateur, RLS, fonctions `security definer`, repository, RPC, script d'import et types.
- **Remplacement complet** : Supabase Auth, Storage, Realtime, Data API/PostgREST et rôles gérés.
- **Chemin le moins risqué** : préserver les UUID et le contrat `DataProvider`, migrer d'abord la sécurité et les services serveur, puis les données et objets, et seulement ensuite basculer le client.
