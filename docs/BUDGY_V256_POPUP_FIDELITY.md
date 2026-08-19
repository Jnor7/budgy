# Budgy V2.5.6 — Popup Fidelity

## Objectif

Cette passe corrige uniquement la présentation et l'ergonomie des formulaires superposés. Les pages, tableaux de bord, routes, modèles de données et règles métier restent inchangés.

Les formulaires utilisent maintenant une fenêtre flottante centrée, compacte et indépendante de la hauteur de page. La page reste visible derrière un voile translucide et flouté. Le contenu long défile dans la fenêtre, tandis que le titre et le CTA restent fixes.

## Audit Sheet / Dialog

### Migré vers `FormModal`

- transaction Budget (création et modification) ;
- actions rapides revenu / dépense ;
- paiement de loyer et ajout de dette ;
- vente, charge, mouvement cash et référence Dubaï ;
- voyage (création et modification) ;
- vol, logement, activité et check-list d'un voyage ;
- locataire ;
- abonnement ;
- business générique et ses formulaires métier ;
- invitation et dépense partagée d'un voyage.

### Conservé en `Sheet`

- notifications ;
- confirmation de copie du budget ;
- choix rapide d'un locataire avant un paiement ;
- sélecteur d'aéroport ;
- documents et aperçus de pièces jointes ;
- rapport d'import / migration ;
- actions de photo de profil.

Ces interactions sont des sélecteurs, aperçus ou menus courts : elles restent adaptées à une feuille basse. Les dialogues de confirmation destructive conservent `ConfirmDialog`.

## Composant partagé

`components/ui/modal.tsx` expose désormais :

- `FormModal` : overlay, fenêtre centrée, header avec bouton X, zone interne scrollable, icône contextuelle et footer CTA ;
- `FormRow` : grille compacte à deux colonnes pour les champs liés ;
- `Sheet` : conservé pour les interactions courtes non formulaires.

Comportements communs de `FormModal` :

- largeur mobile `calc(100vw - 32px)`, plafonnée à 420 px ;
- largeur tablette / desktop plafonnée à 520 px ;
- hauteur maximale `86dvh` ;
- rayon de 28 px, bordure, ombre et fond blanc chaud ;
- fermeture par X, Échap ou clic sur le fond ;
- animation d'ouverture et animation inverse à la fermeture ;
- verrouillage du scroll de page et restauration du focus ;
- scroll interne, header et CTA toujours visibles ;
- respect de `prefers-reduced-motion` et de la safe area basse.

## Composition des parcours prioritaires

- Transaction : type en tête, montant mis en avant, catégorie, raccourcis de catégories, intitulé, date, compte, groupe et note.
- Paiement : contexte locataire / mois, total dû, montant, fractions rapides, note et remise à zéro existante.
- Dubaï : vocabulaire commun pour vente, charge et mouvement cash, avec montant, référence, quantité, client, devise ou type selon le contexte.
- Voyage : destination, dates, participants et budget regroupés en lignes logiques.

Les libellés de CTA indiquent l'effet réel : « Enregistrer la transaction », « Enregistrer le paiement », « Enregistrer la vente » ou « Créer le voyage ».

## Compatibilité et non-régression

- Aucune table, migration, route, politique RLS ou structure de données n'a été modifiée.
- Les fonctions de création / modification existantes restent les seules sources de mutation.
- `AmountField`, `DateField`, les toasts, les validations et les dialogues de confirmation existants sont réutilisés.
- Les tests V2.5.6 couvrent la structure flottante, le verrouillage du body, le CTA désactivé, la soumission et les trois modes de fermeture.

## Vérifications

- TypeScript : `npm run typecheck`
- ESLint : `npm run lint`
- Tests : `npm test`
- Build Next.js : `npm run build`
- Whitespace : `git diff --check`
- Contrôle visuel local aux largeurs 375, 390, 430, 768 et 1024 px.
