# Activer les comptes bancaires

La migration additive [202611130001_open_banking.sql](migrations/202611130001_open_banking.sql) cible Neon. Elle utilise l'UUID canonique de `public.current_budgy_user_id()` pour les lectures Data API et un rôle PostgreSQL dédié pour les écritures serveur. Le rôle de connexion utilisé par `DATABASE_URL` doit pouvoir assumer `budgy_banking_server`. Exécuter la migration dans Neon avec ce même rôle, doté de `CREATEROLE` et des droits de création sur le schéma `public`. Ce rôle doit déjà pouvoir lire et insérer les entrées Budget pour les rapprochements explicites. Appliquer la migration avant d'activer les variables GoCardless.

Dans le portail [Bank Account Data, User Secrets](https://bankaccountdata.gocardless.com/user-secrets/), créer un secret API et copier les deux valeurs dans `.env.local` à la racine du dépôt, ou dans **Vercel → budgy → Settings → Environment Variables → Production**. Les clés sont des secrets serveur. L'URL est une variable de configuration. Redéployer après leur ajout.

| Variable | Développement local | Production |
| --- | --- | --- |
| `GOCARDLESS_BANK_SECRET_ID` | `secret_id` du portail | `secret_id` du portail |
| `GOCARDLESS_BANK_SECRET_KEY` | `secret_key` du portail | `secret_key` du portail |
| `GOCARDLESS_BANK_REDIRECT_URL` | `http://localhost:3000/api/banking/callback` | `https://budgy-iota-green.vercel.app/api/banking/callback` |

Ouvrir Budgy sur le même hôte que l'URL de retour pour retrouver la session après le consentement. Une fois les clés configurées, vérifier la présence de LCL et Revolut dans **Options → Comptes bancaires → Connecter une banque**. Le catalogue provient de l'API GoCardless pour la France.

Les transactions importées sont séparées du Budget manuel. Le rapprochement Budget s'applique aux transactions EUR comptabilisées, car une entrée Budget actuelle ne porte pas de devise. Les soldes bancaires et les transactions conservent leur devise d'origine. Les transactions restent consultables après déconnexion. Lors d'un renouvellement, un compte conserve son historique si le provider renvoie un identifiant de compte stable ou une identité bancaire non ambiguë.

## Test d'intégration local

Utiliser une instance PostgreSQL jetable avec une base vide. Définir `BUDGY_BANKING_TEST_DATABASE_URL` uniquement pour exécuter `npm test`. La suite crée les rôles de test, une résolution d'identité canonique simulée et le schéma bancaire. Le provider est simulé.
