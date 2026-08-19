# Budgy V3.0.3 — Last Travel Fixes

## Périmètre

Cette mini-passe ne modifie que :

1. le diagnostic serveur Unsplash ;
2. la confirmation avant une demande d’ami de voyage ;
3. le rendu mobile partagé des champs date/heure.

Le dashboard Voyages, le détail Voyage hors formulaires, l’airport picker, les dépenses, la checklist, les membres, les couleurs, la navigation, Business, Budget et Loyers n’ont pas été remaniés.

## 1. Cause racine Unsplash

### Conclusion

La cause racine est l’absence de `UNSPLASH_ACCESS_KEY` dans le runtime du projet Vercel réellement servi. Le handler quitte donc volontairement la route avant `fetch("https://api.unsplash.com/search/photos")`.

Ce n’est pas un problème de requête, de parsing JSON, d’authentification Unsplash, de sélection de résultat, de persistance Supabase ou de rendu `TravelCover` : ces étapes ne sont jamais atteintes en production.

### Preuves Vercel

- Compte/scope CLI : `gesjuniorm-9379` / `gesjuniorm-9379s-projects`.
- Projet : `budgy`.
- Project ID : `prj_xlMZwVSkNdKJL9UIIX9sv5XNup3c`.
- Alias production : `https://budgy-iota-green.vercel.app`.
- Déploiement inspecté : `dpl_FTNN7zsiw7obnw47TQhcVjSujLmz` (`budgy-94dlbww4s-gesjuniorm-9379s-projects.vercel.app`).
- `vercel env ls production --project budgy --json` et la même commande pour Preview ne retournent que :
  - `NEXT_PUBLIC_SUPABASE_URL` ;
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ;
  - `NEXT_PUBLIC_BUDGY_DATA_MODE`.
- `UNSPLASH_ACCESS_KEY` n’apparaît dans aucun des deux environnements.
- Le seul fichier local qui mentionne la variable est `.env.example`, avec une valeur vide.

Le tableau de bord qui affiche la clé ne correspond donc pas à l’environnement du Project ID ci-dessus, ou la modification n’a pas été enregistrée/appliquée à ce projet. Le compte CLI ne contient que deux projets (`budgy` et `jrs-watchbook`), et l’alias public pointe bien vers le projet inspecté.

### Preuves d’exécution production

Les logs du déploiement actif montrent des appels authentifiés réels :

| Requête | Route atteinte | Diagnostic | Statut fournisseur | Appel Unsplash |
|---|---:|---|---:|---:|
| `Tokyo Japan travel` | oui | `configuration_missing` | `0` | non |
| `Dubai UAE travel` | oui | `configuration_missing` | `0` | non |

La route HTTP Budgy répond `200` avec le fallback diagnostiqué, mais `status: 0` signifie qu’aucune réponse fournisseur n’existe : le `fetch` Unsplash n’a pas été exécuté.

### Quatre requêtes serveur demandées

Le handler a été exécuté directement dans les tests avec un espion sur `fetch` :

| Requête normalisée | JSON retourné | Nombre d’appels `fetch` |
|---|---|---:|
| `Tokyo Japan travel` | `provider=fallback`, `configuration_missing`, `status=0` | 0 |
| `Dubai UAE travel` | `provider=fallback`, `configuration_missing`, `status=0` | 0 |
| `Paris France travel` | `provider=fallback`, `configuration_missing`, `status=0` | 0 |
| `New York USA travel` | `provider=fallback`, `configuration_missing`, `status=0` | 0 |

### Pipeline exact

1. Le voyage déclenche un `GET /api/travel/destination-image` ; il n’existe pas de `POST` pour ce parcours.
2. La route est atteinte après le proxy d’authentification.
3. `process.env.UNSPLASH_ACCESS_KEY` est vide dans la fonction Vercel.
4. Le garde `if (!accessKey || !destination)` retourne immédiatement le fallback.
5. Aucun statut HTTP Unsplash, aucun JSON Unsplash et aucun résultat sélectionné n’existent.
6. `resolveCover` refuse correctement le fallback ; aucune mise à jour Supabase n’est tentée.
7. `TravelCover` conserve le fallback existant.
8. Le toast de succès reste impossible tant qu’une vraie photo `provider=unsplash` n’a pas été récupérée puis persistée par `updateAndWait`, suivie de `reload`.

### Correction de diagnostic

Les logs serveur ont été resserrés aux seuls champs autorisés :

