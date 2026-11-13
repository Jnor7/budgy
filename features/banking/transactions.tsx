"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useBudgyData } from "@/lib/data/data-provider";
import type { TransactionPage, TransactionSummary } from "@/lib/banking/models";
import { money, shortDate } from "@/lib/format";
import { bankingRequest, requestError } from "./api";
import styles from "./banking.module.css";

const emptyFilters = { q: "", account: "", from: "", to: "", category: "", direction: "" };

export function BankingTransactionsPage() {
  const { data: budgy, reload } = useBudgyData();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<TransactionPage>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    params.set("page", String(page));
    let mounted = true;
    void bankingRequest<TransactionPage>(`transactions?${params}`)
      .then((value) => { if (mounted) setData(value); })
      .catch((reason) => { if (mounted) setError(requestError(reason)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [filters, page, revision]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPage(0);
    setFilters({ ...draft });
  }

  function changePage(next: number) {
    setLoading(true);
    setError("");
    setPage(next);
  }

  async function update(action: "category" | "budget", body: { id: string; category?: string | null; budgetId?: string }) {
    setBusy(body.id);
    setError("");
    setNotice("");
    try {
      await bankingRequest(action, body);
      setRevision((current) => current + 1);
      setNotice(action === "category" ? "Catégorie enregistrée." : "Transaction associée au Budget.");
      if (action === "budget") await reload();
    } catch (error) {
      setError(requestError(error));
    } finally {
      setBusy("");
    }
  }

  function budgetOptions(item: TransactionSummary) {
    const amount = Number(item.amount);
    return budgy.budgetEntries.filter((entry) => entry.amount === Math.abs(amount) && entry.type === (amount > 0 ? "revenu" : "depense"));
  }

  return (
    <main className="page v2-page v2">
      <Link href="/banking" className="button"><ArrowLeft size={16} /> Comptes bancaires</Link>
      <header className="v2-greet"><div><h1>Transactions bancaires</h1></div></header>
      <form className={`v2-card ${styles.panel}`} onSubmit={applyFilters}>
        <div className={styles.filters}>
          <label className={styles.field}>Recherche
            <input className="input" type="search" maxLength={160} value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} />
          </label>
          <label className={styles.field}>Compte
            <select className="select" value={draft.account} onChange={(event) => setDraft({ ...draft, account: event.target.value })}>
              <option value="">Tous les comptes</option>
              {data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {account.currency}</option>)}
            </select>
          </label>
          <label className={styles.field}>Du
            <input className="input" type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
          </label>
          <label className={styles.field}>Au
            <input className="input" type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
          </label>
          <label className={styles.field}>Catégorie
            <select className="select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              <option value="">Toutes les catégories</option>
              {data?.categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className={styles.field}>Type
            <select className="select" value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value })}>
              <option value="">Tous les mouvements</option><option value="income">Revenus</option><option value="expense">Dépenses</option>
            </select>
          </label>
        </div>
        <div className={styles.actions}><button className="button button-primary" disabled={loading}>Filtrer</button></div>
      </form>
      {error && <p className={styles.notice} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {loading && <p role="status">Chargement des transactions…</p>}
      {!loading && data?.transactions.length === 0 && <p className="muted">Aucune transaction pour ces filtres.</p>}
      {!loading && data?.transactions.map((item) => {
        const amount = Number(item.amount);
        const account = data.accounts.find((row) => row.id === item.bank_account_id);
        const eligible = item.status === "booked" && item.currency === "EUR" && !!item.date && amount !== 0;
        return (
          <article key={item.id} className={`v2-card ${styles.panel}`}>
            <div className={styles.heading}>
              <div className={styles.rowTitle}>
                <strong>{item.counterparty || item.description || "Transaction bancaire"}</strong>
                {item.counterparty && item.description && item.description !== item.counterparty && <span className={styles.meta}>{item.description}</span>}
                <span className={styles.meta}>{[item.date && shortDate(item.date), account?.display_name, item.status === "pending" && "En attente"].filter(Boolean).join(" · ")}</span>
              </div>
              <strong className={amount > 0 ? styles.income : undefined}>{amount > 0 ? "+" : ""}{money(amount, item.currency)}</strong>
            </div>
            <details>
              <summary>{item.budgy_category ?? "Sans catégorie"}{item.budget_entry_id ? " · Associée au Budget" : ""}</summary>
              <div className={styles.detail}>
                <form className={styles.actions} onSubmit={(event) => {
                  event.preventDefault();
                  const category = String(new FormData(event.currentTarget).get("category") ?? "");
                  void update("category", { id: item.id, category });
                }}>
                  <label className={styles.field}>Catégorie Budgy
                    <input name="category" className="input" maxLength={80} defaultValue={item.budgy_category ?? ""} />
                  </label>
                  <button className="button" disabled={!!busy}>Enregistrer</button>
                </form>
                {eligible && !item.budget_entry_id && <>
                  <button className="button" disabled={!!busy} onClick={() => void update("budget", { id: item.id })}>Ajouter au Budget</button>
                  <BudgetLink options={budgetOptions(item)} disabled={!!busy}
                    onLink={(budgetId) => void update("budget", { id: item.id, budgetId })} />
                </>}
              </div>
            </details>
          </article>
        );
      })}
      {!loading && data && (page > 0 || data.hasMore) && <nav className={styles.actions} aria-label="Pagination des transactions">
        <button className="button" disabled={page === 0} onClick={() => changePage(page - 1)}>Précédent</button>
        <button className="button" disabled={!data.hasMore} onClick={() => changePage(page + 1)}>Suivant</button>
      </nav>}
    </main>
  );
}

function BudgetLink({ options, disabled, onLink }: {
  options: { id: string; title: string; date: string }[];
  disabled: boolean;
  onLink: (id: string) => void;
}) {
  if (!options.length) return null;
  return <form className={styles.actions} onSubmit={(event) => {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get("budgetId") ?? "");
    if (id) onLink(id);
  }}>
    <label className={styles.field}>Entrée Budget existante
      <select className="select" name="budgetId" required defaultValue="">
        <option value="" disabled>Choisir une entrée</option>
        {options.map((entry) => <option value={entry.id} key={entry.id}>{entry.title} · {shortDate(entry.date)}</option>)}
      </select>
    </label>
    <button className="button" disabled={disabled}>Associer</button>
  </form>;
}
