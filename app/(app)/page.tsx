"use client";

import { ArrowUpRight, BellRing, BriefcaseBusiness, Building2, CalendarDays, CircleDollarSign, FileArchive, Lightbulb, Plane, ReceiptText, Settings, TrendingUp, WalletCards } from "lucide-react";
import Link from "next/link";
import { BubbleHeader, Card, MetricCard } from "@/components/ui/card";
import { useBudgyData } from "@/lib/data/data-provider";
import { budgetSummary, entriesForMonth, isConfirmed } from "@/lib/domain/budget";
import { tripTotals } from "@/lib/domain/trips";
import { eur, shortDate } from "@/lib/format";

export default function HomePage() {
  const { data, ready } = useBudgyData();
  if (!ready) return <main className="page stack"><div className="skeleton" style={{height:150}}/><div className="grid-2"><div className="skeleton"/><div className="skeleton"/></div></main>;
  const monthEntries = entriesForMonth(data.budgetEntries, new Date());
  const summary = budgetSummary(monthEntries);
  const activeTrips = data.trips.filter((trip) => !trip.isCompleted);
  const openTasks = data.businessTasks.filter((task) => !task.isDone).length;
  const recent = [...monthEntries].filter(isConfirmed).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  const nextTrip = activeTrips.sort((a,b)=>a.startDate.localeCompare(b.startDate))[0];
  const nextTripTotal = nextTrip ? tripTotals(data.flights.filter((x)=>x.tripId===nextTrip.id), data.accommodations.filter((x)=>x.tripId===nextTrip.id), data.tripActivities.filter((x)=>x.tripId===nextTrip.id)).totalBudget : 0;
  return <main className="page page-narrow stack">
    <BubbleHeader title="Aujourd’hui" subtitle="Votre quotidien, en un coup d’œil" />
    <div className="grid-2">
      <MetricCard icon={WalletCards} label="Solde réalisé" value={eur.format(summary.confirmedBalance)} detail="Ce mois" tone={summary.confirmedBalance >= 0 ? "green" : "orange"}/>
      <MetricCard icon={TrendingUp} label="Solde potentiel" value={eur.format(summary.projectedBalance)} detail="Réalisé + à venir" tone="purple"/>
    </div>
    <Card><div className="spread"><h2 className="section-title">Actions rapides</h2><span className="eyebrow">Budgy</span></div><div className="grid-2">
      <Link href="/budget" className="card-flat row"><span className="icon-tile icon-purple"><CircleDollarSign size={20}/></span><strong>Transaction</strong></Link>
      <Link href="/trips" className="card-flat row"><span className="icon-tile icon-cyan"><Plane size={20}/></span><strong>Voyage</strong></Link>
      <Link href="/business/tenants" className="card-flat row"><span className="icon-tile icon-purple"><Building2 size={20}/></span><strong>Loyer</strong></Link>
      <Link href="/business" className="card-flat row"><span className="icon-tile icon-green"><BriefcaseBusiness size={20}/></span><strong>Business</strong></Link>
      <Link href="/subscriptions" className="card-flat row"><span className="icon-tile icon-orange"><BellRing size={20}/></span><strong>Abonnements</strong></Link>
    </div></Card>
    <Card><div className="spread"><h2 className="section-title">Activité récente</h2><Link className="accent small" href="/budget">Voir tout</Link></div>
      {recent.length === 0 ? <p className="muted">Aucune transaction confirmée ce mois.</p> : recent.map((entry)=><div className="list-row" key={entry.id}><span className={`icon-tile ${entry.type === "revenu" ? "icon-green" : "icon-orange"}`}><ReceiptText size={18}/></span><div className="list-main"><strong>{entry.title}</strong><span className="muted small">{entry.category} · {shortDate(entry.date)}</span></div><strong className={entry.type === "revenu" ? "positive" : "negative"}>{entry.type === "revenu" ? "+" : "−"}{eur.format(entry.amount)}</strong></div>)}
    </Card>
    <div className="bubble-header" style={{padding:18,textAlign:"left"}}><div className="row"><span className="icon-tile icon-purple"><Lightbulb size={20}/></span><div><h2 className="section-title" style={{margin:0}}>Insights</h2><p className="muted small" style={{marginTop:4}}>{summary.pendingExpenses > 0 ? `${eur.format(summary.pendingExpenses)} de dépenses sont encore à venir.` : "Toutes vos dépenses du mois sont à jour."}</p></div></div></div>
    <Card><h2 className="section-title">Vue globale</h2><div className="stack-sm">
      <Link className="list-row" href="/business"><span className="icon-tile icon-purple"><BriefcaseBusiness size={20}/></span><div className="list-main"><strong>Business</strong><span className="muted small">{data.businesses.length} activité(s) · {openTasks} tâche(s)</span></div><ArrowUpRight size={18}/></Link>
      <Link className="list-row" href="/business/tenants"><span className="icon-tile icon-purple"><Building2 size={20}/></span><div className="list-main"><strong>Gestion des loyers</strong><span className="muted small">{data.tenants.length} locataire(s)</span></div><ArrowUpRight size={18}/></Link>
      <Link className="list-row" href="/trips"><span className="icon-tile icon-cyan"><CalendarDays size={20}/></span><div className="list-main"><strong>{nextTrip?.title ?? "Voyages"}</strong><span className="muted small">{nextTrip ? `${shortDate(nextTrip.startDate)} · ${eur.format(nextTripTotal)}` : "Aucun voyage à venir"}</span></div><ArrowUpRight size={18}/></Link>
      <Link className="list-row" href="/subscriptions"><span className="icon-tile icon-orange"><BellRing size={20}/></span><div className="list-main"><strong>Abonnements</strong><span className="muted small">{data.subscriptions.filter((item)=>item.isActive).length} actif(s)</span></div><ArrowUpRight size={18}/></Link>
      <Link className="list-row" href="/settings/migration"><span className="icon-tile icon-purple"><FileArchive size={20}/></span><div className="list-main"><strong>Migration Budget JR</strong><span className="muted small">Importer une archive ZIP</span></div><ArrowUpRight size={18}/></Link>
      <Link className="list-row" href="/settings"><span className="icon-tile icon-purple"><Settings size={20}/></span><div className="list-main"><strong>Compte & données</strong><span className="muted small">Session, synchronisation et onboarding</span></div><ArrowUpRight size={18}/></Link>
    </div></Card>
  </main>;
}
