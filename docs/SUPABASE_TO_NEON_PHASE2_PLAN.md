# Budgy — Phase 2 Supabase vers Neon

Date : 13 septembre 2026
Nature : préparation documentaire uniquement
Production actuelle : Supabase, inchangée
Cible préparée : projet Neon `Budgy`, AWS Europe Central 1 (Francfort), Neon Auth activé

## Résumé de décision

- **Import SQL strict direct** : `airports` seulement, car les 32 autres tables possèdent au moins une FK directe vers `auth.users`.
- **Données transférables** : les 33 tables, après préparation d'une identité canonique et dans l'ordre des FK.
- **Identité** : conserver les UUID Supabase comme clés métier Budgy ; mapper le `sub` Neon Auth en `text` vers ces UUID.
- **RLS** : remplacer l'identité Supabase par une fonction retournant l'UUID Budgy canonique ; ne pas faire de cast ou remplacement global aveugle.
- **Import** : tester d'abord l'Import Data Assistant sur une branche Neon isolée (< 10 Go), en excluant les objets gérés Supabase ; repli vers export/restauration sélectif si les exclusions ne sont pas maîtrisées.
- **Aucune action distante** n'a été effectuée pendant cette phase.

## 1. Sauvegarde Supabase

Capturer un export cohérent et restaurable du schéma déployé, des données, comptes/identités Auth, objets Storage, policies, fonctions, triggers, grants, publications et row counts. Comparer l'état réel aux 15 migrations Git. Supabase reste la source de vérité.

## 2. Création branche Neon de migration

Créer ultérieurement une branche isolée dédiée aux répétitions. Inventorier sa version PostgreSQL, `pgcrypto`, rôles, Data API/RLS et schéma `neon_auth`. Ne jamais utiliser la première restauration comme cible de production.

## 3. Import Postgres

Importer d'abord les objets portables. Exclure `auth`, `storage`, `realtime`, leurs rôles/propriétaires et la publication `supabase_realtime`. Ne pas écraser `neon_auth`. Pour les 32 tables dépendantes d'Auth, préparer la cible UUID canonique avant de recréer les FK.

## 4. Adaptation auth

Valider la forme exacte du claim Neon Auth et concevoir le pont `neon_auth_sub text -> budgy_user_id uuid`. Remplacer conceptuellement le trigger Supabase de création de profil/préférences par un provisionnement compatible Neon Auth. Aucun objet n'est créé à cette phase.

## 5. Migration users

Exporter les comptes avec leur UUID Supabase et importer les utilisateurs par l'API Neon Auth officiellement supportée au moment de l'exécution. Enregistrer et vérifier une correspondance bijective. Ne jamais écrire directement dans les tables Auth gérées sans procédure officielle. Revalider la compatibilité des mots de passe ; l'ancien guide Neon fondé sur Stack Auth précède l'architecture Better Auth actuelle.

## 6. Adaptation RLS

Porter les 113 policies métier vers l'UUID canonique. Adapter les rôles au mécanisme choisi, Neon Data API ou Neon RLS, qui ne doivent pas être activés ensemble sur une même branche. Exclure les 8 policies Storage. Tester les refus autant que les accès autorisés.

## 7. Adaptation RPC

Adapter les 21 fonctions liées à l'identité, préserver l'atomicité et revoir les 18 fonctions `security definer`. Remplacer l'accès à `auth.users.email`. Choisir un transport serveur ou la Data API Neon après validation des contrats ; ne jamais exposer la connexion PostgreSQL au navigateur.

## 8. Remplacement storage

Copier séparément les deux buckets, reproduire accès public/privé et signatures, puis contrôler `profiles.avatar_url` et `attachments.storage_path`. Les covers Unsplash ne font pas partie de Storage.

## 9. Remplacement realtime

Reproduire la synchronisation des neuf tables réellement écoutées et décider du sort des trois tables seulement publiées. Tester la collaboration à deux comptes/appareils.

## 10. Adaptation code app

Préserver le contrat du `DataProvider`, remplacer progressivement les cinq surfaces Supabase (Database, Auth, Storage, Realtime, RPC) et garder le chemin Supabase durant la coexistence.

## 11. Tests double environnement

Exécuter les mêmes scénarios et contrôles de données contre Supabase et une branche Neon : row counts, sommes, contraintes, RLS, RPC, fichiers, événements, owner/editor/viewer et échecs attendus.

## 12. Bascule Vercel

Lors d'une phase ultérieure explicitement autorisée, organiser gel/delta final, changer les variables avec procédure contrôlée et surveiller les scénarios critiques. Aucun changement Vercel n'est fait ici.

## 13. Rollback possible

Conserver les anciennes variables, la sauvegarde et Supabase disponible. Définir un seuil de retour, stopper les écritures divergentes et répéter réellement la procédure avant la bascule.

## 14. Suppression Supabase seulement bien plus tard

Supprimer Supabase uniquement après période de réversibilité, validation métier/sécurité et preuve de restauration. Cette décision est distincte de la migration.