```text
provider
status
code
message
```

La clé, la valeur du header `Authorization` et les données utilisateur ne sont jamais journalisées. Le fallback existant est conservé.

### Action de configuration indispensable

Ajouter `UNSPLASH_ACCESS_KEY` au projet Vercel dont l’ID est `prj_xlMZwVSkNdKJL9UIIX9sv5XNup3c`, pour Production et Preview, puis créer un nouveau déploiement. L’ajout à un autre projet, scope ou déploiement ne peut pas injecter la variable dans la fonction actuelle.

Après redéploiement, le diagnostic attendu pour une requête valide est `provider=unsplash`, `status=200`, `code=ok`. Un `401`, `403` ou `429` sera désormais identifiable directement dans `status`, `code` et `message`.

## 2. Confirmation avant demande d’ami

Le parcours est désormais :

1. saisie de deux caractères ou plus ;
2. affichage des profils et avatars ;
3. tap sur un profil = sélection uniquement ;
4. ouverture d’une confirmation affichant avatar et pseudo ;
5. `Annuler` n’envoie rien ;
6. `Envoyer la demande` appelle la RPC ;
7. après succès, toast `Demande envoyée` et statut correspondant dans les résultats rechargés.

Un profil déjà ami affiche `Déjà ami`. Une demande sortante existante affiche `Demande envoyée`. Ces deux résultats sont désactivés et n’ouvrent aucune confirmation.

`FormModal` possède maintenant une option additive `closeOnSubmit={false}` afin que cette confirmation en deux temps n’entraîne pas la fermeture prématurée du formulaire. Le comportement par défaut de toutes les autres modales reste inchangé.

## 3. Dates et heures mobiles

### Composants corrigés

- Nouveau composant partagé `DateTimeField` dans `components/ui/premium.tsx`.
- Il remplace le contrôle natif `datetime-local`, dont la chaîne française est difficile à contraindre sur Safari iOS, par deux contrôles natifs courts : `date` + `time`.
- `Nouveau vol` utilise un `DateTimeField` pleine largeur pour Départ et un autre pour Arrivée.
- `Nouvelle activité` utilise un `DateTimeField` pleine largeur.
- Les dates de Logement s’empilent automatiquement jusqu’à 390 px ; Check-in et Check-out restent côte à côte.
- La règle commune `FormModal` contraint tous les enfants de grille avec `min-width: 0`, `width/max-width: 100%` et masque tout dépassement interne des contrôles natifs.
- Tous les inputs mobiles conservent `font-size: 16px` pour éviter le zoom Safari.

### Validation navigateur réelle

| Largeur | Parcours | Résultat mesuré |
|---:|---|---|
| 375 px | Nouveau vol | dates ≈ 186 px, heures ≈ 96 px, font 16 px, aucun overflow document/modale/contrôle |
| 390 px | Nouveau vol | dates ≈ 200 px, heures ≈ 96 px, font 16 px, aucun overflow |
| 430 px | Nouveau vol | dates ≈ 232 px, heures ≈ 104 px, font 16 px, aucun overflow |
| 390 px | Nouveau logement | dates pleine largeur ≈ 304 px et empilées ; heures ≈ 147 px côte à côte ; aucun overflow |
| 430 px | Nouvelle activité | contrôle partagé ≈ 354 px ; aucun overflow |

Les chaînes localisées longues ne sont plus rendues dans un unique `datetime-local` compressé.

## Tests ajoutés

`tests/v303-last-travel-fixes.test.tsx` couvre :

- les quatre destinations et la preuve que `fetch` n’est pas appelé sans clé runtime ;
- le contrat de logs sans secret ;
- l’absence d’envoi au simple tap et l’envoi après confirmation ;
- les statuts `Déjà ami` et `Demande envoyée` ;
- la recomposition date/heure ;
- le contrat CSS partagé à 375, 390 et 430 px ;
- l’absence de `datetime-local` dans les formulaires Travel.

## Validation finale

- `npm run lint` : réussi.
- `npm run typecheck` : réussi.
- `npm test` : 29 fichiers réussis, 157 tests réussis, 1 test ignoré (158 au total).
- `npm run build` : réussi, 22 pages générées et route `/api/travel/destination-image` compilée en dynamique.
- `git diff --check` : réussi.

Les seuls avertissements sont préexistants : chargement futur de la configuration Vite et `package-lock.json` externe ignoré par Turbopack.
