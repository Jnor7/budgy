# Activer les comptes bancaires avec Bridge

La migration [202611130001_open_banking.sql](migrations/202611130001_open_banking.sql) doit déjà être présente dans Neon. Le passage à Bridge réutilise les tables et politiques existantes. Pour Bridge, `bank_connections.requisition_id` contient l'identifiant de l'item bancaire. L'historique du précédent fournisseur reste consultable. Les écritures utilisent le rôle `budgy_banking_server` associé à `DATABASE_URL`.

Dans le dashboard Bridge, utiliser une application **Agrégation bancaire** et autoriser le domaine de retour dans les paramètres de l'application. Renseigner les variables dans `.env.local` ou dans **Vercel → budgy → Settings → Environment Variables → Production**, puis redéployer.

| Variable | Développement local | Production |
| --- | --- | --- |
| `BRIDGE_CLIENT_ID` | Client ID de l'application Bridge | Client ID de l'application Bridge de production |
| `BRIDGE_CLIENT_SECRET` | Client Secret de l'application Bridge | Client Secret de l'application Bridge de production |
| `BRIDGE_REDIRECT_URL` | URL de développement autorisée par Bridge, suivie de `/api/banking/callback` | `https://budgy-iota-green.vercel.app/api/banking/callback` |

Ouvrir Budgy sur le même hôte que l'URL de retour. Bridge Connect demande l'adresse e-mail de la session Budgy pour ouvrir un nouveau consentement. Les identifiants bancaires sont saisis dans le parcours Bridge ou auprès de la banque. Dans **Options → Comptes bancaires → Connecter une banque**, vérifier le catalogue français et choisir LCL ou Revolut si disponible sur l'application Bridge.

Le bouton **Synchroniser** importe le dernier état fourni par Bridge, qui actualise les connexions en arrière-plan. **Reconnecter** ouvre Bridge Connect pour renouveler l'autorisation bancaire. Les comptes et transactions restent en devise native. Le rapprochement Budget reste réservé aux transactions EUR comptabilisées.

Utiliser une base PostgreSQL vide et jetable pour les tests d'intégration. Définir `BUDGY_BANKING_TEST_DATABASE_URL` pour `npm test`. La suite crée le schéma bancaire et simule Bridge.
