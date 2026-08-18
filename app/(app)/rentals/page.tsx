"use client";

import {
  Banknote, Building2, ChevronLeft, ChevronRight, CircleAlert, Plus, RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RowMenu } from "@/components/ui/menu";
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
  };

  if (!ready) return <main className="page v2-page v2"><V2Skeleton height={70} /><V2Skeleton height={120} /><V2Skeleton height={200} /></main>;

  return (
    <main className="page v2-page v2">
      <header className="v2-greet">
        <div>
          <h1>Mes loyers</h1>
          <p>Suivi de vos {data.tenants.length} locataire{data.tenants.length > 1 ? "s" : ""}</p>
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

      <section className="v2-card" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", textAlign: "center", gap: 8 }}>
        <div>
          <strong className="v2-tile-value" style={{ color: "var(--v2-positive)" }}>{eur.format(totals.expected)}</strong>
          <div className="v2-tile-label">À recevoir</div>
        </div>
        <div style={{ borderInline: "1px solid var(--v2-line)" }}>
          <strong className="v2-tile-value" style={{ color: totals.unpaid > 0 ? "var(--v2-negative)" : "var(--v2-muted)" }}>{eur.format(totals.unpaid)}</strong>
          <div className="v2-tile-label">Impayés</div>
        </div>
        <div>
          <strong className="v2-tile-value">{data.tenants.length}</strong>
          <div className="v2-tile-label">Locataires</div>
        </div>
      </section>

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
          <section className="v2-card" key={tenant.id}>
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
                <RowMenu onEdit={() => openTenant(tenant)} onDelete={() => remove("tenants", tenant.id)} />
              </div>
            </div>

            <div className="card-flat" style={{ marginTop: 12 }}>
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
  );
}
