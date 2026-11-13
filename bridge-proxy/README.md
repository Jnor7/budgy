# Proxy Bridge pour Budgy

```text
Budgy sur Vercel ── HTTPS + x-budgy-proxy-secret ──▶ Render ── HTTPS ──▶ Bridge API
Navigateur ◀── Bridge Connect ──▶ https://budgy-iota-green.vercel.app/api/banking/callback
```

Le proxy Node écoute sur `0.0.0.0:$PORT` et fournit `GET /health`, qui répond `200 {"ok":true}`. Il conserve les données en mémoire le temps de chaque requête. Le secret partagé est comparé en temps constant. Le proxy ajoute les identifiants Bridge, limite les requêtes aux routes et paramètres utilisés par Budgy et renvoie les champs nécessaires à l'intégration.

## Render

Créer un **Web Service** depuis le dépôt GitHub de Budgy.

| Champ | Valeur |
| --- | --- |
| Repository | `Jnor7/budgy` |
| Name | `budgy-bridge-proxy` |
| Language | `Node` |
| Branch | `main` |
| Region | `Frankfurt (EU Central)` |
| Root Directory | `bridge-proxy` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

| Variable Render | Valeur |
| --- | --- |
| `BRIDGE_CLIENT_ID` | Client ID de l'application Bridge Agrégation |
| `BRIDGE_CLIENT_SECRET` | Client Secret de cette application |
| `BUDGY_PROXY_SECRET` | Secret partagé. Générer une valeur avec `openssl rand -hex 32`. |

Render fournit `PORT`. Après déploiement, ouvrir **Connect → Outbound** sur le service et ajouter toutes les IP ou plages affichées aux **Authorized IPs** de l'application Bridge. Render peut utiliser n'importe quelle IP de ces plages. Bridge recommande des plages de moins de 1 000 adresses. Si Bridge refuse les plages affichées, l'activation dépend de la disponibilité d'IP de sortie qu'il accepte. Le plan Render Free peut prendre environ une minute à redémarrer après 15 minutes d'inactivité. [IP de sortie Render](https://render.com/docs/outbound-ip-addresses) · [Configuration Bridge](https://docs.bridgeapi.io/docs/configure-1) · [Plan Render Free](https://render.com/docs/free)

## Vercel

Dans **budgy → Settings → Environment Variables → Production**, ajouter ces variables, puis redéployer.

| Variable Vercel | Valeur |
| --- | --- |
| `BUDGY_BRIDGE_PROXY_URL` | URL HTTPS exacte du Web Service Render, par exemple `https://budgy-bridge-proxy.onrender.com` |
| `BUDGY_PROXY_SECRET` | Même valeur que sur Render |
| `BRIDGE_REDIRECT_URL` | `https://budgy-iota-green.vercel.app/api/banking/callback` |

Autoriser le domaine Vercel du callback dans l'application Bridge. Vérifier le proxy avec `curl -fsS https://budgy-bridge-proxy.onrender.com/health`, en utilisant l'URL attribuée par Render.

## Routes

| Méthode | Route Bridge | Usage |
| --- | --- | --- |
| GET | `/v3/providers` | Catalogue d'agrégation |
| POST | `/v3/aggregation/users` | Création d'un utilisateur Bridge |
| POST | `/v3/aggregation/authorization/token` | Jeton d'utilisateur Bridge |
| POST | `/v3/aggregation/connect-sessions` | Consentement ou renouvellement |
| GET | `/v3/aggregation/items/{id}` | État de la connexion |
| GET | `/v3/aggregation/accounts` | Comptes et soldes |
| GET | `/v3/aggregation/transactions` | Transactions paginées |
| DELETE | `/v3/aggregation/items/{id}` | Déconnexion |

En local, depuis `bridge-proxy`, lancer `npm install`, puis `npm test`. Pour démarrer le proxy, injecter les variables Render dans l'environnement du processus et lancer `npm start`. L'URL locale par défaut est `http://127.0.0.1:10000`.
