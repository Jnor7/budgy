# Budgy V2.5.5 — Passe premium couleurs & sheets de saisie

Date : 19 août 2026

## Intention

Cette passe s'attaque aux deux points que tu as identifiés comme prioritaires :
la dominante violette des grosses cartes, et l'hétérogénéité des sheets de
saisie. Aucune migration SQL, aucun changement de logique métier — uniquement
du CSS, deux composants partagés (`Sheet`, `V2Donut`) et l'ajout d'icônes
illustratives sur les points d'entrée de formulaires.

## 1. Palette — sortir du « tout violet »

### Constat sur l'état précédent

En ré-auditant le CSS après la passe V2.5.4, j'ai trouvé que mon dégradé
« navy → plum → indigo » de l'époque n'était en réalité **pas assez bleu** :
`--v2-plum: #3d2c52` et `--v2-indigo-deep: #423a86` ont une teinte (hue) autour
de 250-255°, ce qui se perçoit comme du violet, pas du bleu. C'est exactement
ce que tu ressentais.

### Nouveaux tokens

```css
--v2-navy: #101a3a;      /* bleu nuit très sombre, hue ≈227° */
--v2-indigo: #24399b;    /* indigo bleuté, hue ≈231° */
--v2-blue: #3562e8;      /* bleu vif, hue ≈220° */
--v2-graphite: #262b3d;  /* gris-bleu neutre pour les points de départ sombres */
```

Ces trois teintes restent dans la famille bleue (200-235°) du début à la fin —
aucune ne franchit la limite du violet (~260°+).

### Cartes principales

| Carte | Avant | Après |
|---|---|---|
| Accueil (`.v2-hero`) | Violet plein (`navy→plum→indigo`, en réalité violet) | Bleu nuit → indigo → bleu vif |
| Budget (`.budget-balance-card`) | Graphite → bleu nuit (déjà correct, légère retouche) | Graphite → bleu nuit → indigo, cohérent avec l'Accueil sans être identique |
| Business hub (`.business-hero`) | Charcoal → prune (`#292331→#493660`, hue ≈280-284°) | Graphite → indigo, même direction sombre mais sans violet |
| Business Dubaï (`.dubai-finance`) | Même problème (`#54406c→#2f2938`) | Graphite → bleu nuit |
| Authentification (`.auth-hero`) | Violet vif (`#9270ef→#6541c7`) | Bleu vif → indigo, énergie d'accueil conservée |

Business et Business Dubaï gardent leur direction « carte sombre » validée
précédemment — seule la teinte a été corrigée, pas l'esprit.

### Chiffres blancs, labels teintés

Dans la carte Accueil et la carte Budget, les nombres (`<strong>`) sont
désormais **toujours blancs et pleinement opaques**, tandis que les libellés
(`<span>` : « Revenus », « Dépenses », « Potentiel »…) gardent une teinte
douce pour l'identification rapide. C'était inversé dans les deux cartes :
`.hero-income span,.hero-income strong { color:#8cf0ab; }` teintait le
*chiffre* en vert, pas seulement le libellé.

### Barre de progression

Le segment auparavant en violet clair (`#cda8ff`, dépenses variables dans la
barre de la carte Accueil) devient corail, cohérent avec la sémantique
« dépense » utilisée ailleurs dans l'app.

### Donut « Budget du mois »

C'est le changement le plus visible : la part **Fixes** n'est plus une couleur
violette plate. `V2Donut` (`components/ui/v2.tsx`) définit maintenant un vrai
dégradé SVG (`<linearGradient>`, indigo → bleu) appliqué spécifiquement à la
part dont le libellé correspond à « Fixes »/« Fixe » — exactement le même
dégradé que la carte principale. Les autres parts (Variables, Loyers,
Abonnements…) gardent leurs couleurs plates habituelles, sans dégradé — ce
traitement spécial souligne la part dominante sans uniformiser tout le donut
en bleu, ce qui aurait fait perdre l'information de répartition.

