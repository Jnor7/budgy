# Plan de migration préparatoire

Ce document décrit une exécution future. Il ne contient aucune commande prête à lancer et n'autorise aucune action distante.

## Principes de sécurité

1. Supabase reste la source de vérité jusqu'à une bascule explicitement validée.
2. Une branche Neon isolée reçoit les répétitions ; la branche de production Neon n'est pas la première cible.
3. Les UUID Budgy ne sont jamais recalculés ni remplacés en masse.
4. La RLS cible doit être testée avant l'ouverture d'un accès client ou Data API.
5. Auth, Storage et Realtime sont migrés séparément des données `public`.
6. Toute étape de bascule conserve un chemin de retour vers Supabase.

## Séquence future proposée

### 1. Sauvegarde Supabase

- Capturer un export cohérent du schéma réellement déployé et des données.
- Exporter séparément l'inventaire Auth, les comptes, les identités, les buckets et objets Storage.
- Capturer les row counts, checksums, policies, fonctions, triggers, publications et grants.
- Comparer l'état distant aux 15 migrations Git avant toute restauration.

Critère de sortie : sauvegarde restaurable, chiffrée, horodatée et testée hors production.

### 2. Création d'une branche Neon de migration

- Créer une branche dédiée à la répétition, distincte de la branche utilisée par Neon Auth en production future.
- Relever la version PostgreSQL, les extensions, le schéma `neon_auth` déjà provisionné et les rôles disponibles.
- Interdire toute connexion de Budgy production à cette branche.

Critère de sortie : branche isolée, vide de données Budgy et supprimable sans impact.

### 3. Import PostgreSQL

- Utiliser l'Import Data Assistant pour un premier essai si la base reste sous 10 Go et si son contrôle de compatibilité accepte la source.
- Exclure les schémas gérés Supabase (`auth`, `storage`, `realtime`) et leurs propriétaires/grants.
- Ne pas restaurer par-dessus `neon_auth`.
- Pour les 32 tables avec FK Auth, restaurer les données seulement après préparation d'une identité canonique ou restaurer sans ces contraintes puis les recréer vers la cible approuvée.
- Importer `airports` et les objets PostgreSQL purement portables en premier.

Critère de sortie : 33 row counts conformes, relations métier internes validées et aucun objet Supabase géré présent.

### 4. Adaptation Auth

- Confirmer sur une branche de test la structure exacte du Neon Auth activé (`neon_auth.*`) et la forme du claim JWT `sub`.
- Concevoir une table de correspondance entre `neon_auth` et l'UUID Budgy canonique.
- Concevoir une fonction d'identité courante retournant un `uuid` Budgy à partir de `auth.user_id()`.
- Remplacer le trigger Supabase `on_auth_user_created` par un provisionnement compatible Neon Auth, sans le déployer à ce stade.

Critère de sortie : spécification testable pour login, session, profil et identité canonique.

### 5. Migration users

- Exporter les utilisateurs avec leurs UUID Supabase, e-mails, états de confirmation et métadonnées nécessaires.
- Importer les comptes via l'API officiellement supportée par Neon Auth, jamais par écriture directe aveugle dans les tables gérées.
- Enregistrer pour chaque compte la correspondance `neon_auth_sub -> budgy_user_id`.
- Vérifier l'unicité, les comptes manquants, doublons d'e-mail et comptes sans profil.
- Définir le traitement des mots de passe et sessions selon les capacités confirmées au moment de l'exécution ; ne pas s'appuyer sur l'ancien guide Stack Auth sans revalidation.

Critère de sortie : bijection complète et vérifiée, avec rapport d'exceptions à zéro ou explicitement accepté.

### 6. Adaptation RLS

- Porter les 113 policies métier vers l'identité canonique Budgy.
- Ne remplacer directement `auth.uid()` par `auth.user_id()` que si types et valeurs sont prouvés identiques ; ce n'est pas l'hypothèse retenue.
- Porter les rôles `anon`/`authenticated` vers les rôles réellement fournis par Neon Data API ou Neon RLS.
- Refaire les tests multi-utilisateur, owner/editor/viewer et fail-closed.
- Ne pas porter les 8 policies Storage dans PostgreSQL.

