"use client";

import { ArrowLeft, Banknote, Building2, ChevronLeft, ChevronRight, CircleAlert, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RentDebtSheet } from "@/components/rent-debt-sheet";
import { RentPaymentSheet } from "@/components/rent-payment-sheet";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { RowMenu } from "@/components/ui/menu";
import { Field, FormModal, FormRow, Sheet } from "@/components/ui/modal";
import { V2Avatar, V2Empty, V2Skeleton } from "@/components/ui/v2";
import { AmountField } from "@/components/ui/premium";
import { useBudgyData } from "@/lib/data/data-provider";
import { totalDueForMonth } from "@/lib/domain/tenants";
import { eur, monthLabel } from "@/lib/format";
import type { Tenant } from "@/types/domain";

type TenantDraft = { name: string; monthlyRent: number; dueDay: number; note: string };
const blankTenant: TenantDraft = { name: "", monthlyRent: 0, dueDay: 5, note: "" };
const monthKey = (year: number, month: number) => year * 12 + month - 1;

export default function RentalsPage() {
  const { data, ready, create, update, remove } = useBudgyData();
  const router = useRouter();
  const { showToast } = useToast();
  const [cursor, setCursor] = useState(() => new Date());
  const [tenantOpen, setTenantOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [tenantDraft, setTenantDraft] = useState<TenantDraft>(blankTenant);
  const [paymentTenant, setPaymentTenant] = useState<Tenant>();
  const [debtTenant, setDebtTenant] = useState<Tenant>();
  const [pendingDelete, setPendingDelete] = useState<Tenant>();
  const [quickPayment, setQuickPayment] = useState(false);
  const actionHandled = useRef(false);
  const month = cursor.getMonth() + 1;
  const year = cursor.getFullYear();
  const [now] = useState(() => new Date());

  const due = (tenant: Tenant) => totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, year, month);
  const received = (tenant: Tenant) => data.rentPayments
    .filter((payment) => payment.tenantId === tenant.id && payment.month === month && payment.year === year)
    .reduce((sum, payment) => sum + payment.amountReceived, 0);

  const expected = data.tenants.reduce((sum, tenant) => sum + totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, year, month), 0);
  const paid = data.rentPayments.filter((payment) => payment.month === month && payment.year === year).reduce((sum, payment) => sum + payment.amountReceived, 0);
  const paidTenants = data.tenants.filter((tenant) => {
    const total = totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, year, month);
    const receivedTotal = data.rentPayments.filter((payment) => payment.tenantId === tenant.id && payment.month === month && payment.year === year).reduce((sum, payment) => sum + payment.amountReceived, 0);
    return total > 0 && receivedTotal >= total;
  }).length;
  const totals = { expected, paid, paidTenants, remaining: Math.max(expected - paid, 0), progress: expected ? Math.min(paid / expected * 100, 100) : 0 };

  const openTenant = (tenant?: Tenant) => {
    setEditing(tenant?.id);
    setTenantDraft(tenant ? { name: tenant.name, monthlyRent: tenant.monthlyRent, dueDay: tenant.dueDay, note: tenant.note } : blankTenant);
    setTenantOpen(true);
  };
  const saveTenant = () => {
    if (!tenantDraft.name.trim() || tenantDraft.monthlyRent <= 0) return;
    if (editing) update("tenants", editing, tenantDraft);
    else create("tenants", { ...tenantDraft, createdAt: new Date().toISOString() });
    setTenantOpen(false);
    showToast({ title: editing ? "Locataire modifié" : "Locataire ajouté", tone: "success" });
  };

  useEffect(() => {
    if (!ready || actionHandled.current) return;
    const timer = window.setTimeout(() => {
      actionHandled.current = true;
      if (new URLSearchParams(window.location.search).get("action") === "payment") setQuickPayment(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!ready) return <main className="page v2-page v2"><V2Skeleton height={58} /><V2Skeleton height={170} /><V2Skeleton height={230} /></main>;

  return <>
    <main className="page v2-page v2 rentals-page">
      <header className="rentals-context-bar">
        <Link href="/business" aria-label="Retour à Business"><ArrowLeft size={19} /><span>Business</span></Link>
        <div className="rentals-month-control">
          <button aria-label="Mois précédent" onClick={() => setCursor(new Date(year, cursor.getMonth() - 1, 1))}><ChevronLeft /></button>
          <strong key={cursor.toISOString()}>{monthLabel(cursor)}</strong>
          <button aria-label="Mois suivant" onClick={() => setCursor(new Date(year, cursor.getMonth() + 1, 1))}><ChevronRight /></button>
        </div>
      </header>

      <section className="rent-collection-premium">
        <header><span><strong>Collecte du mois</strong><small>{monthLabel(cursor)}</small></span><em>{Math.round(totals.progress)}% encaissé</em></header>
        <div className="rent-collection-amounts"><span><small>Attendus</small><strong>{eur.format(totals.expected)}</strong></span><span><small>Encaissés</small><strong>{eur.format(totals.paid)}</strong></span></div>
        <div className="rent-collection-track"><i style={{ width: `${totals.progress}%` }} /></div>
        <footer><span><strong>{data.tenants.length}</strong> locataire{data.tenants.length > 1 ? "s" : ""}</span><span><strong>{totals.paidTenants}</strong> payé{totals.paidTenants > 1 ? "s" : ""}</span><span><strong>{eur.format(totals.remaining)}</strong> restant</span></footer>
      </section>

      <button className="add-tenant-cta" onClick={() => openTenant()}><span><Plus size={18} /></span><span><strong>Ajouter un locataire</strong><small>Créer son échéance et son loyer mensuel</small></span></button>

      {data.tenants.length === 0 ? <V2Empty icon={Building2} title="Aucun locataire pour le moment 🏠" text="Ajoutez un locataire pour suivre ses loyers, versements partiels et reports." action={<button className="button button-primary" onClick={() => openTenant()}>Ajouter un locataire</button>} /> : null}

      <div className="tenant-card-list">
        {data.tenants.map((tenant) => {
          const total = due(tenant);
          const paid = received(tenant);
          const remaining = Math.max(total - paid, 0);
          const carry = Math.max(total - tenant.monthlyRent, 0);
          const late = remaining > 0 && (monthKey(year, month) < monthKey(now.getFullYear(), now.getMonth() + 1) || (year === now.getFullYear() && month === now.getMonth() + 1 && now.getDate() > tenant.dueDay));
          const status = remaining <= 0 ? "Payé" : paid > 0 ? "Partiel" : late ? "Retard" : "En attente";
          const statusTone = remaining <= 0 ? "paid" : paid > 0 ? "partial" : late ? "late" : "pending";
          const debts = data.tenantDebts.filter((debt) => debt.tenantId === tenant.id && !debt.isPaid && debt.month === month && debt.year === year);

          return <article className="tenant-premium-card" key={tenant.id} role="link" tabIndex={0} aria-label={`Détail locataire ${tenant.name}`} onClick={() => router.push(`/rentals/${tenant.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/rentals/${tenant.id}`); }}>
            <header><span className="tenant-identity"><V2Avatar name={tenant.name} /><span><strong>{tenant.name}</strong><small>Échéance le {tenant.dueDay}</small></span></span><span className="tenant-card-tools"><em className={`rent-status ${statusTone}`}>{status}</em><span onClick={(event) => event.stopPropagation()}><RowMenu onEdit={() => openTenant(tenant)} onDelete={() => setPendingDelete(tenant)} /></span></span></header>
            <div className="tenant-compact-finances"><span><small>Loyer</small><strong>{eur.format(tenant.monthlyRent)}</strong></span><span><small>Report + dettes</small><strong className={carry ? "orange" : ""}>{eur.format(carry)}</strong></span><span><small>Total dû</small><strong>{eur.format(total)}</strong></span><span><small>Reçu</small><strong className="positive">{eur.format(paid)}</strong></span><span className="tenant-remains"><small>Reste</small><strong className={remaining ? "negative" : "positive"}>{eur.format(remaining)}</strong></span></div>
            {debts.length ? <div className="tenant-debt-note"><CircleAlert size={15} /> {debts.length} dette{debts.length > 1 ? "s" : ""} active{debts.length > 1 ? "s" : ""}</div> : null}
            <div className="tenant-actions" onClick={(event) => event.stopPropagation()}><button className="button button-primary" onClick={() => setPaymentTenant(tenant)}><Banknote size={16} /> Paiement</button><button className="button button-soft" onClick={() => setDebtTenant(tenant)}><CircleAlert size={16} /> Dette</button></div>
          </article>;
        })}
      </div>

      <FormModal open={tenantOpen} title={editing ? "Modifier le locataire" : "Ajouter un locataire"} submitLabel={editing ? "Enregistrer les modifications" : "Ajouter le locataire"} disableSubmit={!tenantDraft.name.trim() || tenantDraft.monthlyRent <= 0} onClose={() => setTenantOpen(false)} onSubmit={saveTenant} icon={Building2} tone="cyan"><div className="form-grid"><Field label="Loyer mensuel"><AmountField size="modal" value={tenantDraft.monthlyRent} onChange={(monthlyRent) => setTenantDraft({ ...tenantDraft, monthlyRent })} autoFocus /></Field><FormRow><Field label="Nom"><input className="input" value={tenantDraft.name} onChange={(event) => setTenantDraft({ ...tenantDraft, name: event.target.value })} /></Field><Field label="Jour d'échéance"><input className="input" type="number" min="1" max="31" value={tenantDraft.dueDay} onChange={(event) => setTenantDraft({ ...tenantDraft, dueDay: Number(event.target.value) })} /></Field></FormRow><Field label="Note"><textarea className="textarea" value={tenantDraft.note} onChange={(event) => setTenantDraft({ ...tenantDraft, note: event.target.value })} /></Field></div></FormModal>
      <Sheet open={quickPayment} title="Choisir un locataire" onClose={() => setQuickPayment(false)}><div className="dense-picker">{data.tenants.map((tenant) => <button className="v2-row" key={tenant.id} onClick={() => { setQuickPayment(false); setPaymentTenant(tenant); }}><V2Avatar name={tenant.name} /><span className="v2-row-main"><strong>{tenant.name}</strong><span>{eur.format(Math.max(due(tenant) - received(tenant), 0))} restant</span></span><Banknote size={18} className="accent" /></button>)}</div></Sheet>
    </main>

    <RentPaymentSheet tenant={paymentTenant} year={year} month={month} onClose={() => setPaymentTenant(undefined)} />
    <RentDebtSheet tenant={debtTenant} year={year} initialMonth={month} onClose={() => setDebtTenant(undefined)} />
    <ConfirmDialog open={Boolean(pendingDelete)} title="Supprimer ce locataire ?" detail={`Le profil de ${pendingDelete?.name ?? "ce locataire"} sera supprimé. Les paiements liés peuvent être concernés.`} onCancel={() => setPendingDelete(undefined)} onConfirm={() => { if (pendingDelete) { remove("tenants", pendingDelete.id); showToast({ title: "Locataire supprimé", tone: "success" }); } setPendingDelete(undefined); }} />
  </>;
}
