# Budgy V3 — Travel Reimagined & Collaboration

## Périmètre livré

La V3 refond uniquement le module Voyages. Les modules Accueil, Budget, Business, Loyers, Dubaï et Abonnements ne sont pas restructurés. Les données historiques restent compatibles : les nouvelles colonnes SQL ont des valeurs par défaut et les sauvegardes locales antérieures sont complétées en mémoire avec les nouvelles collections.

## Audit de l’existant

La livraison réutilise sans les recréer :

- `trips`, `trip_members`, `trip_invitations`, `notifications` ;
- `trip_expenses`, `trip_expense_splits`, `trip_checklist_items.assigned_to` ;
- `trip_role`, `can_view_trip`, `can_edit_trip`, `can_manage_trip_members` ;
- `invite_to_trip`, `respond_trip_invitation` ;
- le `FormModal` V2.5.7 et ses confirmations de formulaire sale.

## Refonte Voyages

`/trips` devient un dashboard Voyage avec filtres À venir, Passés et Partagés, une grande carte pour le prochain départ, des cartes compactes, un budget consommé, le nombre de voyageurs et un accès aux amis de voyage.

`/trips/[id]` possède une cover immersive, les avatars, cinq résumés et cinq sections internes : Aperçu, Itinéraire, Dépenses, Checklist et Membres. L’espacement bas respecte la bottom navigation et les contrôles restent horizontaux et défilables sur les petits écrans.

## Images de destination

`DestinationImageProvider` isole tous les composants du fournisseur. Le fournisseur initial appelle la route serveur `GET /api/travel/destination-image`. Avec `UNSPLASH_ACCESS_KEY`, elle demande une image paysage filtrée, redimensionne l’URL à 1600 px et renvoie les métadonnées d’attribution. Ces données sont stockées une seule fois sur le voyage.

Sans clé, résultat ou réseau, la route et le client renvoient un fallback. `TravelCover` remplace également une URL historique cassée par un gradient bleu–turquoise, le drapeau ISO et la destination. Aucune clé n’est exposée dans le navigateur.

Variable serveur :

```env
UNSPLASH_ACCESS_KEY=
```

## Destinations et drapeaux

La création initiale reste courte : destination, pays, départ, retour, voyageurs et budget cible. Un petit catalogue interne suggère notamment Tokyo, Dubaï, New York, Istanbul et Abidjan. L’échec ou l’absence d’autocomplétion ne bloque jamais une destination libre. Le drapeau est calculé localement depuis le code ISO à deux lettres.

## Aéroports et OurAirports

La migration crée `public.airports`, en lecture seule pour `authenticated`, et la RPC `search_airports`. Les index couvrent IATA, municipalité et pays. Le picker conserve aussi le catalogue embarqué d’environ 200 aéroports : CDG, ORY, DXB, DWC, ABJ, etc. Le formulaire de vol n’accepte donc pas un nom d’aéroport libre.

L’import reproductible filtre `large_airport` et `medium_airport` avec code IATA :

```powershell
$env:SUPABASE_URL="https://PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm run airports:import
```

La clé service role n’est utilisée que par le script local d’administration et ne doit jamais être ajoutée à Vercel ou préfixée par `NEXT_PUBLIC_`. Le dump officiel OurAirports est téléchargé à l’exécution ; aucun CSV volumineux n’est commité. Les données OurAirports sont publiées dans le domaine public et mises à jour chaque nuit : <https://ourairports.com/data/>.

## Vols, logements, activités et itinéraire

Les vols stockent désormais compagnie/IATA, numéro, horaires complets, terminaux, porte et référence. `AirlineProvider` fournit un catalogue interne et ne dépend d’aucune API aviation payante. Les cartes sont rendues comme des boarding passes.

Les logements ajoutent horaires de check-in/check-out et image facultative. Les activités ajoutent catégorie, durée et indicateur de prix par personne. La timeline fusionne et trie vols, check-ins et activités par date.

## Amis de voyage

Les amis restent strictement confinés au module Voyage : aucun profil social global ni liste publique.

La migration ajoute :

