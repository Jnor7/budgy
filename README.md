# Budgy

Budgy est le portage PWA de l'application iOS Budget JR. Le projet utilise Next.js App Router, React, TypeScript strict, Tailwind CSS et une architecture Supabase prête à connecter.

## Prérequis

- Node.js 20 ou plus récent
- npm, pnpm ou équivalent
- Un projet Supabase pour activer les comptes et la synchronisation distante

## Installation

```bash
cd budgy
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000). En mode `auto`, Budgy utilise Supabase si les deux variables sont présentes, sinon des données locales isolées dans `localStorage`.

## Variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_BUDGY_DATA_MODE=auto
```

`NEXT_PUBLIC_BUDGY_DATA_MODE` accepte `auto`, `local` ou `supabase`. Le mode `supabase` sans variables valides affiche une erreur de configuration au lieu de transmettre des données ailleurs.

Ne jamais ajouter de clé `service_role` au frontend.

## Supabase

Les migrations sont dans `supabase/migrations/` et doivent être appliquées dans l'ordre. Elles créent les 21 tables métier, les profils, les préférences, les lots de migration, les index, les politiques RLS, le bucket Storage privé `budgy-attachments` et la RPC transactionnelle d'import ZIP.

Avec Supabase CLI configuré :

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Exécuter ensuite le script de contrôle `supabase/tests/rls_smoke.sql` avec deux utilisateurs de test. Ne pas appliquer les migrations sur une base contenant des données sans sauvegarde préalable.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Import Budget JR

La route `/settings/migration` accepte `budget-jr-export.zip` au format v1. Le ZIP contient `manifest.json`, les fichiers `data/*.json` et éventuellement `attachments/`. L'import valide le manifeste, calcule un checksum SHA-256, reconstruit les identifiants, transfère les fichiers et ignore les `legacy_id` déjà présents. En mode Supabase, les lignes sont insérées par une RPC PostgreSQL transactionnelle.

## Déploiement futur

1. Créer et configurer Supabase.
2. Appliquer les migrations puis vérifier RLS.
3. Déclarer les trois variables publiques dans Vercel.
4. Importer le dépôt Git dans Vercel.
5. Construire avec `npm run build`.
6. Vérifier Auth redirect URLs, PWA, Storage privé et politiques RLS.

Aucun projet distant Supabase, Vercel ou GitHub n'est créé automatiquement.


## Documentation interne

- `docs/IMPLEMENTATION_REPORT.md` : état de l’implémentation Budgy.
- `docs/MIGRATION_PARITY.md` : suivi de parité avec l’app Swift historique.
- `docs/reference/` : audits et documents d’architecture historiques utiles à la migration.
