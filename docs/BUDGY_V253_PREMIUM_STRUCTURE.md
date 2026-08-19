# Budgy V2.5.3 — Premium Structure

Date : 19 août 2026

## Intention

Cette passe stabilise Accueil et Budget, transforme Business en hub de gestion et fait évoluer Loyers vers une fonctionnalité annuelle complète. Les calculs métier, l'authentification, Supabase, RLS, Storage, la migration historique et les données Dubaï ne sont pas modifiés.

## Accueil

- L'avatar ouvre désormais directement le profil et possède un feedback de pression.
- La cloche est plus compacte et conserve son badge rouge alimenté par les notifications existantes.
- La carte principale différencie visuellement revenus, dépenses et potentiel.
- Une barre financière segmentée réutilise uniquement les montants déjà calculés.
- Le centre du donut est encore allégé et conserve exactement la palette de la page Budget.

## Actions rapides

- Dépense et Revenu ouvrent leur sheet préconfigurée sans quitter l'Accueil.
- Copier le mois et Paiement loyer restent des actions locales.
- Vente Dubaï et Mouvement cash sont maintenant exécutables depuis l'Accueil.
- La liste est limitée à six actions et reste horizontalement défilable.
- Aucune action rapide n'est un simple lien de navigation.

## Budget

- La carte solde reçoit une barre segmentée et des couleurs financières plus explicites.
- Les progressions Rentrées, Charges et Dépenses utilisent désormais les montants réalisés sur les montants attendus, sans nouveau calcul métier.
- Les montants des lignes restent noirs.
- Les statuts deviennent Reçu, Payé ou Réalisé selon le bloc.
- Les pictogrammes varient selon la nature de la transaction : revenu, logement, abonnement, transport et alimentation.
- Les CTA sont explicites : Ajouter une rentrée, Ajouter une charge et Ajouter une dépense.
- Le swipe et son annulation par toast sont conservés.

## Business

- Business devient explicitement le hub de gestion.
- Le header redondant a été supprimé ; la page commence par Résultat net puis les KPI utiles.
- Les KPI nuls secondaires sont masqués.
- Les trois espaces principaux restent Gestion des loyers, Business Dubaï et Mes activités.
- L'ajout d'activité est intégré au header de la section Espaces de gestion.
- Gestion des loyers pointe directement vers `/rentals` ; la route historique `/business/tenants` reste compatible.
- Business Dubaï conserve ses données et sa structure, avec un retour Business plus compact.

## Gestion des loyers

- Le haut de page propose un retour Business et le sélecteur de mois.
- Les anciens blocs statistiques sont fusionnés dans une carte Collecte du mois.
- Cette carte affiche attendus, encaissés, progression, locataires, payés et restant.
- Les cartes locataires sont plus compactes et distinguent Payé, Partiel, En attente et Retard.
- Loyer, report et dettes, total dû, reçu et reste restent visibles.
- Paiement et Dette restent accessibles sans détour.
- Cliquer sur une carte ouvre désormais le détail locataire.

## Détail locataire et historique

- Nouvelle route : `/rentals/[id]`.
- Le résumé annuel affiche le loyer de base, les mois soldés sur douze, le reçu annuel et le restant dû cumulé au dernier mois comptabilisé.
- Le sélecteur d'année permet de consulter les années existantes, passées ou futures.
- Une alerte orange apparaît lorsqu'un retard existe.
- La section Paiements affiche toujours les douze mois avec les états Soldé, Partiel, Retard, À enregistrer ou Avant location.
- Chaque mois expose le montant, le report/dette, le reste et une progression lorsque cela apporte une information.
- Le mois courant reçoit le badge CE MOIS.
- Les mois non soldés et comptabilisés ouvrent directement la sheet de paiement du bon mois.
- Ajouter dette permet de choisir explicitement le mois de rattachement.

## Paiement

- La sheet commune est utilisée depuis la liste et le détail locataire.
- Tout, 3/4, 1/2 et 1/4 remplissent automatiquement le montant et indiquent la fraction active.
- L'enregistrement met à jour la carte, l'historique et la collecte via la source de données existante, sans rechargement brutal.
- Le toast Paiement enregistré confirme la mutation.
- La remise à zéro existante est conservée.

## Modules et navigation

- La barre reste limitée à Accueil, quatre modules et Options.
- Les libellés mobiles sont explicites et courts : Budget, Abos, Voyages, Loyers et Business.
- Gestion locative reste un module compatible afin de respecter les préférences existantes, mais son libellé devient Loyers et Business est son point d'entrée architectural privilégié.
- Les modules actifs après la quatrième position apparaissent dans la section Mes modules d'Options.
- Le glisser-déposer conserve souris, tactile, Pointer Events, persistance et boutons clavier.
- La carte déplacée monte à `scale(1.02)`, reçoit une ombre et la cible est mise en évidence.

## Tests et validation

- Tests ciblés ajoutés pour les actions locales, la limite de six actions, les labels de navigation, les douze mois, le résumé annuel, la réactivité au paiement et la persistance du réordonnancement.
- Accueil, Budget, Business, Loyers et Détail locataire validés à 375, 390 et 430 px.
- Aucun débordement horizontal et aucun label de navigation tronqué.
- Dépense, Revenu et Vente Dubaï vérifiés sans changement d'URL.
- Les quatre fractions de paiement et leur feedback actif ont été vérifiés.
- `npm run lint` : succès.
- `npm run typecheck` : succès.
- `npm test` : 20 fichiers réussis, 93 tests réussis, 1 ignoré.
- `npm run build` : build de production réussi, route dynamique `/rentals/[id]` incluse.
- `git diff --check` : succès.

## Bugs corrigés

- Les cartes locataires n'ouvraient pas de détail annuel.
- L'historique V2.5.2 ne montrait que les paiements existants, sans les douze mois ni les reports.
- Les fractions de paiement ne donnaient aucun feedback de sélection.
- Business pouvait afficher plusieurs KPI nuls sans valeur décisionnelle.
- Le libellé Gestion dans la navigation ne reflétait pas clairement la hiérarchie Business → Loyers.
- Les libellés longs dépendaient de l'ellipse CSS.

## Compatibilité et limites

- Aucune migration SQL n'est nécessaire.
- Le module interne `rentals` est conservé pour ne casser ni préférences, ni routes, ni historique. La transition vers Business est uniquement UX et architecturale pour cette version.
- Le restant annuel n'additionne pas les douze montants dus, car `totalDueForMonth` inclut déjà les reports. Il reprend le restant du dernier mois comptabilisé afin d'éviter tout double comptage.
- Les nouvelles notifications, la collaboration avancée et les exports restent hors périmètre.

## Fichiers principaux

- `app/(app)/page.tsx`
- `app/(app)/budget/page.tsx`
- `app/(app)/business/page.tsx`
- `app/(app)/business/dubai/page.tsx`
- `app/(app)/rentals/page.tsx`
- `app/(app)/rentals/[id]/page.tsx`
- `app/(app)/more/page.tsx`
- `app/(app)/settings/modules/page.tsx`
- `components/quick-actions.tsx`
- `components/rent-payment-sheet.tsx`
- `components/rent-debt-sheet.tsx`
- `components/app-shell.tsx`
- `lib/domain/rent-history.ts`
- `lib/modules/registry.ts`
- `app/globals.css`
- `tests/v253-premium-structure.test.ts`
