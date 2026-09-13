# Budgy — Row counts avant migration

Date de préparation : 13 septembre 2026
Source attendue : Supabase production
Statut : **33/33 mesurées dans le backup Supabase du 9 septembre 2026 à 17:54:51**

Le projet Supabase étant en pause, les valeurs ont été extraites directement des sections `COPY public.<table>` du backup téléchargeable Supabase. Elles constituent la référence exacte du snapshot importé. Elles ne prétendent pas mesurer un état postérieur au backup.

| Domaine | Table | Supabase | Neon | Écart | Statut |
|---|---|---:|---:|---:|---|
| Identité | `profiles` | 4 | 4 | 0 | Identique |
| Identité | `user_preferences` | 4 | 4 | 0 | Identique |
| Migration | `migration_batches` | 1 | 1 | 0 | Identique |
| Identité | `user_modules` | 20 | 20 | 0 | Identique |
| Budget | `budget_entries` | 142 | 142 | 0 | Identique |
| Budget | `subscriptions` | 7 | 7 | 0 | Identique |
| Locatif | `tenants` | 3 | 3 | 0 | Identique |
| Locatif | `rent_payments` | 21 | 21 | 0 | Identique |
| Locatif | `tenant_debts` | 20 | 20 | 0 | Identique |
| Dubaï | `dubai_parts` | 3 | 3 | 0 | Identique |
| Dubaï | `dubai_sales` | 9 | 9 | 0 | Identique |
| Dubaï | `dubai_expenses` | 2 | 2 | 0 | Identique |
| Dubaï | `dubai_cash_movements` | 8 | 8 | 0 | Identique |
| Business | `businesses` | 0 | 0 | 0 | Identique |
| Business | `business_contacts` | 0 | 0 | 0 | Identique |
| Business | `business_items` | 0 | 0 | 0 | Identique |
| Business | `business_transactions` | 0 | 0 | 0 | Identique |
| Business | `business_bookings` | 0 | 0 | 0 | Identique |
| Business | `business_tasks` | 0 | 0 | 0 | Identique |
| Storage métier | `attachments` | 0 | 0 | 0 | Identique |
| Travel | `trips` | 12 | 12 | 0 | Identique |
| Travel | `flights` | 4 | 4 | 0 | Identique |
| Travel | `accommodations` | 2 | 2 | 0 | Identique |
| Travel | `trip_activities` | 0 | 0 | 0 | Identique |
| Travel | `trip_checklist_items` | 8 | 8 | 0 | Identique |
| Travel | `trip_members` | 1 | 1 | 0 | Identique |
| Travel | `trip_invitations` | 1 | 1 | 0 | Identique |
| Travel | `notifications` | 11 | 11 | 0 | Identique |
| Travel | `trip_expenses` | 2 | 2 | 0 | Identique |
| Travel | `trip_expense_splits` | 0 | 0 | 0 | Identique |
| Travel | `travel_friend_requests` | 4 | 4 | 0 | Identique |
| Travel | `travel_friends` | 1 | 1 | 0 | Identique |
| Référentiel | `airports` | 4 562 | 4 562 | 0 | Identique |
|  | **Total** | **4 852 lignes / 33 tables** | **4 852 lignes / 33 tables** | **0** | **Identique** |

## Contrôle UUID source

- 185 valeurs présentes dans les colonnes utilisateur critiques ont été vérifiées.
- UUID invalides : 0.
- Références utilisateur sans ligne `profiles` correspondante dans le périmètre ciblé : 0.
- Références `trip_id` sans voyage correspondant dans membres/dépenses/checklist : 0.

Les mêmes contrôles ont été reproduits après import sur la branche Neon `migration-supabase` : 0 référence utilisateur sans profil et 0 relation Travel/locatif/business orpheline dans le périmètre ciblé. Les valeurs elles-mêmes ne sont pas écrites dans ce document afin de ne pas versionner de données personnelles.

## Checksums d'échantillons reproductibles

Hash SHA-256 du contenu brut de chaque section `COPY`, ordre du dump conservé :

| Table | Lignes | SHA-256 source |
|---|---:|---|
| `profiles` | 4 | `22DBEEEA97072C8610F2C81546445F7F214AFBF1D0EA283DD3CF128C2BF7D6B3` |
| `budget_entries` | 142 | `03C902C2E9BC2E34F50232AA3CBD60F5AE8E02792774401FCB63222956151666` |
| `trips` | 12 | `A56149232AE0E0A06CAD36545B49ABDDDF13076529337DB2B6A698234FA08CCB` |
| `trip_members` | 1 | `D8236942F61ABC2BD4CAAEBE7B5AF1023BFB44199B133D3D74623F95EE23E32E` |
| `trip_expenses` | 2 | `1E5A9B53A41C5558E81E98780D54934CA8B16AEE0C51A9C9972E365D7A36AAB3` |
| `trip_checklist_items` | 8 | `CCE63D42BC086CA623B5EAFC050CE86D9F1B5287BFA443E8C41875E4A6ADA73F` |
| `travel_friend_requests` | 4 | `E56258A52F23E3EE8525155C160E9130F7F35B11B99230778C1A7ACB2396B275` |
| `travel_friends` | 1 | `5273B3066B20E42F1139E5AAAFD54E0D455215DCE4FAD58C7BEB4AABD97F2CBC` |
| `tenants` | 3 | `E6C3665059E29B8B3DBA394EC4158E14F3A397A0DFA750FA77899755727A9285` |
| `businesses` | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` |
| `attachments` | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` |

## Conditions de mesure

- Utiliser le même instant logique pour les counts source ou documenter les écritures intervenues entre mesures.
- Ne jamais mélanger un count de production en mouvement avec un count d'un snapshot plus ancien sans enregistrer l'horodatage.
- Relever les counts Neon seulement après fin complète de l'import.
- Toute différence doit être expliquée ligne par ligne avant validation.

## Contrôles complémentaires requis

Les row counts seuls ne suffisent pas. Le rapport Phase 3 doit aussi vérifier :

- conservation exacte des UUID utilisateur dans toutes les colonnes concernées ;
- `trips.user_id` et membres associés ;
- `trip_expenses`, `paid_by` et splits ;
- checklist et assignations ;
- relations d'amitié et demandes ;
- business et dépendances ;
- locataires, paiements et dettes ;
- métadonnées `attachments` et existence des objets contrôlée séparément.