- `travel_friend_requests` pour les transitions pending/accepted/declined/cancelled ;
- `travel_friends` pour une paire canonique unique ;
- `send_travel_friend_request`, `respond_travel_friend_request`, `remove_travel_friend` ;
- `find_travel_user`, recherche exacte par pseudo et sans annuaire public.

Les amis sont proposés dans l’onglet Membres d’un voyage, puis l’invitation continue d’utiliser les RPC et tables V2 `trip_invitations` / `trip_members`.

## Permissions et RLS

Les rôles existants restent la seule logique d’autorisation : owner, editor, viewer. Les écrans masquent les actions impossibles, mais PostgreSQL reste l’autorité.

Les nouvelles tables sociales :

- révoquent tous les droits client par défaut ;
- ne rendent que `SELECT` à `authenticated` ;
- limitent la lecture aux deux utilisateurs concernés ;
- n’exposent aucune écriture directe ;
- effectuent les transitions via des fonctions `SECURITY DEFINER` avec contrôle explicite de `auth.uid()` et `search_path = ''` ;
- révoquent l’exécution à `public` et la rendent seulement à `authenticated`.

La table `airports` active également RLS et n’est lisible que par un utilisateur authentifié. Cette stratégie suit la documentation Supabase actuelle sur les grants et RLS : <https://supabase.com/docs/guides/database/postgres/row-level-security>.

## Dépenses partagées et balances

Le backend V2 est conservé. Le formulaire V3 permet : payeur, participants, catégorie, partage égal au centime et partage personnalisé. La validation empêche l’enregistrement si la somme des parts diffère du total.

Les balances partent du bilan net et proposent un nombre réduit de transferts. La V3 n’ajoute pas un faux bouton de règlement : `is_settled` appartient aujourd’hui à une part de dépense, tandis qu’une proposition simplifiée peut agréger plusieurs dépenses. Un futur ledger de règlements sera nécessaire pour marquer proprement un transfert simplifié.

## Checklist collaborative

L’interface expose `assigned_to`, les filtres Tout / À faire / Terminé / À moi et la progression. La création permet Moi, un membre ou Non assigné. Une notification est créée uniquement lors d’une nouvelle assignation à un autre membre.

## Notifications et temps réel

Les notifications V3 couvrent demande d’ami, ami accepté, invitation, membre rejoint, nouvelle dépense et tâche assignée. Les triggers ne notifient pas un auteur de sa propre action et ne réagissent pas aux changements mineurs.

La migration ajoute les tables Voyage à `supabase_realtime` si la publication existe. Le provider client écoute les changements structurants et regroupe les rafraîchissements sur une courte fenêtre. Les RLS continuent de filtrer les événements visibles, conformément au guide Postgres Changes : <https://supabase.com/docs/guides/realtime/postgres-changes>.

## Migration

Migration unique : `supabase/migrations/20260819145454_v3_travel_reimagined.sql`.

Elle est additive et ne recrée aucune table V2. Elle contient uniquement les métadonnées de cover/destination, les champs de cartes enrichies, les aéroports, les amis Voyage, les notifications structurantes et la publication Realtime.

## Tests

La couverture automatisée inclut : fallback image, destination/drapeau, catalogue compagnie, timeline, recherche aéroport existante, permissions voyage, split égal, split personnalisé, validation, balances, contrat RPC amis, RLS et triggers de notification. Le smoke test SQL V3 vérifie les tables, l’activation RLS, les policies et les privilèges des RPC.

Commandes de validation :

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

## Limites restantes

- Le cache de cover est persistant par voyage, mais il n’existe pas encore de table de cache partagée entre destinations de voyages différents.
- Le catalogue destination interne est volontairement court et non bloquant ; une future API géographique peut implémenter la même abstraction.
- Le picker utilise immédiatement le catalogue embarqué. La recherche Supabase exhaustive dépend de l’exécution du script OurAirports après migration.
- Le règlement d’un transfert simplifié nécessite un ledger dédié ; aucune simulation locale trompeuse n’est stockée.
- Les tests pgTAP requièrent une instance Supabase locale ou liée ayant appliqué les migrations.

Le dépôt n’a été ni poussé ni déployé.
