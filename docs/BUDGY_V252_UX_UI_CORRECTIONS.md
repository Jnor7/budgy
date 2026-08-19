# Budgy V2.5.2 — Corrections UX/UI guidées par les captures

Date : 19 août 2026

## Périmètre

Cette passe reprend les repères visuels fournis pour Budgy et Budget JR sans modifier le modèle métier, l'authentification, la migration historique, Supabase, les politiques RLS ni le stockage.

## Accueil

- L'identité devient compacte : avatar lié au profil, nom Budgy et salutation personnalisée.
- Le centre du donut mensuel est réduit pour laisser davantage respirer les données.
- Les actions rapides sont des boutons locaux et n'effectuent plus de navigation.
- Les sheets permettent d'ajouter une dépense, un revenu, un paiement de loyer, un voyage ou un abonnement, ainsi que de copier le budget mensuel.

## Navigation et modules

- La barre affiche Accueil, quatre modules actifs au maximum et Options.
- Plus est renommé Options, choix cohérent avec le rôle de hub regroupant compte, préférences, migration et modules secondaires.
- Les modules actifs placés après les quatre premiers restent accessibles dans Options.
- La page Mes modules prend en charge le glisser-déposer à la souris et au tactile ; le nouvel ordre est enregistré par la source de données existante et pilote immédiatement la barre.

## Budget

- Le titre supérieur et le bouton Ajouter global ont été retirés.
- Les catégories ont été remplacées par trois blocs opérationnels : Rentrées, Charges et Dépenses.
- Chaque bloc affiche son total, sa progression, ses lignes denses et son propre bouton Ajouter.
- Les montants restent noirs ; les états Reçu sont verts et les cercles de validation sont alignés à droite.
- Les menus trois-points ont été supprimés.
- Le swipe vers la gauche révèle Supprimer ; le swipe vers la droite révèle Modifier. La ligne revient proprement à sa position neutre après action ou annulation.

## Gestion locative

- Le titre redondant et le FAB ont été retirés.
- Ajouter un locataire est intégré au flux de la page.
- Les cartes conservent les montants métier essentiels : loyer, reports et dettes, total dû, reçu et reste.
- Chaque locataire dispose d'un accès direct à son historique de paiements mensuels.

## Fichiers modifiés

- `app/(app)/page.tsx`
- `app/(app)/budget/page.tsx`
- `app/(app)/rentals/page.tsx`
- `app/(app)/more/page.tsx`
- `app/(app)/settings/modules/page.tsx`
- `app/globals.css`
- `components/app-shell.tsx`
- `components/quick-actions.tsx`
- `components/ui/swipe-row.tsx`
- `lib/modules/registry.ts`
- `tests/modules.test.ts`
- `tests/v252-ux-ui.test.ts`

## Validation

- Validation dans le navigateur local à 375, 390 et 430 px : aucun débordement horizontal et aucun libellé de navigation tronqué.
- Action rapide Dépense vérifiée : ouverture de la sheet sans changement d'URL.
- Budget vérifié : aucun bloc Catégories ni menu trois-points, trois CTA Ajouter visibles.
- Gestion locative vérifiée : CTA locataire intégré et historique mensuel fonctionnel.
- Options vérifié : les modules actifs hors barre principale restent accessibles.
- `npm run lint` : succès.
- `npm run typecheck` : succès.
- `npm test` : 19 fichiers réussis, 86 tests réussis, 1 ignoré.
- `npm run build` : build de production réussi, 21 pages générées.

## Base de données

Aucune migration SQL et aucun changement de schéma ne sont nécessaires pour V2.5.2.
