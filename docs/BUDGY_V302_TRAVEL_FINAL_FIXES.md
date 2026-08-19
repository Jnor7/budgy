# Budgy V3.0.2 — Travel Final Fixes

## Cause racine Unsplash

Le blocage de production n'était ni la requête de destination, ni `Next/Image`, ni Supabase.

Le 19 août 2026, l'inventaire du projet Vercel réellement servi (`budgy`, production `https://budgy-iota-green.vercel.app`) a été contrôlé avec la CLI Vercel :

- Production : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BUDGY_DATA_MODE` ;
- Preview : les trois mêmes variables ;
- Development : aucune variable ;
- `UNSPLASH_ACCESS_KEY` : absente des trois environnements.

Les logs de production montrent que des appels authentifiés atteignaient bien `/api/travel/destination-image` avec un statut 200. L'ancienne route lisait alors une clé absente et retournait immédiatement un fallback HTTP 200 sans diagnostic. C'est la cause réelle des gradients permanents. Les appels directs non authentifiés sont redirigés vers `/auth` par `proxy.ts` (307), comportement attendu et distinct de la panne observée dans l'application authentifiée.

La clé n'est jamais lue depuis une variable `NEXT_PUBLIC_*` et n'est jamais journalisée. Pour rendre les photos réelles opérationnelles après déploiement, il reste à ajouter le secret serveur `UNSPLASH_ACCESS_KEY` au projet Vercel `budgy` pour Production et Preview, puis à redéployer. La valeur du secret n'était présente ni dans Vercel ni dans le dépôt et ne pouvait donc pas être recréée par cette passe.

## Pipeline corrigé

```text
Trip (destination + country + trip id)
  → /api/travel/destination-image (no-store)
  → UNSPLASH_ACCESS_KEY serveur
  → search/photos, landscape, content_filter=high, 8 résultats
  → sélection d'une photo différente lors du refresh
  → hotlink images.unsplash.com + attribution + download_location
  → updateAndWait(trips)
  → UPDATE ... SELECT id (échec si aucune ligne affectée)
  → reload du repository
  → TravelCover mise à jour
```

La route écrit maintenant un événement structuré limité à `provider`, `query`, `status`, `errorType`, `resultsCount` et `tripId`. Les causes distinguées incluent notamment `configuration_missing`, `unsplash_http_401`, `unsplash_http_403`, `unsplash_http_429`, `invalid_unsplash_payload`, `no_results` et `no_alternative_photo`.

Les requêtes de référence sont exactement :

- `Tokyo Japan travel` ;
- `Paris France travel` ;
- `Dubai UAE travel` ;
- `New York USA travel`.

Le succès conserve le hotlink Unsplash, le photographe, son lien et l'appel `download_location`. Le bouton de refresh n'affiche plus de faux succès : il attend l'écriture, vérifie qu'une ligne a été affectée, recharge les données puis actualise la cover. Son erreur utilisateur est : « Impossible de récupérer une photo pour le moment. »

Audit complémentaire : les six colonnes `cover_*` existent dans la table `trips` de production ; `TravelCover` emploie un `<img>` natif et le projet ne définit pas de CSP bloquant `images.unsplash.com` ; aucune configuration `next/image` n'intervient.

## Dates et formulaires Travel

La règle commune des `FormModal` impose désormais `width: 100%`, `min-width: 0` et `max-width: 100%` aux grilles, sections, champs et contrôles `date`, `time` et `datetime-local`. Les départ/arrivée d'un vol sont empilés sur mobile via `.travel-datetime-row`; les paires de dates simples et d'heures restent à deux colonnes avec des cellules réductibles.

Les largeurs 375, 390 et 430 px sont couvertes par les tests de contrat CSS et par la validation navigateur.

## Amis et avatars

La recherche démarre à deux caractères, après un debounce de 300 ms, et affiche six résultats au maximum. Les états initial, un caractère, recherche en cours, résultat vide, ami existant et demande envoyée sont explicites. Le résultat ne transporte que `user_id`, `username` et `avatar_url`.

La migration `20260819200122_travel_friend_search_v302.sql` crée `search_travel_profiles` avec :

- `SECURITY DEFINER` justifié par la visibilité RLS volontairement restreinte de `profiles` ;
- `search_path = ''` et noms qualifiés ;
- refus sans `auth.uid()` ;
- préfixe minimal de deux caractères ;
- limite serveur maximale de huit ;
- révocation de `PUBLIC` et `anon`, exécution accordée uniquement à `authenticated`.

La migration a été appliquée au projet Supabase Budgy et vérifiée : le type de retour ne contient aucun e-mail et les privilèges sont limités à `postgres`, `authenticated` et `service_role`. Les recommandations suivent la documentation officielle [Database Functions](https://supabase.com/docs/guides/database/functions) et [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Un seul résolveur d'avatar alimente désormais les listes d'amis, demandes, membres, hero, aperçu, dépenses partagées et checklist : `profiles.avatar_url`, puis initiales via `V2Avatar`.

## Catégorie de transaction

Les nouvelles transactions et actions rapides utilisent `value = ""` et `placeholder = "Autre"`. Les chips continuent de renseigner le champ. Le fallback métier `Autre` n'est appliqué qu'au submit avec `transactionCategory`. Le champ équivalent d'abonnement rapide suit la même règle.

## Tests et validation

- clé absente, erreur HTTP identifiable, réponse photo valide, hotlink/attribution/download tracking ;
- refresh réellement attendu et cover mise à jour ;
- 375, 390 et 430 px ;
- 0/1 caractère sans requête, deux caractères, debounce, limite, avatar et absence d'e-mail ;
- valeur catégorie vide, placeholder, chip et fallback au submit ;
- lint, typecheck, suite Vitest, build de production et `git diff --check`.

Les alertes Supabase Advisor éventuellement encore listées concernent des fonctions et policies antérieures à V3.0.2 ; la nouvelle RPC n'est pas exposée au rôle anonyme. Voir le guide du [Database Linter](https://supabase.com/docs/guides/database/database-linter).
