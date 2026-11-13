"use client";

import Link from "next/link";
import { Landmark, List, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/feedback";
import { V2Icon } from "@/components/ui/v2";
import { bankingMessages } from "@/lib/banking/errors";
import type { BankingOverview, ConnectionSummary } from "@/lib/banking/models";
import type { Institution } from "@/lib/banking/provider";
import { fullDate, money } from "@/lib/format";
import { bankingRequest, requestError } from "./api";
import styles from "./banking.module.css";

const labels = {
  active: "Connectée",
  pending: "Consentement en attente",
  expired: "Connexion à renouveler",
  revoked: "Déconnectée",
  error: "Connexion interrompue",
};

const isPriority = (name: string) => /\b(lcl|revolut)\b|crédit lyonnais/i.test(name);

export function BankingOverviewPage({ result }: { result?: string }) {
  const [overview, setOverview] = useState<BankingOverview>();
  const [institutions, setInstitutions] = useState<Institution[]>();
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState("");
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [confirmation, setConfirmation] = useState<ConnectionSummary>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => {
    if (result === "connected") return "Banque connectée et synchronisée.";
    if (result && Object.hasOwn(bankingMessages, result)) return bankingMessages[result as keyof typeof bankingMessages];
    return "";
  });

  useEffect(() => {
    let mounted = true;
    void bankingRequest<BankingOverview>("overview").then(async (data) => {
      if (!mounted) return;
      setOverview(data);
      const due = data.connections.filter((row) => row.auto_sync);
      if (!due.length) return;
      setAutoSyncing(true);
      for (const row of due) {
        if (!mounted) return;
        await bankingRequest("sync", { id: row.id }).catch((reason) => { if (mounted) setError(requestError(reason)); });
      }
      const fresh = await bankingRequest<BankingOverview>("overview");
      if (mounted) setOverview(fresh);
    }).catch((reason) => { if (mounted) setError(requestError(reason)); })
      .finally(() => { if (mounted) setAutoSyncing(false); });
    return () => { mounted = false; };
  }, []);

  async function openPicker() {
    setSelecting(true);
    if (institutions) return;
    setError("");
    setBusy("institutions");
    try {
      const data = await bankingRequest<Institution[]>("institutions");
      setInstitutions(data.sort((a, b) => Number(isPriority(b.name)) - Number(isPriority(a.name)) || a.name.localeCompare(b.name, "fr")));
    } catch (error) {
      setSelecting(false);
      setError(requestError(error));
    } finally {
      setBusy("");
    }
  }

  async function connect(institutionId: string) {
    setBusy(institutionId);
    setError("");
    try {
      const { link } = await bankingRequest<{ link: string }>("connect", { institutionId });
      window.location.assign(link);
    } catch (error) {
      setError(requestError(error));
      setBusy("");
    }
  }

  async function operate(action: "sync" | "disconnect", id: string) {
    setBusy(id);
    setConfirmation(undefined);
    setNotice("");
    setError("");
    try {
      await bankingRequest(action, { id });
      setNotice(action === "sync" ? "Comptes synchronisés." : "Banque déconnectée.");
    } catch (error) {
      setError(requestError(error));
    } finally {
      try {
        setOverview(await bankingRequest<BankingOverview>("overview"));
      } catch (error) {
        setError(requestError(error));
      }
      setBusy("");
    }
  }

  const accounts = overview?.accounts ?? [];
  const totals = new Map<string, number>();
  for (const account of accounts) {
    const connection = overview?.connections.find((row) => row.id === account.bank_connection_id);
    if (connection?.status !== "active" || !account.active || account.available_balance === null) continue;
    totals.set(account.currency, (totals.get(account.currency) ?? 0) + Number(account.available_balance));
  }

  return (
    <main className="page v2-page v2">
      <header className="v2-greet"><div><h1>Comptes bancaires</h1></div></header>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.notice} role="alert">{error}</p>}
      {!overview && !error && <p role="status">Chargement des comptes…</p>}
      {overview && !overview.configured && <section className={`v2-card ${styles.panel}`}><p>Connexion bancaire non configurée.</p></section>}
      {overview?.configured && <>
        <section className={`v2-card ${styles.total}`}>
          <h2>Total disponible</h2>
          {totals.size === 0
            ? <p className="muted">Aucun solde disponible communiqué.</p>
            : <div className={styles.totals}>{[...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => (
              <div key={currency}><strong>{money(amount, currency)}</strong><span>{currency}</span></div>
            ))}</div>}
        </section>
        <div className={styles.actions}>
          <button className="button button-primary" disabled={!!busy || autoSyncing} onClick={() => void openPicker()}><Plus size={18} /> Connecter une banque</button>
          <Link className="button" href="/banking/transactions"><List size={18} /> Transactions</Link>
        </div>
        {autoSyncing && <p className="muted" role="status">Actualisation des comptes…</p>}
        {selecting && <section className={`v2-card ${styles.panel}`}>
          <div className={styles.heading}><h2>Choisir une banque</h2><button className="button" onClick={() => setSelecting(false)}>Fermer</button></div>
          <label className={styles.field}>Banque en France
            <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="LCL, Revolut…" />
          </label>
          {!institutions && <p role="status">Chargement des banques…</p>}
          {institutions && <div className={styles.institutions}>
            {institutions.filter((item) => item.name.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))).map((item) => (
              <button className="v2-row" key={item.id} disabled={!!busy} onClick={() => void connect(item.id)}>
                <V2Icon icon={Landmark} tone="purple" /><span className="v2-row-main"><strong>{item.name}</strong></span>
                {busy === item.id && <span>Redirection…</span>}
              </button>
            ))}
            {!institutions.some((item) => item.name.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))) && <p>Aucune banque trouvée.</p>}
          </div>}
        </section>}
        {overview.connections.length === 0 && !selecting && <p className="muted">Vos comptes s’afficheront après le premier consentement bancaire.</p>}
        {overview.connections.map((connection) => (
          <section className={`v2-card ${styles.panel}`} key={connection.id}>
            <div className={styles.heading}>
              <div className={styles.institution}><V2Icon icon={Landmark} tone="purple" /><h2>{connection.institution_name}</h2></div>
              <span className={styles.status} data-status={connection.status}>{labels[connection.status]}</span>
            </div>
            {accounts.filter((account) => account.bank_connection_id === connection.id && account.active).map((account) => (
              <div className={styles.account} key={account.id}>
                <div><strong>{account.display_name}</strong><span>{account.currency}</span></div>
                <div className={styles.amount}>
                  <strong>{account.current_balance !== null ? money(Number(account.current_balance), account.currency) : "—"}</strong>
                  {account.available_balance !== null && <span>{money(Number(account.available_balance), account.currency)} disponibles</span>}
                </div>
              </div>
            ))}
            <p className="muted small">{connection.last_synced_at ? `Dernière synchro le ${fullDate(connection.last_synced_at)}` : "Première synchronisation en attente"}</p>
            <div className={styles.actions}>
              {["active", "pending"].includes(connection.status) && <button className="button" disabled={!!busy || autoSyncing} onClick={() => void operate("sync", connection.id)}>
                {busy === connection.id ? "Opération en cours…" : "Synchroniser"}
              </button>}
              {connection.status !== "active" && <button className="button button-primary" disabled={!!busy || autoSyncing} onClick={() => void connect(connection.institution_id)}>
                {busy === connection.institution_id ? "Redirection…" : "Reconnecter"}
              </button>}
              {connection.status !== "revoked" && <button className="button" disabled={!!busy || autoSyncing} onClick={() => setConfirmation(connection)}>Déconnecter</button>}
            </div>
          </section>
        ))}
      </>}
      <ConfirmDialog open={!!confirmation} title={`Déconnecter ${confirmation?.institution_name ?? "cette banque"} ?`}
        detail="Les transactions déjà importées resteront consultables."
        confirmLabel="Déconnecter" onCancel={() => setConfirmation(undefined)}
        onConfirm={() => { if (confirmation) void operate("disconnect", confirmation.id); }} />
    </main>
  );
}