## 2. Sheets de saisie — refonte structurelle unique

### Le vrai problème trouvé

Le composant `Sheet` (`components/ui/modal.tsx`, utilisé par ~17 formulaires)
plaçait le bouton de validation (« Ajouter », « Enregistrer »…) comme un
simple bouton texte dans le header, à côté d'« Annuler » — pas de CTA
imposant en bas comme tu le décrivais.

### Ce qui a changé (un seul composant, propagé partout)

`Sheet` a été restructurée avec exactement la même API (aucune prop
supprimée, aucun call site cassé) :

- **Header simplifié** : « Annuler » discret à gauche, titre centré.
- **Icône illustrative optionnelle** (nouvelle prop `icon`/`tone`) : un badge
  rond de 56px, coloré selon le contexte, juste sous le header.
- **CTA principal fixé en bas** (nouveau `<footer className="sheet-footer">`,
  `position:sticky; bottom:0`) : gros bouton plein largeur (52px de haut),
  fond flouté, en retrait de sécurité (`env(safe-area-inset-bottom)`). Le
  contenu défile indépendamment ; le CTA reste toujours visible et joignable,
  même clavier ouvert.

Comme la prop `icon` est optionnelle, les sheets qui n'en reçoivent pas
(ex. sélecteurs, visionneuses de documents) continuent de fonctionner à
l'identique.

### Icônes ajoutées (18 sheets)

| Sheet | Icône | Ton |
|---|---|---|
| Nouvelle transaction | Coins (revenu) / WalletCards (dépense), dynamique | vert / orange |
| Paiement loyer | Banknote | cyan |
| Dette loyer | CircleAlert | orange |
| Vente / Charge / Mouvement Dubaï | PackageCheck / ReceiptText / Banknote, dynamique | vert / orange |
| Référence Dubaï | Tag | orange |
| Nouveau voyage | Plane | cyan |
| Vol / Logement / Activité / Check-list | Plane / BedDouble / MapPin / ClipboardCheck, dynamique | cyan / violet / vert / orange |
| Les 6 sheets rapides de l'Accueil | mêmes icônes que ci-dessus | idem |
| Nouvel abonnement | BellRing | rose |
| Nouveau locataire | Building2 | cyan |
| Créer un business | BriefcaseBusiness | orange |
| Contact / Article / Transaction / Réservation / Tâche (Business générique) | UserRound / Box / CalendarDays / ClipboardList / Euro, dynamique | violet / orange |
| Dépense de voyage partagée | Receipt | cyan |
| Inviter un participant | UserPlus | cyan |
| Photo de profil | Camera | violet |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/globals.css` | Tokens bleu/indigo/navy, dégradés Accueil/Budget/Business/Dubaï/Auth, chiffres blancs, segment corail, CSS `.sheet-footer`/`.sheet-icon-badge` |
| `components/ui/modal.tsx` | `Sheet` restructurée (footer sticky, icône optionnelle) |
| `components/ui/v2.tsx` | `toneStyle()` exporté, `V2Donut` avec dégradé SVG pour la part Fixes |
| `components/rent-payment-sheet.tsx` | Icône Banknote |
| `components/rent-debt-sheet.tsx` | Icône CircleAlert |
| `components/quick-actions.tsx` | Icônes sur les 6 sheets rapides |
| `components/trip-collaboration.tsx` | Icônes sur Dépense partagée et Inviter |
| `app/(app)/budget/page.tsx` | Icône dynamique Nouvelle transaction |
| `app/(app)/business/dubai/page.tsx` | Icônes sur Référence et Vente/Charge/Mouvement |
| `app/(app)/business/generic/page.tsx` | Icône Créer un business |
| `app/(app)/business/generic/[id]/page.tsx` | Icône dynamique par type d'élément |
| `app/(app)/trips/page.tsx` | Icône Nouveau voyage |
| `app/(app)/trips/[id]/page.tsx` | Icône dynamique par type (vol/logement/activité) |
| `app/(app)/rentals/page.tsx` | Icône Nouveau locataire |
| `app/(app)/subscriptions/page.tsx` | Icône Nouvel abonnement |
| `app/(app)/settings/account/page.tsx` | Icône Photo de profil |
| `tests/v255-premium-forms.test.tsx` | 9 nouveaux tests (nouveau fichier) |

## Tests

9 nouveaux tests, rendus avec le vrai DOM (`@testing-library/react`) :

- **`Sheet`** : le CTA de soumission vit bien dans `.sheet-footer` et jamais
  dans le header ; aucun footer ne s'affiche sans `onSubmit` (sheets
  d'affichage) ; « Annuler » reste dans le header, distinct du CTA ; l'icône
  illustrative s'affiche seulement quand elle est fournie ; le CTA se
  désactive correctement.
- **`V2Donut`** : la part « Fixes » reçoit un dégradé (`url(#...)`), les
  autres parts restent en couleur plate ; la détection fonctionne
  indépendamment de la casse/espaces ; aucune autre catégorie (Loyers…) ne
  reçoit le dégradé par erreur.

Aucun test existant supprimé ni modifié.

## Validation

```
npm run lint       ✅ 0 erreur, 0 avertissement
npm run typecheck  ✅ 0 erreur
npm test           ✅ 112/113 tests (1 ignoré, préexistant) — 22 fichiers, 0 régression
npm run build      ✅ build de production réussi, 22 routes générées
```

`git diff --check` n'a pas pu être exécuté (pas de `.git` dans l'archive
livrée) ; vérification manuelle des marqueurs de conflit effectuée à la place,
rien d'anormal.

