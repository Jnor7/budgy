# Budgy — Phase 3 Supabase vers Neon : copie de base

Date : 13 septembre 2026
Statut global : **BACKUP CONTRÔLÉ — COPIE NEON VALIDÉE SUR BRANCHE ISOLÉE**

## Résumé d'exécution

| Contrôle | État actuel |
|---|---|
| Backup PostgreSQL Supabase | OK — téléchargé, copié hors Neon, hashé et lisible |
| Restauration de preuve du backup | OK — copie transactionnelle dans Neon |
| Counts Supabase | 33/33 mesurés dans le snapshot |
| Branche Neon `migration-supabase` | Créée, ID `br-lucky-math-b21gd8ag`, sans expiration automatique |
| Import Neon | OK — transaction validée sur la branche isolée |
| Counts Neon | 33/33 mesurés, 4 852/4 852 lignes |
| Comparaison d'échantillons | OK sur 18 lignes déterministes de 9 tables non vides |
| UUID historiques | Préservés ; aucune régénération |
| FK `auth.users` | 38 reportées ; 42 FK applicatives internes restaurées |
| Production | Inchangée |

La validation porte uniquement sur la branche Neon isolée. Elle ne constitue ni une migration Auth ni une bascule de production.

## 1. Méthode de backup

Méthode utilisée : téléchargement du « Database backup » fourni par le Dashboard Supabase pour le projet `Budgy` en pause. Le dump SQL de cluster compressé a été copié dans `backup/`, hors Neon et sous exclusion Git.

Preuves : fichier de 254 066 octets, SHA-256 `E2F0F8EF4C326E3D39112BA05668680FC90C5123884ED3D48AB920D1C922AFC0`, décompression intégrale de 1 100 493 octets, 33 tables/sections `COPY`, 22 fonctions `public`, 6 triggers Budgy, contraintes et indexes présents. Le dump annonce PostgreSQL 17.6 et `pg_dump` 17.11.

## 2. Méthode d'import exécutée

L'Import Data Assistant Neon a été écarté pour cette copie : il exige une connexion directe à la source, tandis que le projet Supabase est en pause, et ne donnait pas le contrôle d'exclusion requis sur les schémas gérés.

La méthode retenue est une restauration transactionnelle sélective du dump local vers `migration-supabase`. Le script [`../scripts/import-supabase-public-to-neon.mjs`](../scripts/import-supabase-public-to-neon.mjs) :

1. décompresse et analyse le dump en mémoire ;
2. refuse d'importer si le schéma `public` cible contient déjà des tables ;
3. restaure les 33 tables, les 33 sections `COPY`, les contraintes et indexes ;
4. reporte toute FK dont le SQL référence `auth.users` ;
5. importe uniquement `set_updated_at()` parmi les fonctions et ses trois triggers portables ;
6. compare chaque count, des échantillons déterministes et plusieurs relations avant `COMMIT` ;
7. exécute un `ROLLBACK` intégral à la première anomalie.

L'extension compatible `pgcrypto` a été activée dans `public`, et la référence Supabase `extensions.gen_random_bytes` a été adaptée vers `public.gen_random_bytes`.

## 3. Objets exclus

- schéma Supabase `auth` ;
- schéma Supabase `storage` ;
- schéma `realtime` ;
- publication `supabase_realtime` ;
- rôles, propriétaires, grants et objets internes Supabase ;
- secrets et variables d'environnement, jamais écrits dans Git ;
- schéma cible géré `neon_auth`, qui ne doit pas être écrasé.

## 4. Tables importées

Les 33 tables `public` sont dans le périmètre de données. `airports` est importable directement. Les 32 autres nécessitent de reporter les 38 FK vers `auth.users` pendant la restauration, sans réécrire les UUID.

État : **33/33 importées et vérifiées côté Neon**. Les 4 852 lignes du snapshot ont été copiées, dont les 4 562 lignes `airports`.

## 5. Row counts Supabase / Neon

Voir [`SUPABASE_PRE_MIGRATION_COUNTS.md`](SUPABASE_PRE_MIGRATION_COUNTS.md).

État : les 33 counts sont identiques, table par table, pour un total de 4 852 lignes de chaque côté. Écart total : 0.

## 6. Anomalies et adaptations

- Deux premières tentatives ont été annulées automatiquement par transaction : dépendance initiale à `extensions.gen_random_bytes`, puis émission d'une ligne vide pour une table sans données. Aucune table résiduelle n'a été laissée par ces tentatives.
- La référence `extensions.gen_random_bytes` a été adaptée à `public.gen_random_bytes` après activation de `pgcrypto`.
- Les tables vides sont désormais envoyées à `COPY` sans ligne vide synthétique.
- Aucune chaîne de connexion n'est enregistrée dans le dépôt. Le mot de passe du rôle `neondb_owner` a été réinitialisé après l'import et l'ancien identifiant a été vérifié comme refusé (`28P01`).
- Source : 0 UUID invalide, 0 référence utilisateur sans profil et 0 référence Travel orpheline dans les contrôles ciblés.
- Cible : 0 référence utilisateur sans profil et 0 relation orpheline détectée dans les contrôles Travel, locatif et business exécutés.

## 7. FK reportées

Les 38 FK vers `auth.users(id)` ont été omises/reportées dans la copie Neon initiale. Elles ne devront être recréées qu'après mise en place future de l'identité Budgy canonique, hors de cette phase.

Les 42 FK applicatives internes restantes ont été restaurées. Les FK existantes de Supabase production restent intactes.

## 8. Fonctions incompatibles

Non importées dans cette phase :

- `handle_new_user` et le trigger `on_auth_user_created` ;
- les 21 fonctions dépendantes de `auth.uid()`, `auth.users`, des rôles Supabase ou de l'exposition RPC ;
- toute fonction dépendant des rôles/grants Supabase ;
- exposition RPC PostgREST, qui n'est pas créée par une simple restauration PostgreSQL.

`set_updated_at()` et ses trois triggers portables ont été restaurés. Les fonctions métier restantes seront adaptées dans une phase ultérieure, pas ici.

## 9. Validation finale exécutée

### Row counts

- 33/33 tables mesurées côté source et cible ;
- égalité exacte pour chaque table ;
- 4 852 lignes de chaque côté, écart 0.

### Intégrité relationnelle

- aucun `user_id` métier sans profil canonique dans le périmètre contrôlé ;
- 0 membre, dépense ou checklist sans voyage ;
- 0 paiement locatif sans locataire ;
- 0 contact business sans business ;
- tables `attachments` et `businesses` vides conformément au snapshot.

### Checksums et échantillons

Deux bornes déterministes ont été comparées pour chaque table non vide du jeu suivant, ou l'unique ligne lorsqu'elle ne contenait qu'une ligne :

- `profiles`, `budget_entries`, `trips`, `trip_members`, `trip_expenses` ;
- `trip_checklist_items`, `travel_friend_requests`, `travel_friends`, `tenants`.

Les champs comparés couvrent IDs, UUID utilisateurs, montants, dates, noms/titres, `trip_id`, payeur et membre. Résultat : 18/18 lignes conformes. Les valeurs personnelles ne sont pas écrites dans Git.

## 10. Validation actuelle

```text
BACKUP : OK
IMPORT NEON : OK
TABLES : 33 / 33
ROW COUNTS : identiques
UUID USERS : préservés
FK auth.users : reportées
AUCUNE BASCULE PRODUCTION : confirmé
```

## Références

- Backup/restauration Supabase : https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Backups Supabase et limite Storage : https://supabase.com/docs/guides/platform/backups
- Migration PostgreSQL Neon : https://neon.com/migration