## Cartographie consolidée

### Tables importables directement

`airports` est la seule table importable strictement avec ses contraintes sans dépendance Auth. Les structures et données métier des 32 autres tables sont PostgreSQL compatibles, mais leurs FK empêchent une restauration fidèle tant que la cible d'identité n'existe pas.

### Tables bloquées par `auth.users`

`profiles`, `user_preferences`, `migration_batches`, `user_modules`, `budget_entries`, `subscriptions`, `tenants`, `rent_payments`, `tenant_debts`, `dubai_parts`, `dubai_sales`, `dubai_expenses`, `dubai_cash_movements`, `businesses`, `business_contacts`, `business_items`, `business_transactions`, `business_bookings`, `business_tasks`, `attachments`, `trips`, `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`, `trip_members`, `trip_invitations`, `notifications`, `trip_expenses`, `trip_expense_splits`, `travel_friend_requests`, `travel_friends`.

Le détail des 38 FK, y compris `ON DELETE`, figure dans [`../neon/schema-compatibility.md`](../neon/schema-compatibility.md).

## Décision RLS

| Supabase actuel | Neon cible recommandé | Décision |
|---|---|---|
| `auth.uid()` retourne le UUID Supabase | `auth.user_id()` retourne le `sub` JWT en `text` | Ne pas substituer directement |
| Comparaison à une colonne `uuid` | Résolution `sub text -> UUID Budgy` | Fonction canonique fail-closed |
| Rôles `anon`/`authenticated` Supabase | Rôles Neon du mécanisme retenu | Adapter les `TO`/grants |
| 113 policies métier | PostgreSQL RLS Neon | Portable après adaptation/test |
| 8 policies `storage.objects` | ACL du stockage cible | Exclure de Neon PostgreSQL |

## Compatibilité Import Data Assistant

### Importable tel quel

- `airports` ;
- objets PostgreSQL standards sans référence Supabase ;
- relations internes entre tables `public` ;
- `pgcrypto` sous réserve du contrôle de version ;
- `set_updated_at()` et ses trois triggers.

### Importable avec adaptation

- données des 32 tables dépendantes d'Auth ;
- 38 FK vers une identité canonique ;
- 113 policies métier ;
- 21 fonctions liées à l'identité et deux triggers de notification ;
- métadonnées Storage en base ;
- 12 tables Realtime en tant que tables ordinaires.

### À exclure

- schémas gérés Supabase `auth`, `storage`, `realtime` ;
- tout écrasement de `neon_auth` ;
- comptes/sessions/tokens du dump général ;
- buckets et objets Storage ;
- publication et service `supabase_realtime` ;
- rôles, propriétaires, grants et secrets Supabase ;
- trigger `on_auth_user_created` dans sa forme actuelle.

## Risques principaux et garde-fous

| Risque | Impact | Garde-fou |
|---|---|---|
| Identifiants Neon différents des UUID Supabase | 38 FK et toute la RLS cassées | Mapping explicite, UUID Budgy canonique immuable |
| Remplacement global `auth.uid()` -> `auth.user_id()` | Incompatibilité `uuid`/`text` ou absence d'accès | Fonction de résolution typée, tests fail-closed |
| Import des schémas gérés | Conflits de propriétaires, rôles et `neon_auth` | Exclusions explicites, branche jetable |
| Suppression d'un compte avec CASCADE | Perte financière/collaborative massive | Découpler compte Auth et purge de l'identité métier |
| `security definer` mal granté | Contournement RLS | Revue des 18 fonctions, droits minimaux, `search_path` fermé |
| Migration Auth incomplète | Connexion impossible ou comptes doublons | Bijection, rapport d'exceptions, API officielle uniquement |
| Storage non copié | Avatars/liens cassés, pièces jointes perdues | Migration objet séparée + contrôle exhaustif |
| Realtime absent | Collaboration obsolète chez les autres clients | Remplacement et tests à deux appareils avant bascule |
| Écritures pendant le transfert | Divergence Supabase/Neon | Gel ou delta final, stratégie de rollback |
| Dérive schéma distant/Git | Objets ou données manquants | Snapshot distant et comparaison avant import |

## Références vérifiées

- Neon RLS : https://neon.com/docs/guides/row-level-security
- `pg_session_jwt` officiel : https://github.com/neondatabase/pg_session_jwt
- Neon Auth Better Auth : https://neon.com/blog/neon-auth-branchable-identity-in-your-database
- Gestion API Neon Auth : https://neon.com/docs/auth/guides/manage-auth-api
- Import PostgreSQL vers Neon : https://neon.com/migration
- Compatibilité PostgreSQL Neon : https://neon.com/docs/reference/compatibility

## Confirmation de non-action

Aucun service distant, aucune variable d'environnement, aucune migration, aucun compte Auth et aucun code applicatif n'ont été modifiés. Seuls les documents Markdown de préparation ont été ajoutés au dépôt.
