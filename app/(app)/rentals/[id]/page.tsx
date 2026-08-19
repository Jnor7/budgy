"use client";

import { ArrowLeft, Banknote, Check, ChevronLeft, ChevronRight, CircleAlert, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RentDebtSheet } from "@/components/rent-debt-sheet";
import { RentPaymentSheet } from "@/components/rent-payment-sheet";
import { V2Avatar, V2Empty, V2Skeleton } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { isRentMonthActionable, rentYearRows, rentYearSummary, type RentMonthStatus } from "@/lib/domain/rent-history";
import { eur } from "@/lib/format";

const MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const STATUS_LABELS: Record<RentMonthStatus, string> = {
  paid: "Soldé",
  partial: "Versement partiel",
  overdue: "En retard",
  upcoming: "À enregistrer",
  inactive: "Avant location",
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready } = useBudgyData();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [paymentMonth, setPaymentMonth] = useState<number>();
  const [debtMonth, setDebtMonth] = useState<number>();
  const tenant = data.tenants.find((item) => item.id === id);
  const rows = useMemo(
    () => tenant ? rentYearRows(tenant, data.rentPayments, data.tenantDebts, year, now) : [],
    [data.rentPayments, data.tenantDebts, now, tenant, year],
  );
  const summary = useMemo(() => rentYearSummary(rows, year, now), [now, rows, year]);

  if (!ready) return <main className="page tenant-detail-page"><V2Skeleton height={52} /><V2Skeleton height={170} /><V2Skeleton height={500} /></main>;
  if (!tenant) return <main className="page tenant-detail-page"><V2Empty icon={CircleAlert} title="Locataire introuvable" text="Ce profil n’existe plus ou n’est pas disponible." action={<Link className="button button-primary" href="/rentals">Retour aux loyers</Link>} /></main>;

  const currentMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const actionMonth = [...rows].reverse().find((row) => isRentMonthActionable(row, now))?.month ?? currentMonth;

  return <>
    <main className="page tenant-detail-page">
      <header className="tenant-detail-nav"><Link href="/rentals"><ArrowLeft size={18} /><span>Loyers</span></Link><strong>Détail locataire</strong><span aria-hidden="true" /></header>

      <section className="tenant-year-card">
        <header><V2Avatar name={tenant.name} large /><span><strong>{tenant.name}</strong><small>Loyer de base · {eur.format(tenant.monthlyRent)}/mois</small></span></header>
        <div className="tenant-year-kpis"><span><strong>{summary.settledMonths}/12</strong><small>Soldés {year}</small></span><span><strong>{eur.format(summary.received)}</strong><small>Reçu</small></span><span><strong>{eur.format(summary.remaining)}</strong><small>Restant dû</small></span></div>
      </section>

      <section className="tenant-year-control" aria-label="Année des paiements"><button aria-label="Année précédente" onClick={() => setYear((value) => value - 1)}><ChevronLeft /></button><strong key={year}>{year}</strong><button aria-label="Année suivante" onClick={() => setYear((value) => value + 1)}><ChevronRight /></button></section>

      {summary.hasLatePayment ? <section className="rent-late-alert"><span><CircleAlert size={19} /></span><div><strong>Retard de paiement</strong><small>{eur.format(summary.remaining)} restant{summary.remaining > 1 ? "s" : ""} à percevoir sur {year}</small></div><div><button aria-label="Enregistrer un paiement" onClick={() => setPaymentMonth(actionMonth)}><Banknote size={16} /></button><button aria-label="Ajouter une dette" onClick={() => setDebtMonth(actionMonth)}><Plus size={17} /></button></div></section> : null}

      <section className="rent-year-history">
        <header><span><h2>Paiements {year}</h2><small>{summary.settledMonths} mois soldé{summary.settledMonths > 1 ? "s" : ""}</small></span><button onClick={() => setDebtMonth(actionMonth)}><Plus size={15} /> Ajouter dette</button></header>
        {rows.map((row) => {
          const isCurrent = year === now.getFullYear() && row.month === now.getMonth() + 1;
          const extra = row.carryOver + row.debts;
          const displayedAmount = row.status === "inactive" ? "—" : eur.format(row.received > 0 ? row.received : row.due);
          return <article className={`rent-month-row status-${row.status}`} key={row.month}>
            <span className="rent-month-status">{row.status === "paid" ? <Check size={14} /> : row.status === "partial" ? <Minus size={14} /> : <span />}</span>
            <div className="rent-month-main"><div><strong>{MONTH_FORMAT.format(new Date(year, row.month - 1, 1))}</strong>{isCurrent ? <em>CE MOIS</em> : null}<b>{displayedAmount}</b></div><small>{STATUS_LABELS[row.status]}</small>{extra > 0 ? <small>{eur.format(tenant.monthlyRent)} + {eur.format(extra)} report/dette</small> : null}{row.remaining > 0 && row.status !== "upcoming" && row.status !== "inactive" ? <small className="rent-month-remaining">Reste {eur.format(row.remaining)}</small> : null}
              {row.status !== "inactive" && row.status !== "paid" ? <div className="rent-month-track"><i style={{ width: `${row.progress * 100}%` }} /></div> : null}
            </div>
            {isRentMonthActionable(row, now) ? <button className="rent-month-action" onClick={() => setPaymentMonth(row.month)}>Enregistrer <ChevronRight size={14} /></button> : null}
          </article>;
        })}
      </section>
    </main>

    <RentPaymentSheet tenant={paymentMonth ? tenant : undefined} year={year} month={paymentMonth ?? actionMonth} onClose={() => setPaymentMonth(undefined)} />
    <RentDebtSheet tenant={debtMonth ? tenant : undefined} year={year} initialMonth={debtMonth ?? actionMonth} onClose={() => setDebtMonth(undefined)} />
  </>;
}
