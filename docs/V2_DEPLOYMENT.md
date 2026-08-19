# V2_DEPLOYMENT.md — Passage en production de Budgy V2

Ce document donne l'ordre **exact** à suivre. Ne pas permuter les étapes :
les migrations doivent être en base avant que le nouveau code ne les utilise.

---

## 0. Pré-requis

- Accès au dashboard Supabase du projet Budgy (ou `supabase` CLI connecté au projet).
- Accès au projet Vercel connecté à ce repo GitHub.
- Une fenêtre de calme (les migrations sont rapides mais modifient des policies RLS actives).

---

## 1. Backup

```bash
# Via Supabase CLI, ou depuis le dashboard : Database → Backups → Créer une sauvegarde manuelle.
supabase db dump --db-url "$SUPABASE_DB_URL" -f backup_pre_v2_$(date +%Y%m%d).sql
```

Conservez ce fichier avant de continuer. C'est le seul filet de sécurité en cas de problème
sur les policies RLS voyages (étape 2).

---

## 2. Migrations Supabase

Quatre nouveaux fichiers, à appliquer **dans cet ordre** (l'ordre alphabétique des noms
de fichiers respecte déjà les dépendances) :

```
supabase/migrations/202608190001_v2_user_modules.sql
supabase/migrations/202608190002_v2_trip_collaboration.sql
supabase/migrations/202608190003_v2_trip_expenses.sql
supabase/migrations/202608190004_historical_import_mapping_modules.sql
```

Application :

```bash
supabase db push
```

**Ce que fait chaque migration :**

1. `202608190001` — crée `user_modules`, ajoute des colonnes à `profiles` / `user_preferences` /
   `businesses`. **Effectue un backfill automatique** : chaque compte existant reçoit une ligne
   `user_modules` par domaine où il a déjà des données. Un compte totalement vide reçoit le
   module `budget` activé par défaut, pour ne jamais atterrir sur un accueil vide.
2. `202608190002` — crée `trip_members`, `trip_invitations`, `notifications`, les fonctions
   `SECURITY DEFINER` de permission, et **réécrit les policies RLS des voyages et de leurs
   enfants** (`flights`, `accommodations`, `trip_activities`, `trip_checklist_items`).
   N'importe aucune autre table.
3. `202608190003` — crée `trip_expenses`, `trip_expense_splits`, le bucket Storage
   `budgy-avatars` (public, 5 Mo max, images uniquement).
4. `202608190004` — remplace transactionnellement `import_budgy_archive` : compatibilité
   avec les anciennes clés `*_a_e_d`, activation des modules depuis les données importées,
   diagnostic clair si `purchasePriceAED` manque. Ne crée aucun business artificiel.

**Aucune migration ne touche** aux fichiers `202608180001` à `202608180006` (V1).

---

## 3. Vérification RLS (avant de pousser le code)

Exécutez ces contrôles dans l'éditeur SQL Supabase, connecté avec deux comptes de test
(A = propriétaire, B = extérieur) :

```sql
-- En tant que A : doit renvoyer les voyages de A uniquement.
select id, title from public.trips;

-- En tant que B, sans être membre d'aucun voyage de A : doit renvoyer 0 ligne.
select id, title from public.trips where user_id = '<uuid de A>';

-- Toujours en tant que B : doit échouer ou renvoyer 0 ligne (RLS insert).
insert into public.trip_members (trip_id, user_id, role)
values ('<un trip_id de A>', auth.uid(), 'owner');

-- En tant que A : doit fonctionner (A est owner du voyage).
select public.can_manage_trip_members('<trip_id de A>');
```

Vérifiez aussi que les autres domaines n'ont pas bougé :

```sql
-- En tant que B : doit renvoyer 0 ligne, même si A et B partagent un voyage.
select * from public.budget_entries where user_id = '<uuid de A>';
select * from public.tenants where user_id = '<uuid de A>';
select * from public.businesses where user_id = '<uuid de A>';
```

Un script automatisé équivalent existe dans `supabase/tests/rls_smoke.sql` (V1) —
à étendre séparément si vous voulez l'automatiser en CI.

---

## 4. Variables d'environnement

Aucune nouvelle variable requise. Le mode reste piloté par les trois variables existantes
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BUDGY_DATA_MODE`).

---

## 5. Push GitHub

```bash
git add -A
git commit -m "Budgy V2 : modules configurables, business templates, voyages collaboratifs"
git push origin main
```

---

## 6. Vercel

Le déploiement se lance automatiquement au push (si l'intégration GitHub → Vercel est active).
Sinon :

```bash
vercel --prod
```

Vérifiez dans les logs de build Vercel que les quatre commandes passent
(elles tournent déjà en local, ceci est une double vérification) :

```
npm run lint
npm run typecheck
npm test
npm run build
```

---

## 7. Smoke tests post-déploiement

Sur l'app en production, avec un compte de test :

1. Se connecter avec un compte **V1 existant** → l'app doit s'ouvrir normalement,
   sans redemander l'onboarding complet (backfill de l'étape 2).
2. Aller dans **Plus → Mes modules** → activer/désactiver un module → vérifier que
   la navigation basse se met à jour immédiatement.
3. Créer un **nouveau compte** → l'onboarding par sélection de modules doit s'afficher.
4. Créer un voyage → inviter un deuxième compte de test par pseudo → accepter
   l'invitation depuis l'autre compte → vérifier que le voyage apparaît bien pour les deux,
   mais qu'aucune autre donnée (budget, loyers, business) n'est visible pour l'invité.
5. Ajouter une dépense partagée sur ce voyage → vérifier la répartition et
   la carte « Comptes du voyage ».
6. Vérifier que **Business Dubaï** (`/business/dubai`) fonctionne toujours à l'identique
   pour le compte propriétaire historique.
7. Depuis **Plus → Migration**, relancer le même ZIP Budget JR sur un compte de staging :
   le premier import doit activer Budget, Voyages, Locations et Business ; le second doit
   annoncer que l'archive est déjà importée et ne créer aucun doublon.

---

## 8. Rollback (si nécessaire)

Le code est reversible par simple `git revert` + redéploiement Vercel.

Les migrations SQL sont **additives** (aucune table ni colonne V1 supprimée), donc un rollback
de code seul suffit dans la quasi-totalité des cas. Si un rollback des policies RLS voyages
s'avère nécessaire, restaurez uniquement les anciennes policies de `202608180004_rls.sql`
pour les tables `trips`, `flights`, `accommodations`, `trip_activities`, `trip_checklist_items`
(elles sont visibles dans ce fichier, section RLS) — pas besoin de restaurer tout le backup.
