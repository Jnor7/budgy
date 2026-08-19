# Budgy V2.5 — rapport de polish premium

Date : 19 août 2026

## Résultat

La passe V2.5 uniformise Budgy autour d'un langage visuel plus calme, plus tactile et plus personnel, tout en conservant les calculs et règles métier existants. Les changements portent sur la présentation, la navigation, l'onboarding, les retours d'action et la sécurité des interactions destructives.

## Audit comparatif Budgy / Watchbook

Les éléments transférables observés dans Watchbook sont :

- des surfaces claires, pastel et légèrement teintées plutôt qu'un blanc clinique ;
- une réaction immédiate au toucher, des transitions courtes et des entrées de page discrètes ;
- une navigation mobile compacte, complétée sur écran large par une structure respirante ;
- des modales portalisées, compatibles avec les safe areas et le verrouillage du scroll ;
- un profil traité comme un espace personnel, avec avatar et état de synchronisation visibles ;
- des empty states illustrés et orientés vers une action utile.

Budgy conserve sa propre identité : typographie système, violet principal, états financiers verts/rouges et couleurs dédiées aux modules. Aucun style Watchbook n'a été copié littéralement.

## Système visuel V2.5

- Police : pile `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`.
- Couleurs : violet Budgy, lavande, menthe, pêche et bleu clair, avec contrastes sémantiques préservés.
- Surfaces : cartes rondes, bordures fines, ombres diffuses et arrière-plan légèrement teinté.
- Mouvement : transitions de 150 à 360 ms, courbe d'accélération centralisée, réduction automatique avec `prefers-reduced-motion`.
- États tactiles : réduction d'échelle légère au press, capsule animée dans la navigation, segmented control à indicateur coulissant.
- Formulaires : sections groupées, champs renforcés, composant de montant prévu pour une hiérarchie forte.

## Composants créés ou renforcés

- `ToastProvider` et `useToast` : confirmation discrète, erreur et action Annuler.
- `ConfirmDialog` : protection des suppressions à fort impact.
- `SuccessState` : fin de parcours explicite, utilisé notamment après migration.
- `AppPageHeader` : titre, sous-titre, retour et action cohérents.
- `AnimatedSegmented` : sélection animée accessible.
- `FormSection` : regroupement des champs liés.
- `SyncBadge` : local, synchronisé, en cours ou en erreur.
- `PremiumEmpty` : état vide illustré et actionnable.
- `SwipeRow` : révélation tactile de l'action Supprimer.
- `Sheet` : portail document, verrouillage du scroll, Escape, safe area et glissement vers le bas.

## Parcours corrigés

### Authentification et onboarding

- L'écran d'authentification possède une vraie composition premium, une identité Budgy claire et des aperçus de modules.
- Après inscription, une session créée immédiatement mène directement à `/onboarding`.
- Quand Supabase exige une confirmation, un état de succès explique clairement de vérifier l'e-mail.
- Les changements de mode et d'étape utilisent une transition courte.

### Navigation et modules

- L'ordre des modules est désormais personnel et persistant.
- Les trois premiers modules actifs alimentent la barre principale entre Accueil et Plus.
- Les modules supplémentaires restent accessibles depuis Plus.
- Réglages → Mes modules propose poignée de déplacement, drag and drop, commandes clavier/tactiles haut-bas, activation et désactivation sans suppression de données.
- La migration `202608190005_v25_module_order.sql` ajoute `sort_order`, réalise un backfill déterministe et crée l'index de lecture associé.

### Accueil et Plus

- Les raccourcis rapides qui ne déclenchaient pas directement l'action annoncée ont été retirés.
- La page Plus ne montre plus les doublons de routes ni un export non implémenté.
- L'état réel de synchronisation est visible et l'actualisation produit un retour global.

### Budget

- Les lignes peuvent révéler Supprimer par glissement horizontal.
- Une suppression est différée pendant l'affichage du toast ; Annuler restaure la ligne sans mutation distante.
- Les retours d'import et de copie restent non bloquants.

### Voyages, locations et profil

- Le champ technique « Image de destination (URL) » a été retiré du formulaire Voyage, sans supprimer la compatibilité avec les données existantes.
- La suppression d'un voyage demande confirmation et explicite les données liées.
- La suppression d'un locataire demande confirmation.
- L'avatar s'édite dans une sheet dédiée, avec ajout, remplacement et suppression confirmée.
- Le profil et Plus affichent le statut local/Supabase.

### Migration historique

- La logique d'import idempotent reste inchangée.
- La fin d'import utilise désormais un état de succès dans une sheet claire, avec une action de continuation.

## Responsive et accessibilité

- Safe areas conservées pour les barres et sheets mobiles.
- Layout d'authentification en deux panneaux sur desktop, compact sur mobile.
- Navigation limitée à cinq destinations visibles pour éviter les libellés tassés.
- Interactions principales décrites par des labels accessibles ; segmented controls exposés comme tabs.
- `prefers-reduced-motion` neutralise les animations décoratives.

## Validation

- `npm run typecheck` : réussi.
- `npm run lint` : réussi, sans erreur ni avertissement.
- `npm test` : 18 fichiers réussis, 81 tests réussis, 1 test ignoré préexistant.
- `npm run build` : build Next.js de production réussi, 21 routes générées.
- `git diff --check` : réussi.

Les tests ajoutés couvrent l'ordre des modules, la limite de navigation dynamique, les deux issues post-inscription, l'absence du champ URL Voyage et la présence des états de feedback partagés.

## Notes d'exploitation

- Le CLI Supabase n'était pas installé dans l'environnement local. La migration a donc été créée directement, selon la convention de versionnement déjà présente, et doit être appliquée par le pipeline Supabase habituel avant mise en production.
- Le navigateur intégré n'a pas pu établir sa connexion de contrôle à cause d'un chemin runtime non approuvé par l'hôte. La validation responsive repose donc sur les breakpoints CSS, les contrôles statiques, les tests et le build ; une passe visuelle manuelle sur appareils réels reste recommandée avant publication.
- Aucun déploiement production n'a été effectué.
