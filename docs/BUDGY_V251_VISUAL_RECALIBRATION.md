# Budgy V2.5.1 — Visual Recalibration

Date : 19 août 2026

## Intention

Cette passe conserve le socle V2.5 — motion, sheets, toasts, swipe, onboarding, Auth, navigation dynamique et ordre des modules — mais remplace les compositions trop génériques par des écrans plus denses et adaptés à chaque usage.

La synthèse appliquée est :

- Budget JR pour la structure et l'efficacité opérationnelle ;
- Watchbook pour la finesse, les surfaces et le soin du profil ;
- Budgy V2.5 pour le mouvement et le système d'interaction.

Les calculs métier, l'authentification, les données historiques, Supabase, RLS, Storage et la migration n'ont pas été modifiés.

## Typographie et densité

- La pile système Apple-like est conservée.
- Une échelle typographique explicite couvre large title, page title, section title, card title, body, secondary, caption et montants.
- Les titres de pages descendent à une échelle proche d'une application iOS ; le gras est réservé aux titres, états et chiffres utiles.
- Le rayon, le padding des cartes et les espaces verticaux ont été réduits.
- Les nombres restent tabulaires et les formateurs monétaires existants restent la source de vérité.

## Auth

La composition Auth V2.5 est conservée. Seul le slogan principal est remplacé par :

> Gérez aujourd'hui. Préparez demain.

Le fonctionnement session immédiate / confirmation e-mail reste inchangé.

## Accueil

- La carte solde violette est conservée et recalibrée : montant plus précis, KPI plus serrés et entrée discrète.
- Le bloc Budget du mois utilise un donut de 98 px, une légende compacte et la palette centralisée des catégories.
- Les lignes de l'aperçu rapide conservent les données réellement calculées : locataires et reste à percevoir, chiffre et marge business, prochain voyage, abonnements actifs.
- Une rangée horizontale d'actions rapides réelles est réintroduite. Elle est dérivée des modules actifs et mène directement à une dépense, un revenu, une copie mensuelle, un paiement de loyer, une vente ou une charge Dubaï.

## Budget

- Le header est compact et l'action Ajouter est intégrée, sans FAB surdimensionné.
- Le contrôleur de mois reprend la structure précédente/suivante de Budget JR avec une transition courte.
- La carte financière distingue clairement solde mensuel, potentiel, revenus, charges et dépenses à venir.
- Copier le mois conserve la déduplication existante et ajoute un toast contextualisé avec Annuler.
- Les catégories utilisent une palette stable : revenus verts, fixes violets, abonnements corail, variables bleues, voyages cyan, business orange et autres gris doux.
- Les transactions sont des lignes denses, pas des cartes individuelles.
- Swipe gauche révèle Supprimer ; swipe droite révèle Modifier. La suppression reste différée et annulable.
- Le menu secondaire conserve Modifier/Supprimer et ajoute Dupliquer pour Budget.
- Le formulaire commence par le montant, puis le segmented Revenu/Dépense, puis les détails groupés.

## Loyers

- La page devient un suivi opérationnel : locataires, payés, perçu et en attente.
- Une barre de collecte mensuelle donne immédiatement le taux encaissé.
- Le contrôleur de mois et les cartes locataires sont plus compacts.
- Chaque locataire conserve loyer, reports/dettes, total dû, reçu et reste, avec Paiement toujours visible.
- L'action rapide Paiement ouvre un sélecteur de locataire, puis la sheet existante.
- Un paiement ou une dette produit un toast sans refresh brutal.
- La confirmation destructive V2.5 est conservée.

## Business

- La page Business possède désormais une composition de pilotage distincte : résultat net sombre, chiffre d'affaires, tâches, réservations et environnements de gestion.
- Loyers, Dubaï et activités configurables ont des traitements colorés différents, sans copier la page Budget.

## Business Dubaï

- L'écran est organisé comme un petit cockpit import/export : références, stock, vendus, taux, résultat, investissement, potentiel, encaissé et décaissé.
- Les KPI et actions Vente/Charge/Mouvement cash sont compacts.
- Une vente lancée depuis l'accueil permet désormais de choisir sa référence dans la sheet.
- Les références montrent stock restant, potentiel, progression, achat, quantité vendue et prix cible.
- Les suppressions de références et mouvements demandent confirmation.
- Les créations et modifications importantes produisent des toasts.

## Voyages

- Les structures Vols, Logements, Activités et Checklist restent intactes.
- Les overrides V2.5.1 réduisent le header, les KPI, les boutons Ajouter, les icônes et les lignes.
- Le formulaire ne réintroduit pas de champ URL d'image.
- La création et la modification d'un voyage produisent un toast.

## Profil / Mon espace

- La page Plus devient « Mon espace ».
- L'identité utilise une surface personnelle avec avatar, pseudo et état de synchronisation.
- Quatre statistiques réelles sont affichées : transactions, voyages, activités et locataires.
- Les réglages, modules, préférences et migration restent accessibles par leurs routes fonctionnelles existantes.

## Formulaires et feedback

- `AnimatedSegmented`, `FormSection`, `Sheet`, `ToastProvider`, `ConfirmDialog` et `SuccessState` sont réutilisés.
- Les champs monétaires importants ont une hiérarchie dédiée et conservent `inputMode="decimal"`.
- Les actions petites et fréquentes utilisent des toasts ; les grandes success sheets restent réservées à la migration.

## Motion et responsive

- Les transitions de pages descendent à 5 px de translation.
- Les changements de mois, barres de progression, cartes financières et lignes swipe gardent une animation courte.
- `prefers-reduced-motion` reste respecté.
- Les règles compactes couvrent 430 px et 375 px ; la base fluide couvre 390 px.
- Les safe areas et le padding inférieur protégeant la bottom navigation sont conservés.
- Sur tablette, Budget passe à une composition résumé/listes + catégories, et Business exploite trois colonnes.

## Bugs et incohérences corrigés

- Les actions rapides ne sont plus des duplicatas de navigation et ouvrent une vraie action.
- La vente Dubaï globale ne peut plus échouer silencieusement faute de référence sélectionnée.
- Le bouton de copie mensuelle fournit un résultat explicite et réversible.
- Les suppressions Dubaï importantes ne sont plus immédiates.
- Les couleurs du donut et des catégories ne dépendent plus de la position dans la liste.

## Tests et validation

Des tests ciblés couvrent le slogan, la palette Budget, les actions rapides selon modules, la composition Budget dense, le formulaire montant-first et les breakpoints iPhone.

Commandes de validation finales :

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `git diff --check`

## Limite de l'environnement

Le navigateur intégré n'a pas pu initialiser son contrôle à cause d'un chemin runtime non approuvé par l'hôte. Aucun outil de navigateur alternatif n'a été utilisé. Le responsive a donc été contrôlé par inspection des composants, des contraintes de largeur et des breakpoints ; une passe visuelle manuelle sur iPhone 375/390/430 px reste recommandée avant publication.

Aucun déploiement production n'a été effectué.
