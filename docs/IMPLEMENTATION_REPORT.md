# Rapport d'implémentation Budgy

## Résultat

Budgy est une PWA Next.js complète et exécutable, séparée du projet Swift Budget JR. Le projet Swift, son Bundle Identifier et ses données n'ont pas été modifiés.

## Architecture opérationnelle

- Next.js App Router, React, TypeScript strict et Tailwind CSS.
- Shell mobile-first avec tab bar Accueil / Business / Budget / Voyages inchangée.
- Mode data configurable par `.env` : `auto`, `local` ou `supabase`.
- Provider central avec opérations optimistes, rollback en cas d'erreur et rechargement distant.
- Repositories Supabase pour les 21 tables métier avec mapping camelCase / snake_case.
- Auth Supabase, rafraîchissement de session, callback PKCE et protection conditionnelle des routes via `proxy.ts`.
- RLS par utilisateur et Storage privé `budgy-attachments`.
- PWA installable avec manifest, métadonnées Apple et service worker.

## Modules disponibles

1. Accueil et insights.
2. Budget mensuel : CRUD, statuts, réalisé/potentiel, copie mensuelle et import CSV simple.
3. Abonnements : CRUD, activation/pause, total mensuel et prochain prélèvement.
4. Loyers : locataires, paiements, remise à zéro, dettes et reports.
5. Business configurables : 11 modules, contacts, stock, transactions, réservations, tâches et documents.
6. Business Dubaï : références, ventes, charges, mouvements, devises, calculs et documents par pièce.
7. Voyages : vols, 207 aéroports issus de la base Swift, logements, activités, check-list et Budget automatique.
8. Onboarding en trois étapes, rejouable depuis Compte & données.
9. Pièces jointes : upload, aperçu image/PDF, téléchargement et suppression.
10. Migration ZIP : manifeste v1, checksum SHA-256, limites de sécurité, reconstruction des relations, pièces jointes, anti-doublon et RPC transactionnelle.

## Validation effectuée

- ESLint : succès, zéro erreur et zéro avertissement.
- TypeScript strict : succès.
- Vitest : 7 fichiers, 17 tests, succès.
- Build Next production avec webpack : succès, 18 routes et proxy générés.
- QA navigateur local : onboarding, ouverture directe des détails, CRUD Abonnements, documents, AirportPicker et console sans erreur.
- Catalogue Airport : 207 codes IATA uniques, générés depuis `AirportDatabase.swift`.

## Restant bloqué par un vrai Supabase / Vercel

1. Créer le projet Supabase distant et appliquer les six migrations SQL.
2. Tester les politiques RLS avec deux vrais comptes et contrôler le bucket privé.
3. Renseigner les variables `.env` Supabase et configurer les URL de redirection Auth.
4. Exécuter un import ZIP de test sur la base distante pour valider la RPC transactionnelle et Storage ensemble.
5. Déployer sur Vercel, renseigner les mêmes variables et vérifier l'installation PWA sur iPhone/Safari.

Aucune clé `service_role` n'est requise ni acceptée dans le frontend.
