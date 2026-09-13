# Budgy — préparation Neon

Ce dossier contient uniquement les documents de préparation de la phase 2 de la migration Supabase vers Neon.

## État de cette phase

- Supabase reste la production et la source de vérité.
- Le projet Neon `Budgy` existe en région AWS Europe Central 1 (Francfort) et Neon Auth est activé.
- Aucun SQL n'a été exécuté sur Supabase ou Neon.
- Aucun compte n'a été créé ou importé.
- Aucune variable Vercel ou locale n'a été modifiée.
- Aucun code applicatif et aucune dépendance Supabase n'ont été modifiés.

## Documents

- [`migration-plan.md`](migration-plan.md) : séquence opérationnelle proposée, critères de validation et rollback.
- [`schema-compatibility.md`](schema-compatibility.md) : cartographie des 33 tables, 38 FK Auth, 121 policies, fonctions, Storage, Realtime et compatibilité d'import.
- [`../docs/SUPABASE_TO_NEON_PHASE2_PLAN.md`](../docs/SUPABASE_TO_NEON_PHASE2_PLAN.md) : plan directeur de la phase 2.
- [`../docs/SUPABASE_TO_NEON_AUDIT.md`](../docs/SUPABASE_TO_NEON_AUDIT.md) : audit de phase 1 utilisé comme source locale.

## Décision structurante

Les UUID Supabase existants restent les identifiants métier canoniques de Budgy. Ils ne doivent pas être réécrits dans les 38 colonnes concernées.

Neon expose le sujet JWT avec `auth.user_id()` sous forme de `text`. La compatibilité UUID `auth.uid()` n'est sûre que si le claim `sub` est effectivement un UUID. La création d'un utilisateur Neon Auth ne documente pas, à ce stade, une garantie permettant de reprendre arbitrairement le même identifiant interne que Supabase. Le plan retient donc une correspondance explicite :

```text
Neon Auth sub (text)
        │
        ▼
table de correspondance d'identité
        │
        ▼
UUID Budgy canonique (ancien auth.users.id)
        │
        ▼
38 FK et toutes les règles métier existantes
```

La table et la fonction de compatibilité ne sont qu'une conception dans ces documents. Elles ne sont pas créées pendant cette phase.

## Sources techniques vérifiées

- Neon RLS et `auth.user_id()` : https://neon.com/docs/guides/row-level-security
- Implémentation officielle `pg_session_jwt` (`auth.user_id()` retourne `text`, `auth.uid()` retourne `uuid`) : https://github.com/neondatabase/pg_session_jwt
- Neon Auth actuel, basé sur Better Auth et stocké dans `neon_auth.*` : https://neon.com/blog/neon-auth-branchable-identity-in-your-database
- API de gestion Neon Auth : https://neon.com/docs/auth/guides/manage-auth-api
- Import Data Assistant : https://neon.com/migration
