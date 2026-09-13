# Budgy

Budgy est le portage PWA de l'application iOS Budget JR. Le projet utilise Next.js App Router, React, TypeScript strict, Tailwind CSS et Neon (Auth, Data API et Storage S3-compatible).

## Prérequis

- Node.js 20 ou plus récent
- npm, pnpm ou équivalent
- Un projet Neon pour activer les comptes et la synchronisation distante

## Installation

```bash
cd budgy
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000). Le mode `local` conserve des données isolées dans `localStorage`; les modes `auto` et `neon` utilisent Neon.

## Variables

```dotenv
DATABASE_URL=
DATABASE_URL_UNPOOLED=
NEON_AUTH_BASE_URL=
NEON_AUTH_JWKS_URL=
NEON_DATA_API_URL=
NEON_AUTH_COOKIE_SECRET=
AWS_ENDPOINT_URL_S3=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
NEXT_PUBLIC_BUDGY_DATA_MODE=neon
```

`NEXT_PUBLIC_BUDGY_DATA_MODE` accepte `auto`, `local` ou `neon`.

Les identifiants de base et Storage sont exclusivement utilisés dans les routes serveur.

## Neon

Le runtime accède aux 33 tables via Neon Data API sous RLS. Les migrations historiques restent conservées dans `supabase/migrations/` comme référence et rollback, mais ne sont plus exécutées par l'application.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Import Budget JR

La route `/settings/migration` accepte `budget-jr-export.zip` au format v1. Le ZIP contient `manifest.json`, les fichiers `data/*.json` et éventuellement `attachments/`. L'import valide le manifeste, calcule un checksum SHA-256, reconstruit les identifiants, transfère les fichiers et ignore les `legacy_id` déjà présents. En mode Neon, les lignes sont insérées par une RPC PostgreSQL transactionnelle.

## Déploiement futur

1. Configurer Neon Auth, Data API et Storage.
2. Vérifier les fonctions et les politiques RLS.
3. Déclarer les variables serveur dans Vercel.
4. Importer le dépôt Git dans Vercel.
5. Construire avec `npm run build`.
6. Vérifier Auth redirect URLs, PWA, Storage privé et politiques RLS.

Aucun projet distant Neon, Vercel ou GitHub n'est créé automatiquement.


## Documentation interne

- `docs/IMPLEMENTATION_REPORT.md` : état de l’implémentation Budgy.
- `docs/MIGRATION_PARITY.md` : suivi de parité avec l’app Swift historique.
- `docs/reference/` : audits et documents d’architecture historiques utiles à la migration.