## Ce qui a vraiment changé

- Le violet a disparu des cinq plus grandes surfaces de l'app (Accueil,
  Budget, Business, Dubaï, Authentification) — remplacé par une vraie famille
  bleu/indigo/nuit, mesurée en teinte (hue) pour être certain qu'aucun résidu
  violet ne subsiste.
- Les nombres dans les cartes principales sont désormais blancs et lisibles
  partout, avec une hiérarchie claire label-teinté / chiffre-blanc.
- La part « Fixes » du donut Budget utilise un vrai dégradé bleu, pas une
  couleur plate.
- **Les 18 sheets de saisie principales de l'app partagent maintenant
  exactement la même structure** : icône illustrative, CTA unique fixé en bas,
  Annuler discret en header. Ce n'est pas 18 corrections séparées — c'est un
  seul composant modifié qui les propage toutes.

## Ce qui reste perfectible

- Les chips/segments (`AnimatedSegmented`, fractions de paiement) n'ont pas
  été retouchés visuellement dans cette passe : ils fonctionnaient déjà bien
  et le temps a été investi en priorité sur les couleurs et la structure des
  sheets, conformément à ton ordre de priorité.
- Le module Loyers (priorité 5) n'a reçu qu'un ajustement de couleur (icône
  du formulaire locataire) — pas de refonte de la vue de collecte ou des
  cartes locataires, qui avaient déjà été retravaillées en V2.5.3 et
  restaient cohérentes.
- Certains petits icon-tiles gardent le violet en usage d'accent (ex. icône
  « Mes activités » dans le hub Business, icône Photo de profil) — c'est
  intentionnel : le violet reste la couleur de marque en petite touche, comme
  demandé, seules les grosses surfaces devaient en sortir.
- Pas de test de rendu visuel automatisé (capture d'écran) : la validation
  s'appuie sur les tests de structure DOM et sur les valeurs de teinte
  calculées manuellement, pas sur une inspection pixel par pixel.

## Limites

- Cette archive ne contient pas de dépôt Git ; `git diff --check` a été
  remplacé par une recherche manuelle de marqueurs de conflit.
- Comme lors des passes précédentes, aucun test visuel réel sur appareil n'a
  été effectué (environnement sans navigateur contrôlable) ; la validation
  repose sur les breakpoints CSS existants, les tests DOM et le build de
  production réussi.
