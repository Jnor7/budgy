# Sauvegarde pré-migration Supabase → Neon

## Statut

**BACKUP TÉLÉCHARGÉ, CONTRÔLÉ ET RESTAURÉ SUR UNE BRANCHE NEON ISOLÉE.**

Le projet Supabase `Budgy` est actuellement indiqué comme « paused » dans le Dashboard. Le backup téléchargeable fourni par Supabase a été copié localement dans ce dossier protégé par `.gitignore`. La production n'a pas été reprise, modifiée ou restaurée.

## Métadonnées

- Date de préparation : 13 septembre 2026
- Date du backup réel : 9 septembre 2026 à 17:54:51, d'après le nom fourni par Supabase
- Source : projet Supabase `Budgy`, référence publique `czkdlpckpzgujnvpprla`
- Destination : `backup/db_cluster-09-09-2026@17-54-51.backup.gz`, hors Neon et ignoré par Git
- Méthode utilisée : téléchargement « Database backup » depuis le Dashboard Supabase du projet en pause
- Format : dump SQL de cluster PostgreSQL compressé avec gzip
- Base source : PostgreSQL 17.6
- Outil source : `pg_dump` 17.11
- Taille compressée : 254 066 octets
- Taille décompressée contrôlée : 1 100 493 octets
- SHA-256 : `E2F0F8EF4C326E3D39112BA05668680FC90C5123884ED3D48AB920D1C922AFC0`
- Intégrité gzip : OK, lecture complète sans erreur

## Contenu vérifié

- 33 tables du schéma `public` et 33 sections `COPY` correspondantes ;
- 4 852 lignes applicatives au total, dont 4 562 aéroports ;
- 22 fonctions `public` ;
- 6 triggers Budgy, dont 5 sur `public` et le trigger de provisionnement sur `auth.users` ;
- 0 enum `public`, conforme à l'audit ;
- 118 contraintes `public` détectées dans le dump ;
- 62 indexes `public` détectés dans le dump.

Les objets `auth`, `storage` et `realtime` ne font pas partie de la copie Neon, mais la sauvegarde de sécurité source doit conserver les éléments nécessaires à une restauration Supabase complète selon la méthode officiellement supportée. Les objets Storage eux-mêmes nécessitent une sauvegarde séparée : un dump PostgreSQL ne contient que leurs métadonnées.

## Fichier conservé

- `db_cluster-09-09-2026@17-54-51.backup.gz` : dump de cluster fourni par Supabase.

Le fichier est ignoré par Git grâce à [`backup/.gitignore`](.gitignore). Aucun fichier de données personnelles ne doit être ajouté à l'index Git. Une seconde copie sécurisée hors du poste reste recommandée.

## Procédure de création effectuée

1. Authentification manuelle au Dashboard Supabase.
2. Vérification du projet `Budgy` et de sa référence.
3. Téléchargement du backup de base proposé pour le projet en pause.
4. Copie locale vers `backup/`, sans déplacement ni suppression du téléchargement original.
5. Comparaison taille/hash entre l'original et la copie : identiques.
6. Décompression complète en mémoire : aucune erreur gzip.
7. Analyse structurelle et comptage des 33 sections `COPY` sans afficher de données personnelles.
8. Vérification syntaxique de 185 références utilisateur importantes : 0 UUID invalide, 0 référence sans profil dans l'échantillon relationnel ciblé.

## Procédure de restauration prévue

1. Créer une base de restauration isolée et compatible avec la version PostgreSQL source.
2. Activer les extensions compatibles nécessaires, notamment `pgcrypto`.
3. Restaurer les rôles uniquement dans une cible Supabase compatible ; ne pas restaurer les rôles Supabase dans Neon.
4. Restaurer le schéma dans une transaction avec arrêt immédiat sur erreur.
5. Restaurer les données via `COPY` dans l'ordre compatible avec les contraintes.
6. Réactiver séparément les publications Realtime seulement dans une restauration Supabase.
7. Comparer les 33 row counts, les checksums/échantillons et les contrôles relationnels.
8. Restaurer séparément les objets des buckets si une restauration fonctionnelle Supabase est recherchée.

## Validation de restauration

- Le dump est présent, non vide, hashé et structurellement lisible.
- Aucun secret n'a été ajouté au dépôt.
- Une restauration sélective du schéma applicatif `public` a été exécutée le 13 septembre 2026 dans la branche Neon isolée `migration-supabase`.
- Les 33 tables et 4 852 lignes ont été retrouvées, avec 33/33 counts identiques, 18 échantillons conformes et aucun orphelin dans les contrôles relationnels ciblés.
- Cette preuve ne couvre volontairement pas les schémas Supabase `auth`, `storage`, `realtime`, les rôles ou les objets internes.

Référence officielle : https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
