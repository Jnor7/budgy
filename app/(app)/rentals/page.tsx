"use client";

import {
  Banknote, Building2, ChevronLeft, ChevronRight, CircleAlert, Plus, RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RowMenu } from "@/components/ui/menu";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { Field, Sheet } from "@/components/ui/modal";
import { V2Avatar, V2Empty, V2Skeleton } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { totalDueForMonth } from "@/lib/domain/tenants";
import { eur, monthLabel } from "@/lib/format";
import type { Tenant } from "@/types/domain";

type TenantDraft = { name: string; monthlyRent: number; dueDay: number; note: string };
const blankTenant: TenantDraft = { name: "", monthlyRent: 0, dueDay: 5, note: "" };

/**
 * Gestion locative V2. Les calculs métier (`totalDueForMonth`, `carryOverForMonth`)
 * sont utilisés tels quels : seule l'expérience visuelle change.
 */
export default function RentalsPage() {
  const { data, ready, create, update, remove } = useBudgyData();
  const [cursor, setCursor] = useState(() => new Date());
  const [tenantOpen, setTenantOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [tenantDraft, setTenantDraft] = useState<TenantDraft>(blankTenant);
  const [paymentTenant, setPaymentTenant] = useState<Tenant>();
  const [debtTenant, setDebtTenant] = useState<Tenant>();
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [debtLabel, setDebtLabel] = useState("");
  const [debtAmount, setDebtAmount] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Tenant>();
  const [quickPayment, setQuickPayment] = useState(false);
  const actionHandled = useRef(false);
  const { showToast } = useToast();

  const month = cursor.getMonth() + 1;
  const year = cursor.getFullYear();

  const due = (tenant: Tenant) => totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, year, month);
  const received = (tenant: Tenant) => data.rentPayments
    .filter((payment) => payment.tenantId === tenant.id && payment.month === month && payment.year === year)
    .reduce((sum, payment) => sum + payment.amountReceived, 0);

  const totals = useMemo(() => {
    const expected = data.tenants.reduce((sum, tenant) => sum + due(tenant), 0);
    const paid = data.tenants.reduce((sum, tenant) => sum + received(tenant), 0);
    return { expected, paid, unpaid: Math.max(expected - paid, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rentPayments, data.tenantDebts, data.tenants, month, year]);

  const openTenant = (tenant?: Tenant) => {
    setEditing(tenant?.id);
    setTenantDraft(tenant
      ? { name: tenant.name, monthlyRent: tenant.monthlyRent, dueDay: tenant.dueDay, note: tenant.note }
      : blankTenant);
    setTenantOpen(true);
  };

  const saveTenant = () => {
    if (!tenantDraft.name.trim() || tenantDraft.monthlyRent <= 0) return;
    if (editing) update("tenants", editing, tenantDraft);
    else create("tenants", { ...tenantDraft, createdAt: new Date().toISOString() });
    setTenantOpen(false);
  };

  const savePayment = () => {
    if (!paymentTenant || amount < 0) return;
    const existing = data.rentPayments.find((payment) =>
      payment.tenantId === paymentTenant.id && payment.month === month && payment.year === year);
    const totalDue = due(paymentTenant);
    if (existing) {
      update("rentPayments", existing.id, {
        amountReceived: amount,
        isPaid: amount >= totalDue,
        paidDate: amount > 0 ? new Date().toISOString() : undefined,
        note,
      });
    } else {
      create("rentPayments", {
        tenantId: paymentTenant.id, month, year,
        isPaid: amount >= totalDue,
        paidDate: amount > 0 ? new Date().toISOString() : undefined,
        amountDue: totalDue, amountReceived: amount,
        carryOver: Math.max(totalDue - paymentTenant.monthlyRent, 0), note,
      });
    }
    setPaymentTenant(undefined);
    showToast({ title: "Paiement enregistré", detail: `${paymentTenant.name} · ${eur.format(amount)}`, tone: "success" });
  };

  const resetPayment = () => {
    if (!paymentTenant) return;
    data.rentPayments
      .filter((payment) => payment.tenantId === paymentTenant.id && payment.month === month && payment.year === year)
      .forEach((payment) => remove("rentPayments", payment.id));
    setAmount(0);
    setNote("");
  };

  const saveDebt = () => {
    if (!debtTenant || !debtLabel.trim() || debtAmount <= 0) return;
    create("tenantDebts", {
      tenantId: debtTenant.id, label: debtLabel, amount: debtAmount,
      month, year, isPaid: false, createdAt: new Date().toISOString(),
    });
    setDebtTenant(undefined);
    showToast({ title: "Dette ajoutée", detail: debtTenant.name, tone: "success" });
  };

  useEffect(() => {
    if (!ready || actionHandled.current) return;
    const timer = window.setTimeout(() => { actionHandled.current = true; if (new URLSearchParams(window.location.search).get("action") === "payment") setQuickPayment(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!ready) return <main className="page v2-page v2"><V2Skeleton height={70} /><V2Skeleton height={120} /><V2Skeleton height={200} /></main>;

  return (
    <>
    <main className="page v2-page v2">
      <header className="v2-greet">
        <div>
          <h1>Gestion des loyers</h1>
          <p>Suivi des paiements et dettes</p>
        </div>
        <button className="fab" aria-label="Ajouter un locataire" onClick={() => openTenant()}><Plus /></button>
      </header>

      <section className="v2-card v2-card-tight">
        <div className="spread">
          <button className="icon-button" aria-label="Mois précédent" onClick={() => setCursor(new Date(year, cursor.getMonth() - 1, 1))}><ChevronLeft /></button>
          <strong>{monthLabel(cursor)}</strong>
          <button className="icon-button" aria-label="Mois suivant" onClick={() => setCursor(new Date(year, cursor.getMonth() + 1, 1))}><ChevronRight /></button>
        </div>
      </section>

      <section className="rent-overview">
        <div>
          <strong>{data.tenants.length}</strong><span>Locataires</span>
        </div>
        <div>
          <strong className="positive">{data.tenants.filter((tenant) => due(tenant) - received(tenant) <= 0).length}</strong><span>Payés</span>
        </div>
        <div>
          <strong className="positive">{eur.format(totals.paid)}</strong><span>Perçu</span>
        </div>
        <div><strong className={totals.unpaid ? "negative" : ""}>{eur.format(totals.unpaid)}</strong><span>En attente</span></div>
      </section>

      <section className="collection-card"><div className="spread"><div><strong>Collecte du mois</strong><span>{totals.expected ? `${Math.round(totals.paid / totals.expected * 100)} % encaissé` : "Aucun loyer attendu"}</span></div><strong>{eur.format(totals.expected)}</strong></div><div className="collection-track"><i style={{ width: `${totals.expected ? Math.min(totals.paid / totals.expected * 100, 100) : 0}%` }} /></div></section>

      {data.tenants.length === 0 ? (
        <V2Empty
          icon={Building2}
          title="Aucun locataire pour le moment 🏠"
          text="Ajoutez un locataire pour suivre ses loyers, ses versements partiels et ses reports de dette."
          action={<button className="button button-primary" onClick={() => openTenant()}>Ajouter un locataire</button>}
        />
      ) : null}

      {data.tenants.map((tenant) => {
        const total = due(tenant);
        const paid = received(tenant);
        const remaining = Math.max(total - paid, 0);
        const carry = Math.max(total - tenant.monthlyRent, 0);
        const status = remaining <= 0 ? "Payé" : paid > 0 ? "Partiel" : "En attente";
        const statusColor = remaining <= 0 ? "var(--v2-positive)" : paid > 0 ? "#f59e0b" : "var(--v2-negative)";
        const debts = data.tenantDebts.filter((debt) => debt.tenantId === tenant.id && !debt.isPaid && debt.month === month && debt.year === year);

        return (
          <section className="tenant-card" key={tenant.id}>
            <div className="spread">
              <div className="row" style={{ minWidth: 0 }}>
                <V2Avatar name={tenant.name} />
                <div className="list-main">
                  <strong>{tenant.name}</strong>
                  <div className="muted small">Échéance le {tenant.dueDay}</div>
                </div>
              </div>
              <div className="row">
                <span style={{
                  padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 750,
                  color: statusColor, background: `color-mix(in srgb, ${statusColor} 12%, white)`,
                }}>{status}</span>
                <RowMenu onEdit={() => openTenant(tenant)} onDelete={() => setPendingDelete(tenant)} />
              </div>
            </div>

            <div className="tenant-finances">
              <div className="spread"><span className="muted small">Loyer</span><strong>{eur.format(tenant.monthlyRent)}</strong></div>
              {carry > 0 ? (
                <div className="spread" style={{ marginTop: 8 }}>
                  <span className="muted small">Report + dettes</span><strong className="orange">{eur.format(carry)}</strong>
                </div>
              ) : null}
              <div className="spread" style={{ marginTop: 8 }}><span className="muted small">Total dû</span><strong>{eur.format(total)}</strong></div>
              <div className="spread" style={{ marginTop: 8 }}><span className="muted small">Reçu</span><strong className="positive">{eur.format(paid)}</strong></div>
              <div className="spread" style={{ marginTop: 8, borderTop: "1px solid var(--v2-line)", paddingTop: 8 }}>
                <strong>Reste</strong>
                <strong className={remaining > 0 ? "negative" : "positive"}>{eur.format(remaining)}</strong>
              </div>
            </div>

            {debts.map((debt) => (
              <button className="v2-row" key={debt.id} onClick={() => update("tenantDebts", debt.id, { isPaid: true })}>
                <CircleAlert className="negative" size={18} />
                <span className="v2-row-main"><strong>{debt.label}</strong><span>Toucher pour solder</span></span>
                <span className="v2-row-value negative">{eur.format(debt.amount)}</span>
              </button>
            ))}

            <div className="grid-2" style={{ marginTop: 12 }}>
              <button className="button button-primary" onClick={() => { setPaymentTenant(tenant); setAmount(paid); setNote(""); }}>
                <Banknote size={17} /> Paiement
              </button>
              <button className="button button-soft" onClick={() => { setDebtTenant(tenant); setDebtLabel(""); setDebtAmount(0); }}>
                <CircleAlert size={17} /> Dette
              </button>
            </div>
          </section>
        );
      })}

      <Sheet
        open={tenantOpen} title={editing ? "Modifier le locataire" : "Ajouter un locataire"}
        submitLabel={editing ? "Enregistrer" : "Ajouter"}
        disableSubmit={!tenantDraft.name.trim() || tenantDraft.monthlyRent <= 0}
        onClose={() => setTenantOpen(false)} onSubmit={saveTenant}
      >
        <div className="form-grid">
          <Field label="Nom"><input className="input" value={tenantDraft.name} onChange={(event) => setTenantDraft({ ...tenantDraft, name: event.target.value })} /></Field>
          <Field label="Loyer mensuel"><input className="input" type="number" inputMode="decimal" value={tenantDraft.monthlyRent || ""} onChange={(event) => setTenantDraft({ ...tenantDraft, monthlyRent: Number(event.target.value) })} /></Field>
          <Field label="Jour d'échéance"><input className="input" type="number" min="1" max="31" value={tenantDraft.dueDay} onChange={(event) => setTenantDraft({ ...tenantDraft, dueDay: Number(event.target.value) })} /></Field>
          <Field label="Note"><textarea className="textarea" value={tenantDraft.note} onChange={(event) => setTenantDraft({ ...tenantDraft, note: event.target.value })} /></Field>
        </div>
      </Sheet>
      <Sheet open={quickPayment} title="Choisir un locataire" onClose={() => setQuickPayment(false)}><div className="dense-picker">{data.tenants.map((tenant) => <button className="v2-row" key={tenant.id} onClick={() => { setQuickPayment(false); setPaymentTenant(tenant); setAmount(received(tenant)); setNote(""); }}><V2Avatar name={tenant.name} /><span className="v2-row-main"><strong>{tenant.name}</strong><span>{eur.format(Math.max(due(tenant) - received(tenant), 0))} restant</span></span><Banknote size={18} className="accent" /></button>)}</div></Sheet>

      <Sheet
        open={Boolean(paymentTenant)} title="Enregistrer un paiement" submitLabel="Enregistrer"
        disableSubmit={amount < 0} onClose={() => setPaymentTenant(undefined)} onSubmit={savePayment}
      >
        <div className="form-grid">
          {paymentTenant ? (
            <div className="v2-card v2-card-tight spread">
              <div><strong>{monthLabel(cursor)}</strong><div className="muted small">{paymentTenant.name}</div></div>
              <div style={{ textAlign: "right" }}>
                <span className="muted small">Total dû</span>
                <strong className="amount" style={{ display: "block", fontSize: 24 }}>{eur.format(due(paymentTenant))}</strong>
              </div>
            </div>
          ) : null}
          <Field label="Montant du versement">
            <input className="input" style={{ fontSize: 28, fontWeight: 800 }} type="number" inputMode="decimal" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} />
          </Field>
          {paymentTenant ? (
            <div className="segmented">
              <button onClick={() => setAmount(due(paymentTenant))}>Tout</button>
              <button onClick={() => setAmount(due(paymentTenant) * .75)}>3/4</button>
              <button onClick={() => setAmount(due(paymentTenant) * .5)}>1/2</button>
              <button onClick={() => setAmount(due(paymentTenant) * .25)}>1/4</button>
            </div>
          ) : null}
          <Field label="Note"><input className="input" placeholder="Virement, espèces, chèque…" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <button className="button button-danger" onClick={resetPayment}><RotateCcw size={17} /> Remettre le paiement à 0</button>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(debtTenant)} title="Ajouter une dette" submitLabel="Ajouter"
        disableSubmit={!debtLabel.trim() || debtAmount <= 0} onClose={() => setDebtTenant(undefined)} onSubmit={saveDebt}
      >
        <div className="form-grid">
          <div className="v2-banner">Cette dette s&apos;ajoute au total dû du mois et se reporte tant qu&apos;elle n&apos;est pas soldée.</div>
          <Field label="Type de dette">
            <select className="select" value={debtLabel} onChange={(event) => setDebtLabel(event.target.value)}>
              <option value="">Choisir…</option>
              <option>Retard de loyer</option><option>Charges</option><option>Réparation</option><option>Autre dette</option>
            </select>
          </Field>
          <Field label="Montant"><input className="input" type="number" inputMode="decimal" value={debtAmount || ""} onChange={(event) => setDebtAmount(Number(event.target.value))} /></Field>
        </div>
      </Sheet>
    </main>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Supprimer ce locataire ?" detail={`Le profil de ${pendingDelete?.name ?? "ce locataire"} sera supprimé. Les données de paiement liées peuvent être concernées.`} onCancel={() => setPendingDelete(undefined)} onConfirm={() => { if (pendingDelete) { remove("tenants", pendingDelete.id); showToast({ title: "Locataire supprimé", tone: "success" }); } setPendingDelete(undefined); }} />
    </>
  );
}
