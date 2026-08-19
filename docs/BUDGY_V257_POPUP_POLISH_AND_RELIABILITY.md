# Budgy V2.5.7 — Popup Polish & Reliability

## Périmètre

Cette version améliore exclusivement les popups, les formulaires de saisie et leur fiabilité. Elle ne modifie ni les routes métier, ni le schéma, ni Supabase, ni les politiques RLS, ni les calculs financiers.

## Finition visuelle

Le système partagé `FormModal` a été recalibré pour obtenir un rendu plus lumineux et plus proche d'une interface iPhone native :

- fond blanc chaud, sections blanches et disparition des grands aplats gris ;
- overlay plus net, moins délavé, avec un blur mieux dosé ;
- ombre plus profonde, contour clair et lumière interne discrète ;
- titre renforcé, labels mieux alignés et hiérarchie typographique régularisée ;
- champs, montants et dates alignés sur une hauteur commune de 48 px ;
- dates verticalement centrées, icône mieux espacée et chiffres tabulaires ;
- segmented controls, chips et fractions de paiement redimensionnés ;
- CTA de 52 px, mieux intégré au pied fixe et plus lisible ;
- mode compact quand le clavier réduit fortement la hauteur disponible.

Les accents contextuels restent limités aux icônes, bordures, focus, contrôles actifs et CTA : corail pour les dépenses, vert pour les revenus, cyan pour les loyers et voyages, ambre pour Dubaï, rose pour les abonnements.

## Fiabilité de fermeture

`FormModal` détecte désormais une modification à partir des saisies, changements de sélection, toggles et chips.

- Un formulaire intact se ferme directement par X, Échap ou clic sur l'overlay.
- Un formulaire modifié affiche une confirmation : « Quitter ce formulaire ? ».
- « Continuer la saisie » revient au formulaire sans perdre son état.
- « Quitter sans enregistrer » ferme le popup après confirmation.
- La soumission normale ne déclenche jamais cette alerte.

Cette règle est commune à tous les formulaires déjà migrés vers `FormModal` : budget, loyers, Dubaï, voyages, abonnements, locataires, business générique et collaboration.

## Clavier iPhone

L'autofocus des montants a été neutralisé dans le composant partagé. Le sélecteur d'aéroport n'autofocus plus son champ de recherche. Aucun clavier ne doit donc apparaître à l'ouverture d'un popup : il faut d'abord toucher un champ.

Quand la hauteur disponible diminue, le popup utilise presque tout le `dvh`, réduit son icône et conserve son header, son scroll interne et son CTA.

## Confirmation de copie du budget

La copie mensuelle ne s'exécute plus directement depuis la page Budget ni depuis son paramètre d'action. Un dialogue explique maintenant :

- le mois source ;
- le mois cible ;
- que les transactions seront copiées ;
- que les doublons exacts seront ignorés.

L'action rapide de l'accueil utilise le même dialogue et le CTA explicite « Copier le budget ».

## Correction Business Dubaï

### Cause racine

Budgy utilise la valeur métier `FCFA`, mais `Intl.NumberFormat` attend un code monétaire ISO. Selon le moteur du navigateur, le passage direct de `FCFA` pouvait lever une `RangeError`. Une préférence locale ancienne ou invalide pouvait aussi être réinjectée sans validation. L'exception survenait pendant le rendu et produisait « This page couldn't load ».

### Correction

- `FCFA` et l'ancienne valeur `CFA` sont normalisés vers le code ISO `XAF` uniquement au moment du formatage ;
- les valeurs de devise Dubaï sont validées avant utilisation ;
- une préférence inconnue retombe sur `AED` ;
- la lecture et l'écriture de `localStorage` sont protégées pour Safari privé / PWA ;
- le rendu monétaire possède un fallback sûr si un code historique inattendu subsiste.

Les taux, montants enregistrés et calculs Dubaï ne changent pas.

## Tests et validation

Les tests V2.5.7 couvrent :

- confirmation uniquement après modification ;
- retour au formulaire et abandon confirmé ;
- fermeture directe d'un formulaire intact ;
- neutralisation de l'autofocus ;
- présence de la confirmation de copie ;
- normalisation `CFA` / `FCFA` et fallback d'une préférence invalide ;
- formatage FCFA sans exception.

Commandes de validation :

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `git diff --check`

Le contrôle réel doit être effectué aux largeurs iPhone 375, 390 et 430 px, puis à 768 et 1024 px pour vérifier la continuité responsive.
