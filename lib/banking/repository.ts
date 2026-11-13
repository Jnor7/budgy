import "server-only";

import { Pool, type PoolClient } from "pg";
import { BankingError } from "./errors";
import type { AccountSummary, ConnectionSummary, TransactionSummary } from "./models";
import { normalizeTransactions, splitAccount, suggestCategory } from "./normalize";
import type { BankAccountDetails, BankBalance, BankConsent, BankTransaction, ConnectionStatus, Institution } from "./provider";

export interface Connection {
  id: string;
  provider: string;
  institution_id: string;
  status: ConnectionStatus;
  requisition_id: string | null;
  consent_state_hash: string | null;
  consent_started_at: Date | null;
  expires_at: Date | null;
  next_sync_at: Date | null;
  operation_until: Date | null;
  operation_id: string | null;
}

export interface AccountSnapshot {
  providerId: string;
  details: BankAccountDetails;
  balances: BankBalance[];
  transactions: BankTransaction[];
}

export interface TransactionFilters {
  account?: string;
  q?: string;
  from?: string;
  to?: string;
  category?: string;
  direction?: "income" | "expense";
  page: number;
}

const accountColumns = "id, bank_connection_id, display_name, currency, current_balance, available_balance, active, last_synced_at";
let pool: Pool | undefined;

export class BankingRepository {
  constructor(readonly userId: string, private readonly testPool?: Pool) {}

