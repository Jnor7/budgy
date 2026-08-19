"use client";

import {
  BriefcaseBusiness, Building2, ChevronRight,
  Plane, RefreshCcw, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { NotificationCenter } from "@/components/notification-center";
import { QuickActions } from "@/components/quick-actions";
import { V2Donut, V2Empty, V2Skeleton, categoryColor } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { budgetSummary, entriesForMonth, expenseBreakdown, monthSpent } from "@/lib/domain/budget";
import { totalDueForMonth } from "@/lib/domain/tenants";
import { visibleTrips } from "@/lib/domain/permissions";
import { tripTotals } from "@/lib/domain/trips";
import { eur, fullDate, monthLabel } from "@/lib/format";

const greeting = (hour: number) => (hour < 6 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir");

export default function HomePage() {
  const { data, ready, isModuleOn, modules, profile, userId } = useBudgyData();
  const today = useMemo(() => new Date(), []);

  const monthEntries = useMemo(() => entriesForMonth(data.budgetEntries, today), [data.budgetEntries, today]);
  const summary = useMemo(() => budgetSummary(monthEntries), [monthEntries]);
  const breakdown = useMemo(() => expenseBreakdown(monthEntries).slice(0, 4), [monthEntries]);
  const spent = useMemo(() => monthSpent(monthEntries), [monthEntries]);

  const trips = useMemo(
    () => visibleTrips(data.trips, data.tripMembers, userId).filter((trip) => !trip.isCompleted),
    [data.tripMembers, data.trips, userId],
  );
  const nextTrip = useMemo(
    () => [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate))[0],
    [trips],
  );

  const rentExpected = useMemo(
    () => data.tenants.reduce(
      (sum, tenant) => sum + totalDueForMonth(tenant, data.rentPayments, data.tenantDebts, today.getFullYear(), today.getMonth() + 1),
      0,
    ),
    [data.rentPayments, data.tenantDebts, data.tenants, today],
  );
  const rentReceived = useMemo(
    () => data.rentPayments
      .filter((payment) => payment.month === today.getMonth() + 1 && payment.year === today.getFullYear())
      .reduce((sum, payment) => sum + payment.amountReceived, 0),
    [data.rentPayments, today],
  );

  const businessRevenue = data.businessTransactions.filter((item) => item.type === "revenu").reduce((sum, item) => sum + item.amount, 0);
  const businessExpenses = data.businessTransactions.filter((item) => item.type === "depense").reduce((sum, item) => sum + item.amount, 0);
  const activeSubscriptions = data.subscriptions.filter((item) => item.isActive);
  const subscriptionsTotal = activeSubscriptions.reduce((sum, item) => sum + item.amount, 0);

  if (!ready) {
    return (
      <main className="page v2-page v2">
        <V2Skeleton height={70} />
        <V2Skeleton height={165} />
        <V2Skeleton height={150} />
      </main>
    );
  }

  const nextTripTotal = nextTrip
    ? tripTotals(
        data.flights.filter((item) => item.tripId === nextTrip.id),
        data.accommodations.filter((item) => item.tripId === nextTrip.id),
        data.tripActivities.filter((item) => item.tripId === nextTrip.id),
      ).totalBudget
    : 0;

  return (
    <main className="page v2-page v2">
      <header className="v2-greet">
        <div>
          <h1>{greeting(today.getHours())} {profile?.username ?? "👋"}</h1>
          <p>Voici un résumé de votre situation.</p>
        </div>
        <NotificationCenter />
      </header>

      {modules.length === 0 ? (
        <V2Empty
          icon={Sparkles}
          title="Votre espace est prêt à être configuré"
          text="Choisissez les fonctions qui correspondent à votre vie : budget, abonnements, loyers, business ou voyages."
          action={<Link className="button button-primary" href="/onboarding">Configurer Budgy</Link>}
        />
      ) : null}

      {isModuleOn("budget") ? (
        <>
          <section className="v2-hero">
            <span className="v2-hero-label">Solde total</span>
            <strong className="v2-hero-amount">{eur.format(summary.confirmedBalance)}</strong>
            <div className="v2-hero-split">
              <div>
                <span>↗ Revenus</span>
                <strong>{eur.format(summary.confirmedIncome)}</strong>
              </div>
              <div>
                <span>↘ Dépenses</span>
                <strong>{eur.format(summary.confirmedExpenses)}</strong>
              </div>
              <div>
                <span>↗ Potentiel</span>
                <strong>{eur.format(summary.projectedBalance)}</strong>
              </div>
            </div>
          </section>

          <section className="v2-card">
            <div className="v2-card-head">
              <div>
                <h2>Budget du mois</h2>
                <span className="muted small">{monthLabel(today)}</span>
              </div>
              <Link className="v2-link" href="/budget">Détail</Link>
            </div>
            {spent === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Aucune dépense enregistrée ce mois. Ajoutez-en une depuis l&apos;onglet Budget.
              </p>
            ) : (
              <div className="v2-donut-wrap">
                <V2Donut
                  slices={breakdown}
                  centerValue={eur.format(spent)}
                  centerLabel="dépensés"
                  size={98}
                  thickness={14}
                />
                <div className="v2-legend">
                  {breakdown.map((slice, index) => (
                    <div className="v2-legend-item" key={slice.label}>
                      <span className="v2-legend-dot" style={{ background: categoryColor(slice.label, index) }} />
                      <span className="v2-legend-label">{slice.label}</span>
                      <span className="v2-legend-values">
                        <b>{Math.round(slice.share * 100)}%</b>
                        <span>{eur.format(slice.amount)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

      <QuickActions />

      <section className="v2-card">
        <div className="v2-card-head"><h2>Aperçu rapide</h2></div>

        {isModuleOn("rentals") ? (
          <Link className="v2-row" href="/rentals">
            <span className="v2-tile-icon" style={{ background: "#e4f6fe", color: "#0ea5e9" }}><Building2 size={19} /></span>
            <span className="v2-row-main">
              <strong>Loyers</strong>
              <span>{data.tenants.length} locataire(s) · {eur.format(Math.max(rentExpected - rentReceived, 0))} restant</span>
            </span>
            <span className="v2-row-value">{eur.format(rentExpected)}</span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ) : null}

        {isModuleOn("businesses") ? (
          <Link className="v2-row" href="/business">
            <span className="v2-tile-icon" style={{ background: "#fff2de", color: "#f59e0b" }}><BriefcaseBusiness size={19} /></span>
            <span className="v2-row-main">
              <strong>Business</strong>
              <span>{data.businesses.length} activité(s) · marge {eur.format(businessRevenue - businessExpenses)}</span>
            </span>
            <span className="v2-row-value">{eur.format(businessRevenue)}</span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ) : null}

        {isModuleOn("trips") ? (
          <Link className="v2-row" href="/trips">
            <span className="v2-tile-icon" style={{ background: "#e4f6fe", color: "#0ea5e9" }}><Plane size={19} /></span>
            <span className="v2-row-main">
              <strong>Voyages</strong>
              <span>{nextTrip ? `${nextTrip.title} · ${fullDate(nextTrip.startDate)}` : "Aucun voyage à venir"}</span>
            </span>
            {nextTrip ? <span className="v2-row-value">{eur.format(nextTripTotal)}</span> : null}
            <ChevronRight size={18} className="muted" />
          </Link>
        ) : null}

        {isModuleOn("subscriptions") ? (
          <Link className="v2-row" href="/subscriptions">
            <span className="v2-tile-icon" style={{ background: "#e3f9ec", color: "var(--v2-positive)" }}><RefreshCcw size={19} /></span>
            <span className="v2-row-main">
              <strong>Abonnements</strong>
              <span>{activeSubscriptions.length} actif(s)</span>
            </span>
            <span className="v2-row-value">{eur.format(subscriptionsTotal)} / mois</span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ) : null}
      </section>
    </main>
  );
}
