# Budgy V2.5.4 — Premium UI System & Form Experience

Date : 19 août 2026

## Intention

Cette passe ne touche à aucune logique métier. Elle unifie l'expérience de saisie
partout dans Budgy — formulaires, montants, dates, selects, boutons — et retire le
violet des grandes surfaces au profit d'une palette plus mature, propre à chaque
contexte (Budget, Loyers, Voyages, Abonnements, Business).

## Audit visuel (avant correction)

En partant des captures fournies (Nouvelle transaction, Enregistrer un paiement,
Ajouter un vol, Accueil, Vente Dubaï), l'audit du code a confirmé cinq incohérences
concrètes, présentes dans 9 fichiers :

1. **Montants** — `<input type="number" class="amount-field">` : flèches natives du
   navigateur visibles au-dessus du texte, séparateur « € » géré comme un artefact
   de `placeholder` plutôt que comme un vrai suffixe.
2. **Dates** — `<input type="date">` brut : rendu de l'icône calendrier variable
   selon le navigateur, aucune cohérence avec le reste des champs.
3. **Selects natifs** — chevron et apparence du système d'exploitation, jamais
   restylés.
4. **Bouton « Remettre le paiement à 0 »** — bloc rouge plein, pleine largeur,
   disproportionné pour une action secondaire et rare.
5. **Gros blocs violets** — carte Accueil et carte Budget en dégradé violet plein ;
   carte de collecte des Loyers et couverture par défaut des Voyages également
   teintées de violet alors qu'elles relèvent d'un autre contexte.

## Design tokens ajoutés

```css
--v2-navy / --v2-navy-deep / --v2-plum / --v2-indigo-deep / --v2-graphite
--ctx-income / --ctx-expense
--ctx-rent / --ctx-rent-soft / --ctx-rent-line
--ctx-travel / --ctx-travel-sky
--ctx-rose / --ctx-rose-soft
--field-h / --field-radius / --field-border / --field-bg / --field-focus
--btn-h
```

Les tons neutres (navy/plum/indigo/graphite) remplacent le violet plein sur les
grandes surfaces ; les tons contextuels (rent/travel/rose) donnent à chaque module
sa propre identité sans sortir de la famille visuelle Budgy. Le violet reste
l'accent de marque partout ailleurs : CTA principal, icônes, états actifs.

## Nouveaux composants

### `AmountField` (`components/ui/premium.tsx`)

Remplace tous les `<input type="number" class="amount-field">`. Comportement :

- Aucun spinner natif (input texte + `inputMode="decimal"`).
- Suffixe de devise (`€`, `AED`…) rendu comme élément séparé, jamais concaténé
  dans la valeur.