  private async transaction<T>(run: (db: PoolClient) => Promise<T>): Promise<T> {
    const connectionString = process.env.DATABASE_URL;
    if (!this.testPool && !connectionString) throw new BankingError("unavailable");
    const db = await (this.testPool ?? (pool ??= new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5_000 }))).connect();
    try {
      await db.query("begin");
      await db.query("set local role budgy_banking_server");
      await db.query("select set_config('budgy.banking_user_id', $1, true)", [this.userId]);
      const value = await run(db);
      await db.query("commit");
      return value;
    } catch (error) {
      await db.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      db.release();
    }
  }

  overview() {
    return this.transaction(async (db) => {
      const { rows: connections } = await db.query<ConnectionSummary>(`
        select id, institution_id, institution_name,
          case when status = 'active' and expires_at <= now() then 'expired' else status end status,
          last_synced_at, expires_at,
          (status = 'active' and (expires_at is null or expires_at > now())
           and coalesce(next_sync_at, '-infinity') <= now()
           and (last_synced_at is null or last_synced_at <= now() - interval '12 hours')) auto_sync
        from bank_connections order by institution_name, id
      `);
      const { rows: accounts } = await db.query<AccountSummary>(`select ${accountColumns} from bank_accounts order by display_name, id`);
      return { connections, accounts };
    });
  }

  findByConsent(hash: string) {
    return this.transaction(async (db) => {
      const { rows } = await db.query<Connection>("select * from bank_connections where consent_state_hash = $1", [hash]);
      return rows[0];
    });
  }

  reserveConsent(provider: string, institution: Institution, operationId: string) {
    return this.transaction(async (db) => {
      await db.query(`
        insert into bank_connections (budgy_user_id, provider, institution_id, institution_name)
        values ($1, $2, $3, $4) on conflict (budgy_user_id, provider, institution_id) do nothing
      `, [this.userId, provider, institution.id, institution.name]);
      const { rows: [row] } = await db.query<Connection>(`
        select * from bank_connections where provider = $1 and institution_id = $2 for update
      `, [provider, institution.id]);
      if (!row) throw new BankingError("unavailable");
      this.checkOperation(row);
      const now = Date.now();
      if (row.status === "active" && (!row.expires_at || row.expires_at.getTime() > now)) {
        throw new BankingError("duplicate", 409);
      }
      await db.query(`
        update bank_connections set operation_id = $2, operation_until = now() + interval '5 minutes' where id = $1
      `, [row.id, operationId]);
      return row;
    });
  }

  saveConsent(id: string, operationId: string, state: string, consent: BankConsent) {
    return this.transaction(async (db) => {
      const result = await db.query(`
        update bank_connections set requisition_id = $3, agreement_id = $4, consent_state_hash = $5,
          consent_started_at = now(), status = 'pending', expires_at = null, updated_at = now(),
          next_sync_at = null, operation_id = null, operation_until = null
        where id = $1 and operation_id = $2
      `, [id, operationId, consent.id, consent.agreementId, state]);
      if (!result.rowCount) throw new BankingError("busy", 409);
    });
  }

  private checkOperation(row: Connection) {
    if (row.operation_until && row.operation_until.getTime() > Date.now()) throw new BankingError("busy", 409);
  }

  claim(id: string, operationId: string, kind: "sync" | "callback" | "disconnect", state?: string) {
    return this.transaction(async (db) => {
      const { rows: [row] } = await db.query<Connection>("select * from bank_connections where id = $1 for update", [id]);
      if (!row) throw new BankingError("missing", 404);
      this.checkOperation(row);
      if (kind === "callback" && (row.status !== "pending" || row.consent_state_hash !== state)) {
        throw new BankingError("invalid", 400);
      }
      if (kind === "sync" && !["active", "pending"].includes(row.status)) {
        throw new BankingError(row.status === "expired" || row.status === "revoked" ? row.status : "invalid", 409);
      }
      if (kind === "sync" && row.next_sync_at && row.next_sync_at.getTime() > Date.now()) {
        throw new BankingError("busy", 409);
      }
      if (!row.requisition_id && kind !== "disconnect") throw new BankingError("invalid", 400);
      await db.query(`
        update bank_connections set operation_id = $2, operation_until = now() + interval '5 minutes' where id = $1
      `, [id, operationId]);
      await db.query(`
        update bank_sync_runs set status = 'error', error_code = 'interrupted', finished_at = now()
        where bank_connection_id = $1 and status = 'running'
      `, [id]);
      if (kind !== "disconnect") {
        await db.query(`
          insert into bank_sync_runs (id, budgy_user_id, bank_connection_id, status) values ($1, $2, $3, 'running')
        `, [operationId, this.userId, id]);
      }
      return row;
    });
  }

  finish(id: string, operationId: string, options: {
    status?: ConnectionStatus; error?: string; retrySeconds?: number; forgetConsent?: boolean;
  }) {
    return this.transaction(async (db) => {
      const { rowCount } = await db.query(`
        update bank_connections set status = coalesce($3, status), updated_at = now(),
          consent_state_hash = case when $4 then null else consent_state_hash end,
          requisition_id = case when $5 then null else requisition_id end,
          agreement_id = case when $5 then null else agreement_id end,
          next_sync_at = case when $6::integer is null then next_sync_at else now() + make_interval(secs => $6) end,
          operation_id = null, operation_until = null
        where id = $1 and operation_id = $2
      `, [id, operationId, options.status ?? null,
        options.forgetConsent || options.status === "revoked" || options.status === "expired",
        options.forgetConsent ?? false, options.retrySeconds ?? null]);
      if (!rowCount) return;
      if (options.status === "revoked" || options.status === "expired") {
        await db.query("update bank_accounts set active = false, updated_at = now() where bank_connection_id = $1 and active", [id]);
      }
      await db.query(`
        update bank_sync_runs set status = 'error', error_code = $2, finished_at = now() where id = $1
      `, [operationId, options.error ?? null]);
    });
  }

  storeSnapshot(id: string, operationId: string, consent: BankConsent, snapshots: AccountSnapshot[]) {
    return this.transaction(async (db) => {
      const { rowCount } = await db.query(`
        select id from bank_connections where id = $1 and operation_id = $2 for update
      `, [id, operationId]);
      if (!rowCount) throw new BankingError("busy", 409);
      const currentAccounts: string[] = [];
      for (const snapshot of snapshots) {
        const { details, balances, transactions, providerId } = snapshot;
        for (const account of splitAccount(details, balances, transactions)) {
          const { rows } = await db.query<{ id: string; provider_account_id: string }>(`
            select id, provider_account_id from bank_accounts
            where bank_connection_id = $1 and currency = $2
              and (provider_account_id = $3 or (account_identity = $4 and not (id = any($5::uuid[]))))
            order by (provider_account_id = $3) desc, last_synced_at desc, id limit 2
          `, [id, account.currency, providerId, account.identity, currentAccounts]);
          const exactMatch = rows.find((row) => row.provider_account_id === providerId);
          const accountId = exactMatch?.id ?? (rows.length === 1 ? rows[0]?.id : undefined);
          const { rows: [saved] } = await db.query<{ id: string }>(`
            insert into bank_accounts
              (id, budgy_user_id, bank_connection_id, provider_account_id, account_identity, name, display_name,
               iban, currency, account_type, current_balance, available_balance, last_synced_at)
            values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
            on conflict (id) do update set provider_account_id = excluded.provider_account_id,
              account_identity = excluded.account_identity, name = excluded.name, display_name = excluded.display_name,
              iban = excluded.iban, account_type = excluded.account_type, current_balance = excluded.current_balance,
              available_balance = excluded.available_balance, active = true, updated_at = now(), last_synced_at = now()
            returning id
          `, [accountId ?? null, this.userId, id, providerId, account.identity, details.name, account.displayName,
            details.iban, account.currency, details.type, account.currentBalance, account.availableBalance]);
          if (!saved) throw new BankingError("unavailable");
          currentAccounts.push(saved.id);
          await this.storeTransactions(db, saved.id, account.transactions);
        }
      }
      if (!currentAccounts.length) throw new BankingError("processing", 409);
      await db.query(`
        update bank_accounts set active = false, updated_at = now()
        where bank_connection_id = $1 and active and not (id = any($2::uuid[]))
      `, [id, currentAccounts]);
      await db.query(`
        update bank_connections set status = 'active', agreement_id = coalesce($3, agreement_id),
          expires_at = coalesce($4, expires_at), consent_state_hash = null, last_synced_at = now(),
          updated_at = now(), next_sync_at = now() + interval '5 minutes', operation_id = null, operation_until = null
        where id = $1 and operation_id = $2
      `, [id, operationId, consent.agreementId, consent.expiresAt ?? null]);
      await db.query("update bank_sync_runs set status = 'success', finished_at = now() where id = $1", [operationId]);
    });
  }

  private async storeTransactions(db: PoolClient, accountId: string, items: BankTransaction[]) {
    const rows = normalizeTransactions(accountId, items).map((item) => ({
      provider_transaction_id: item.providerId, dedupe_key: item.key, booking_date: item.bookingDate,
      value_date: item.valueDate, amount: item.amount, currency: item.currency,
      description: item.description, counterparty: item.counterparty, status: item.status,
      raw_category: item.rawCategory, budgy_category: suggestCategory(`${item.description} ${item.counterparty ?? ""}`),
    }));
    await db.query(`
      delete from bank_transactions where bank_account_id = $1 and status = 'pending'
        and dedupe_key not in (select value->>'dedupe_key' from jsonb_array_elements($2::jsonb))
    `, [accountId, JSON.stringify(rows)]);
    await db.query(`
      insert into bank_transactions (budgy_user_id, bank_account_id, provider_transaction_id, dedupe_key,
        booking_date, value_date, amount, currency, description, counterparty, status, raw_category, budgy_category)
      select $1, $2, provider_transaction_id, dedupe_key,
        booking_date, value_date, amount, currency, description, counterparty, status, raw_category, budgy_category
      from jsonb_to_recordset($3::jsonb) as tx(provider_transaction_id text, dedupe_key text, booking_date date,
        value_date date, amount numeric, currency text, description text, counterparty text, status text,
        raw_category text, budgy_category text)
      on conflict (bank_account_id, dedupe_key) do update set booking_date = excluded.booking_date,
        value_date = excluded.value_date, amount = excluded.amount, currency = excluded.currency,
        description = excluded.description, counterparty = excluded.counterparty, status = excluded.status,
        raw_category = excluded.raw_category, updated_at = now()
      where bank_transactions.status = 'pending' or excluded.status = 'booked'
    `, [this.userId, accountId, JSON.stringify(rows)]);
  }

  transactions(filters: TransactionFilters) {
    return this.transaction(async (db) => {
      const { rows: accounts } = await db.query<AccountSummary>(`select ${accountColumns} from bank_accounts order by display_name, id`);
      const { rows: categories } = await db.query<{ budgy_category: string }>(`
        select distinct budgy_category from bank_transactions where budgy_category is not null order by budgy_category
      `);
      const { rows } = await db.query<TransactionSummary>(`
        select id, bank_account_id, coalesce(booking_date, value_date)::text as date, amount, currency,
          description, counterparty, status, budgy_category, budget_entry_id
        from bank_transactions
        where ($1::uuid is null or bank_account_id = $1)
          and ($2::text is null or strpos(lower(description || ' ' || coalesce(counterparty, '')), lower($2)) > 0)
          and ($3::date is null or coalesce(booking_date, value_date) >= $3)
          and ($4::date is null or coalesce(booking_date, value_date) <= $4)
          and ($5::text is null or budgy_category = $5)
          and ($6::text is null or ($6 = 'income' and amount > 0) or ($6 = 'expense' and amount < 0))
        order by coalesce(booking_date, value_date) desc nulls last, id
        limit 51 offset $7
      `, [filters.account ?? null, filters.q ?? null, filters.from ?? null, filters.to ?? null,
        filters.category ?? null, filters.direction ?? null, filters.page * 50]);
      return { accounts, categories: categories.map((item) => item.budgy_category), transactions: rows.slice(0, 50), hasMore: rows.length > 50 };
    });
  }

  setCategory(id: string, category: string | null) {
    return this.transaction(async (db) => {
      const { rowCount } = await db.query("update bank_transactions set budgy_category = $2, updated_at = now() where id = $1", [id, category]);
      if (!rowCount) throw new BankingError("missing", 404);
    });
  }

  linkBudget(id: string, budgetId?: string) {
    return this.transaction(async (db) => {
      const { rows: [item] } = await db.query<TransactionSummary>(`
        select id, description, counterparty, amount, currency, coalesce(booking_date, value_date)::text date,
          status, budgy_category, budget_entry_id
        from bank_transactions where id = $1 for update
      `, [id]);
      if (!item) throw new BankingError("missing", 404);
      if (item.budget_entry_id && (!budgetId || item.budget_entry_id === budgetId)) return item.budget_entry_id;
      if (item.status !== "booked" || item.currency !== "EUR") throw new BankingError("budget_link", 409);
      await db.query("reset role");
      const income = Number(item.amount) > 0;
      const type = income ? "revenu" : "depense";
      if (budgetId) {
        const { rowCount } = await db.query(`
          select id from public.budget_entries where id = $1 and user_id = $2 and type = $3 and amount = abs($4::numeric)
          for key share
        `, [budgetId, this.userId, type, item.amount]);
        if (!rowCount) throw new BankingError("budget_link", 409);
      } else {
        if (!item.date || Number(item.amount) === 0) throw new BankingError("budget_link", 409);
        const { rows: [entry] } = await db.query<{ id: string }>(`
          insert into public.budget_entries (user_id, title, amount, type, category, bucket, scope, date, status)
          values ($1, $2, abs($3::numeric), $4, $5, $6, 'Perso', $7, 'recu') returning id
        `, [this.userId, item.counterparty || item.description || "Transaction bancaire", item.amount, type,
          item.budgy_category ?? "Autre", income ? "Rentrée" : "Variable", item.date]);
        if (!entry) throw new BankingError("unavailable");
        budgetId = entry.id;
      }
      await db.query("set local role budgy_banking_server");
      try {
        await db.query("update bank_transactions set budget_entry_id = $2, updated_at = now() where id = $1", [id, budgetId]);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw new BankingError("budget_link", 409);
        throw error;
      }
      return budgetId;
    });
  }
}
