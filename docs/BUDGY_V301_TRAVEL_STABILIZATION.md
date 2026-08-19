# Budgy V3.0.1 — Travel Mobile Stabilization

## Objectif

Cette passe stabilise Travel sur iPhone/Safari/PWA sans modifier la direction visuelle V3 ni les règles de collaboration existantes.

## Correctifs livrés

### Formulaires mobiles

- Tous les contrôles éditables d'une `FormModal` passent à `16px` minimum sous 768 px afin d'empêcher le zoom automatique de Safari.
- La hauteur de la modale suit `100dvh`, tient compte des safe areas et conserve une zone de défilement interne lorsque le clavier réduit le viewport.
- Les champs `datetime-local` Départ/Arrivée d'un vol sont empilés sur mobile. Ils restent côte à côte sur les écrans plus larges.
- Aucun autofocus, `focus()` ou `scrollIntoView()` n'a été ajouté.
- Les callbacks de fermeture/soumission sont conservés dans des références stables : un rerendu provoqué par une frappe ne démonte plus l'effet de la modale et ne rend plus le focus au bouton d'ouverture.
- Le nombre de voyageurs est borné à 1 minimum dès la saisie.

### Création et édition

- La modale Nouveau voyage se ferme après validation, sans navigation ni rechargement, pendant que la liste optimiste se met à jour.
- Les modales vol, logement et activité se ferment également après une création ou une modification réussie.
- Le formulaire logement couvre le nom, l'adresse/ville, les dates, les heures de check-in/out, le prix, la référence de réservation et les notes en réutilisant les colonnes existantes.
- Depuis l'aperçu d'un voyage, une carte vide Vol, Logement ou Activité ouvre directement le bon formulaire.

### Couvertures Unsplash

Cause principale identifiée : la recherche de couverture était déclenchée juste après la création optimiste du voyage. L'`update` de la photo pouvait atteindre Supabase avant la fin de l'`insert`, puis être perdu.

Le `DataProvider` sérialise maintenant toute mise à jour d'une entité nouvellement créée derrière son insertion distante. Les libellés de recherche sont en plus normalisés pour les destinations de référence :

- Dubaï / Émirats arabes unis → `Dubai UAE travel skyline`
- Tokyo / Japon → `Tokyo Japan travel skyline`
- New York / États-Unis → `New York USA travel skyline`
- Paris / France → `Paris France travel skyline`

Les réponses d'échec ne sont pas mises en cache. Le fallback premium reste visible si la clé manque, si Unsplash répond en erreur ou si aucun résultat n'est disponible. L'édition d'un voyage propose l'action manuelle **Rafraîchir la photo** ; aucune relance automatique en boucle n'est effectuée.

### Finition visuelle

- Le fallback de couverture ne dessine plus de drapeau décoratif. Le seul drapeau principal reste placé à côté du nom du voyage.
- Le menu `…` utilise un popover compact, opaque et lisible avec les actions Modifier et Supprimer.

## Tests de non-régression

- fermeture de la modale de création sans navigation ;
- maintien du focus lors des rerendus de saisie ;
- ordre `insert` puis `update` pour la persistance de couverture ;
- requêtes des quatre destinations de référence ;
- réponse photo valide et fallback réseau ;
- absence de second drapeau ;
- libellés du menu d'actions ;
- structure responsive des dates de vol ;
- champs complets du logement.

Validation manuelle recommandée sur iPhone/PWA : viewport 390 × 844, puis viewport réduit avec un champ actif pour simuler le clavier. Vérifier l'absence de zoom, de débordement horizontal, de retour en haut et de changement d'onglet.