- Deux tailles : `hero` (champ principal d'une sheet, 27 px) et `compact`
  (champ secondaire dans une grille, 15,5 px).
- Synchronisation propre avec les mises à jour externes (boutons Tout/¾/½/¼ de la
  sheet Paiement) : la valeur externe est reflétée uniquement quand le champ n'a
  pas le focus, pour ne jamais écraser une saisie en cours.
- Accepte la virgule décimale française sans la perdre pendant la frappe.

### `DateField` (`components/ui/premium.tsx`)

Remplace tous les `<input type="date">` bruts. Conserve le sélecteur natif de
l'OS (meilleure UX mobile) mais masque son indicateur visuel par défaut, affiche
une icône calendrier cohérente avec les autres champs, et garde tout le champ
cliquable via l'astuce `::-webkit-calendar-picker-indicator` en superposition
transparente.

### Select natif restylé (CSS pur)

`.select` reçoit désormais un chevron cohérent en `background-image` et
`appearance:none`. Aucun changement de composant nécessaire : chaque
`<select className="select">` de l'application en bénéficie automatiquement.

### Bouton de réinitialisation discret

`.button-reset-inline` remplace `.button-danger` pleine largeur pour l'action
« Remettre le paiement à 0 » : lien discret, centré, rouge doux au lieu d'un bloc
plein.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/globals.css` | Bloc de tokens V2.5.4, styles `AmountField`/`DateField`, chevron `.select`, suppression globale des spinners `number`, gradients Accueil/Budget/Loyers/Voyages, ton `.icon-rose` |
| `components/ui/premium.tsx` | `AmountField`, `DateField` (nouveaux exports) |
| `components/ui/v2.tsx` | Ton `rose` ajouté à `TONE_BACKGROUNDS`/`TONE_COLORS` |
| `lib/modules/registry.ts` | Type `tone` étendu avec `"rose"` ; module Abonnements reteinté en rose (au lieu d'orange) |
| `app/(app)/budget/page.tsx` | Montant → `AmountField`, Date → `DateField` |
| `app/(app)/trips/page.tsx` | Formulaire Nouveau voyage restructuré en `FormSection` (Destination / Dates / Voyageurs et budget), dates et budget migrés |
| `app/(app)/rentals/page.tsx` | Loyer mensuel → `AmountField`, placé en premier champ |
| `app/(app)/business/dubai/page.tsx` | Prix unitaire/Montant → `AmountField` (hero), Achat/Vente cible AED → `AmountField` (compact) |
| `app/(app)/business/generic/[id]/page.tsx` | Montant → `AmountField`, dates → `DateField`, segmented brut → `AnimatedSegmented` |
| `app/(app)/subscriptions/page.tsx` | Montant mensuel → `AmountField`, icône reteintée en rose |
| `components/rent-payment-sheet.tsx` | Montant → `AmountField`, bouton reset → discret |
| `components/rent-debt-sheet.tsx` | Montant placé en premier (`AmountField`), reste du formulaire regroupé dans une `FormSection` |
| `components/quick-actions.tsx` | Les 6 sheets rapides de l'Accueil (Dépense/Revenu, Loyer, Vente Dubaï, Cash Dubaï, Voyage, Abonnement) migrées vers `AmountField`/`DateField` |
| `components/trip-collaboration.tsx` | Montant de dépense partagée → `AmountField` |

## Palette par contexte

| Module | Avant | Après |
|---|---|---|
| Accueil (carte solde) | Violet plein (`#9b6cf8→#7c4ef0→#6b3fe6`) | Bleu nuit → prune → indigo |
| Budget (carte solde) | Violet (`#7751dd→#5936b7`) | Graphite → bleu nuit (accents vert/orange conservés) |
| Loyers (carte de collecte) | Violet (`#f1edff→#faf9ff`, barre violette) | Blanc / bleu-gris / sauge |
| Voyages (couverture par défaut) | Violet → cyan | Ciel → turquoise |
| Abonnements (icônes) | Orange (confondu avec Business Dubaï) | Rose doux / lilas |
| Business / Dubaï | Charcoal / brun / orange (déjà correct) | Inchangé — cette direction fonctionnait déjà |

Le violet reste utilisé pour : le CTA principal (`button-primary`), les états
actifs (segmented control, onglets de navigation), et les icônes de Budget — ce
qui correspond exactement à la demande « accent, jamais bloc plein ».

## Densité

`--field-h` passe de 48 px à 46 px, `--btn-h` uniformisé à 46 px sur tous les
boutons (auparavant variable selon le texte/les icônes). Les hauteurs restent
au-dessus du minimum de 44 px recommandé pour les cibles tactiles.

## Tests

10 nouveaux tests dans `tests/premium-fields.test.tsx`, rendus avec le vrai DOM
(`@testing-library/react`, déjà présent dans le projet) :

- `AmountField` : valeur initiale formatée avec virgule, champ vide pour zéro,
  conversion virgule→nombre pour le formulaire, filtrage des caractères invalides,
  reflet d'une mise à jour externe (bouton de fraction) quand non focus,
  **non-écrasement d'une saisie en cours** quand la valeur externe change pendant
  la frappe, suffixe de devise personnalisé, classe `compact`.
- `DateField` : rendu de l'input natif avec la bonne valeur, transmission du
  changement.

Aucun test existant n'a été supprimé ou modifié.

## Validation

```
npm run lint       ✅ 0 erreur, 0 avertissement
npm run typecheck  ✅ 0 erreur
npm test           ✅ 103/104 tests (1 ignoré, préexistant) — 21 fichiers de test
npm run build      ✅ build de production réussi, 22 routes générées
```

`git diff --check` n'a pas pu être exécuté : cette archive ne contient pas de
dépôt Git (`.git` absent), comme lors des sessions précédentes. Une vérification
manuelle des marqueurs de conflit et de la syntaxe n'a rien trouvé d'anormal.

## Limites restantes

- **Restructuration en `FormSection` partielle** : les formulaires courts
  (Loyer, Dette, Abonnement) n'ont pas systématiquement été redécoupés en
  plusieurs sections quand un seul groupe suffisait déjà — le découpage n'a été
  appliqué que là où il clarifie réellement la hiérarchie (Nouveau voyage,
  Nouvelle transaction, Dubaï, Business générique), conformément à la consigne
  de ne pas sur-structurer un formulaire déjà court.
- **`ConfirmDialog`, `SuccessState`, `Toast`** n'ont pas été retouchés dans cette
  passe : ils avaient déjà été unifiés lors de V2.5 et respectaient déjà les
  proportions et l'esthétique demandées ici.
- **Business/Dubaï** n'a volontairement pas été retouché sur le plan des couleurs :
  le brief indique explicitement que cette direction (charcoal/brun/orange)
  fonctionne déjà bien.
- **Champs `Quantité`, `Jour de prélèvement`, `Voyageurs`** restent des
  `<input type="number">` classiques (pas de suffixe monétaire nécessaire), mais
  bénéficient de la suppression globale des flèches natives — cohérence visuelle
  sans changer leur sémantique.

## Critère de réussite

Un montant, une date ou un select se comportent et se présentent désormais à
l'identique dans Nouvelle transaction, Paiement, Dette, Voyage, Dubaï, Business et
Abonnements. Les cinq incohérences relevées dans l'audit initial sont corrigées à
la racine (composants partagés), pas écran par écran.
