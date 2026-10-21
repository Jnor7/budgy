# Connexion durable et synchronisation multi-appareils

## Causes racines du bug de connexion

1. **`proxy.ts` ne renouvelait jamais la session.** Il appelait `auth.getSession()`, qui écrit le cache
   `session_data` via `next/headers`, interdit dans le proxy : le cookie renouvelé était perdu et chaque
   navigation retombait sur Neon Auth. Pire, toute erreur amont (réseau, 5xx) était lue comme
   « pas de session » → redirection vers `/auth` (fausse déconnexion). Le proxy utilise maintenant
   `handleAuthProxyRequest` (gestionnaire officiel), recopie ses `Set-Cookie`, et ne redirige que si
   Neon Auth répond explicitement « pas de session » (`lib/auth/access.ts`).
2. **`/api/data/*` répondait 401 de façon intermittente** (reproduit : à partir d'environ 7 min de session,
   un appel sur deux). `auth.token()` était rappelé à chaque requête et toute défaillance ponctuelle devenait
   `401 Unauthorized`. `lib/auth/data-token.ts` met le JWT en cache par session (clé = hash, expiration lue
   dans le JWT, 5 min max), réessaie 3 fois, et ne répond 401 que si la session est refusée ; sinon 503 réessayable.
3. **`DataProvider` ignorait la session.** Il chargeait une fois au montage, avec `ready=true` même en cas
   d'échec. Après un login, le profil et les données n'apparaissaient qu'après un rechargement. Il suit
   maintenant `useAuthSession()` : écran de chargement tant que la session n'est pas résolue, chargement
   automatique à la connexion (nouvel essai avec backoff, sans `reload()` ni délai artificiel), purge des
   données au changement de compte ou à la déconnexion.
4. **Service worker v2** mettait en cache toutes les réponses same-origin (pages, `/api/auth/*`, `/api/data/*`)
   et servait `/` hors ligne pour n'importe quelle requête. v3 ne met en cache que `/_next/static`, `/icons`,
   `/icon.svg`, ne touche jamais aux navigations ni aux API, et supprime les anciens caches à l'activation.
5. Correctif mineur : le paramètre `next` de `/auth` refuse `//hôte-externe` (redirection ouverte).

## Synchronisation (≈ 1–2 s)

Neon n'a pas de Realtime. Solution retenue : **versions de synchronisation + sondage adaptatif**.

- Migration `supabase/migrations/20261020120000_sync_versions.sql` (additive, **non appliquée à la base vivante**) :
  table `sync_versions(user_id, domain, version)`, triggers *statement-level* sur 18 tables (domaines `finance`,
  `rent`, `business`) et RPC `get_sync_versions()` (RLS : chaque utilisateur ne lit que ses compteurs).
  Les triggers sont au niveau des tables : **les écritures d'ATLAS (`atlas_write.apply_operations`), les imports
  et toute écriture SQL sont couverts**. Les triggers sont `SECURITY DEFINER` : aucun droit supplémentaire pour `atlas_writer`.
- Client (`lib/sync/sync-engine.ts`) : un appel léger `get_sync_versions` toutes les 2 s (5 s après 1 min sans activité,
  15 s après 5 min), arrêt onglet caché, vérification immédiate au retour (focus, `visibilitychange`, `pageshow`, `online`).
  Seuls les domaines modifiés sont rechargés. Backoff exponentiel hors ligne.
- Sans la migration, l'application bascule d'elle-même en rechargement complet toutes les 15 s (dégradé, rien ne casse).
- Écritures locales : mises à jour optimistes existantes avec retour arrière visuel ; tant qu'une écriture locale est en
  cours, aucun rechargement distant ne remplace l'écran. Les mises à jour n'envoient que les champs modifiés : deux appareils
  qui modifient des champs différents d'une même ligne ne s'écrasent pas (même champ : le dernier écrit gagne). La base reste la source de vérité.
- Voyages partagés : conservent leur sondage collaboratif existant (7 s / 2 s), les données y appartiennent à plusieurs comptes.

## Tests réels (build de production, HTTPS, 2 appareils Chromium, branche Neon de test `atlas-v5-test` avec la migration appliquée)

20/20 scénarios passés : accès sans session → `/auth` ; login par l'interface → accueil et données sans reload ni écran
déconnecté ; fermeture/réouverture ; refresh ; cache de session expiré ; création / modification / suppression A→B ;
coupure réseau puis reconnexion (écran intact, rattrapage 190 ms après le retour) ; modifications concurrentes de
champs différents (aucune perte, aucun doublon) ; écriture ATLAS (`apply_operations`) visible ; isolation entre deux
utilisateurs (API, écran, `get_sync_versions`) ; changement de compte dans le même navigateur ; service worker (seules
des ressources statiques en cache).

**Délais mesurés A→B (du POST au rendu sur l'autre appareil, 12 échantillons)** : min 0,14 s, médiane 1,4 s, max 2,4 s.
Écriture ATLAS → affichage : 1,7 s. Sans la correction du 401 intermittent, la session « décrochait » vers 7 min (reproduit) ;
après correction : 360 appels sur 12,5 min sans aucun 401.

Limites : tests faits sur Chromium (WebKit/iPhone/PWA installée à valider sur vrais appareils) ; temps réel garanti
tant que l'application est au premier plan (onglet caché = pause, rattrapage immédiat au retour).

## Déploiement (Vercel)

1. Merge/push du code : aucune variable d'environnement nouvelle. Sans migration SQL, la synchro fonctionne en mode dégradé (15 s).
2. Appliquer la migration sur la branche Neon vivante (`migration-supabase`) : un seul script, additif, quelques secondes.
3. Le nouveau service worker remplace l'ancien automatiquement à la prochaine ouverture (cache `budgy-static-v3`, anciens caches supprimés).

## Retour arrière

- Code : `git revert` du commit (ou redéploiement de la version précédente dans Vercel).
- SQL (si la migration a été appliquée) :

```sql
drop function if exists public.get_sync_versions();
do $$ declare t text; begin
  for t in select distinct event_object_table from information_schema.triggers where trigger_name in ('sync_ins','sync_upd','sync_del') and trigger_schema='public' loop
    execute format('drop trigger if exists sync_ins on public.%I', t);
    execute format('drop trigger if exists sync_upd on public.%I', t);
    execute format('drop trigger if exists sync_del on public.%I', t);
  end loop; end $$;
drop function if exists public.bump_sync_insert(), public.bump_sync_update(), public.bump_sync_delete();
drop table if exists public.sync_versions;
```