Critère de sortie : matrice RLS verte pour accès autorisés et interdits, y compris fonctions `security definer`.

### 7. Adaptation RPC

- Conserver l'atomicité des opérations d'import, invitations, amitiés, notifications et covers.
- Remplacer l'identité Supabase dans les 21 fonctions concernées ; `set_updated_at()` est portable sans changement fonctionnel.
- Remplacer l'accès direct à `auth.users.email` dans `invite_to_trip`.
- Revoir les propriétaires, `search_path`, grants et droits `EXECUTE` des 18 fonctions `security definer`.
- Choisir le transport : Neon Data API compatible PostgREST ou endpoints serveur, sans exposer un secret PostgreSQL au navigateur.

Critère de sortie : contrats RPC et erreurs identiques ou explicitement versionnés.

### 8. Remplacement Storage

- Choisir le stockage objet cible.
- Copier séparément `budgy-attachments` (privé) et `budgy-avatars` (public).
- Reproduire upload, suppression, contrôle de taille/type, URLs publiques et URLs signées.
- Réécrire et vérifier `attachments.storage_path` et `profiles.avatar_url` si nécessaire.

Critère de sortie : échantillonnage puis contrôle exhaustif des objets référencés, des droits et des URLs.

### 9. Remplacement Realtime

- Remplacer la publication `supabase_realtime` et le canal Supabase.
- Couvrir au minimum les neuf tables réellement écoutées ; décider explicitement du traitement des trois tables seulement publiées.
- Tester deux comptes et deux appareils sur cover, itinéraire, membres, checklist, dépenses et notifications.

Critère de sortie : cohérence multi-client sans rechargement manuel pour les flux attendus.

### 10. Adaptation du code applicatif

- Conserver le contrat de `DataProvider` autant que possible.
- Remplacer Auth, repository, RPC, Storage et Realtime par couches, sans suppression prématurée du chemin Supabase.
- Garder un sélecteur d'environnement strictement serveur et sans secret `NEXT_PUBLIC_*` pour la base.

Critère de sortie : application compatible avec les deux environnements, sans accès PostgreSQL direct depuis le navigateur.

### 11. Tests double environnement

- Exécuter les mêmes scénarios fonctionnels contre Supabase et la branche Neon.
- Comparer row counts, sommes financières, contraintes, RLS, RPC, fichiers et événements collaboratifs.
- Répéter avec données anonymisées puis snapshot complet.

Critère de sortie : parité documentée et écarts acceptés explicitement.

### 12. Bascule Vercel

- Préparer une fenêtre, un gel ou un delta final pour éviter les écritures divergentes.
- Modifier les variables uniquement pendant une phase ultérieure explicitement autorisée.
- Déployer progressivement, vérifier la télémétrie et les scénarios critiques.

Critère de sortie : Budgy utilise Neon, avec contrôles post-bascule verts.

### 13. Rollback possible

- Conserver la configuration Supabase précédente et la sauvegarde pré-bascule.
- Définir un seuil et une personne responsable de la décision de retour.
- En cas d'échec, interrompre les écritures Neon, réconcilier le delta si nécessaire et repointer Vercel vers Supabase.

Critère de sortie : retour testé pendant une répétition, pas seulement documenté.

### 14. Suppression Supabase seulement bien plus tard

- Maintenir Supabase pendant une période de réversibilité définie.
- Archiver les exports et preuves de parité.
- Retirer dépendances, variables et environnement seulement après validation métier, sécurité et restauration.

Critère de sortie : décision séparée, explicite et irréversible approuvée.

## Méthode d'import retenue

L'Import Data Assistant est le premier choix pour une répétition sous 10 Go, car Neon effectue un contrôle de version/extensions et crée une branche cible. Il ne résout cependant pas la migration de Supabase Auth, Storage ou Realtime. Si l'assistant ne permet pas d'exclure proprement les schémas gérés et les objets possédés par Supabase, le repli est un export/restauration contrôlé, schéma par schéma, avec connexion non poolée et archive séparée plutôt qu'un pipe long.
