"use client";

import { ArrowLeft, BedDouble, Check, ClipboardCheck, MapPin, Plane, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { TravelCover } from "@/components/travel/travel-cover";
import { TripChecklistPanel } from "@/components/travel/trip-checklist-panel";
import { TripExpensesPanel } from "@/components/travel/trip-expenses-panel";
import { TripItineraryPanel, type ItineraryKind } from "@/components/travel/trip-itinerary-panel";
import { TripMembersPanel } from "@/components/travel/trip-members-panel";
import { V2Avatar, V2Skeleton } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { canManageTripMembers, roleLabel, tripParticipants, tripRole } from "@/lib/domain/permissions";
import { tripExpensesTotal } from "@/lib/domain/trip-expenses";
import { eur, shortDate } from "@/lib/format";
import { buildItinerary } from "@/lib/travel/itinerary";
import { countryCodeToFlag } from "@/lib/travel/destinations";
import { timeLabel, tripCountdown, tripDayCount, tripRangeLabel } from "@/lib/travel/presentation";
import type { Accommodation, Flight, TripActivity, TripChecklistItem } from "@/types/domain";

type Tab = "overview" | "itinerary" | "expenses" | "checklist" | "members";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, ready, userId, displayName, update } = useBudgyData();
  const [tab, setTab] = useState<Tab>("overview");
  const [itineraryRequest, setItineraryRequest] = useState<ItineraryKind>();
  const trip = data.trips.find((item) => item.id === id);
  const flights = useMemo(() => data.flights.filter((item) => item.tripId === id), [data.flights, id]);
  const stays = useMemo(() => data.accommodations.filter((item) => item.tripId === id), [data.accommodations, id]);
  const activities = useMemo(() => data.tripActivities.filter((item) => item.tripId === id), [data.tripActivities, id]);
  const checks = useMemo(() => data.tripChecklistItems.filter((item) => item.tripId === id), [data.tripChecklistItems, id]);
  const expenses = useMemo(() => data.tripExpenses.filter((item) => item.tripId === id), [data.tripExpenses, id]);

  if (!ready) return <main className="page travel-detail"><V2Skeleton height={340} /><V2Skeleton height={120} /></main>;
  if (!trip) return <main className="page travel-detail"><Link className="travel-back-inline" href="/trips"><ArrowLeft size={18} /> Voyages</Link><section className="travel-empty"><span><MapPin size={25} /></span><h2>Voyage introuvable</h2><p>Il a peut-être été supprimé ou vous n’avez plus accès à ce voyage.</p></section></main>;

  const participants = tripParticipants(trip, data.tripMembers);
  const role = tripRole(trip, data.tripMembers, userId);
  const canManage = canManageTripMembers(trip, data.tripMembers, userId);
  const spent = tripExpensesTotal(expenses);
  const completedChecks = checks.filter((item) => item.isDone).length;
  const itinerary = buildItinerary(flights, stays, activities);
  const openItineraryForm = (kind: ItineraryKind) => { setItineraryRequest(kind); setTab("itinerary"); };

  return <main className="page travel-detail">
    <TravelCover imageUrl={trip.coverImageUrl} destination={trip.title} countryCode={trip.countryCode} className="travel-detail-hero" eager>
      <header><Link href="/trips" aria-label="Retour aux voyages"><ArrowLeft size={20} /></Link>{canManage ? <button aria-label={trip.isCompleted ? "Rouvrir le voyage" : "Marquer comme terminé"} onClick={() => update("trips", trip.id, { isCompleted: !trip.isCompleted })}><Check size={19} /></button> : <span>{role ? roleLabel(role) : ""}</span>}</header>
      <div className="travel-detail-title"><span>{tripCountdown(trip.startDate)}</span><h1>{trip.title} <em>{countryCodeToFlag(trip.countryCode)}</em></h1><p>{tripRangeLabel(trip.startDate, trip.endDate)} · {tripDayCount(trip.startDate, trip.endDate)} jours</p><div>{participants.slice(0, 4).map((participant) => <V2Avatar key={participant.userId} name={displayName(participant.userId)} />)}{participants.length > 4 ? <b>+{participants.length - 4}</b> : null}</div></div>
    </TravelCover>
    {trip.coverAttribution ? <small className="travel-attribution detail">{trip.coverAttribution}</small> : null}

    <section className="travel-summary-grid">
      <Summary icon={Plane} label="Vols" value={String(flights.length)} />
      <Summary icon={BedDouble} label="Logements" value={String(stays.length)} />
      <Summary icon={MapPin} label="Activités" value={String(activities.length)} />
      <Summary icon={Wallet} label="Dépensé" value={eur.format(spent)} />
      <Summary icon={ClipboardCheck} label="Checklist" value={`${completedChecks}/${checks.length}`} />
    </section>

    <nav className="travel-inner-tabs" aria-label="Sections du voyage">{(["overview", "itinerary", "expenses", "checklist", "members"] as const).map((value) => <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => { setItineraryRequest(undefined); setTab(value); }}>{value === "overview" ? "Aperçu" : value === "itinerary" ? "Itinéraire" : value === "expenses" ? "Dépenses" : value === "checklist" ? "Checklist" : "Membres"}</button>)}</nav>

    {tab === "overview" ? <TripOverview targetBudget={trip.targetBudget} spent={spent} itinerary={itinerary} flights={flights} stays={stays} activities={activities} checks={checks} participants={participants.map((item) => item.userId)} displayName={displayName} onNavigate={setTab} onCreate={openItineraryForm} /> : null}
    {tab === "itinerary" ? <TripItineraryPanel trip={trip} initialKind={itineraryRequest} onInitialKindConsumed={() => setItineraryRequest(undefined)} /> : null}
    {tab === "expenses" ? <TripExpensesPanel trip={trip} /> : null}
    {tab === "checklist" ? <TripChecklistPanel trip={trip} /> : null}
    {tab === "members" ? <TripMembersPanel trip={trip} /> : null}
  </main>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string }) { return <article><span><Icon size={18} /></span><div><small>{label}</small><b>{value}</b></div></article>; }

function TripOverview({ targetBudget, spent, itinerary, flights, stays, activities, checks, participants, displayName, onNavigate, onCreate }: {
  targetBudget: number; spent: number;
  itinerary: ReturnType<typeof buildItinerary>; flights: Flight[];
  stays: Accommodation[]; activities: TripActivity[];
  checks: TripChecklistItem[]; participants: string[]; displayName: (id: string) => string;
  onNavigate: (tab: Tab) => void;
  onCreate: (kind: ItineraryKind) => void;
}) {
  const nextFlight = flights[0];
  const nextStay = stays[0];
  const nextActivity = activities[0];
  const complete = checks.filter((item) => item.isDone).length;
  const checklistProgress = checks.length ? Math.round((complete / checks.length) * 100) : 0;
  const budgetProgress = targetBudget > 0 ? Math.min((spent / targetBudget) * 100, 100) : 0;
  return <div className="travel-overview-grid">
    <section className="travel-panel travel-overview-lead"><header className="travel-section-head"><div><span className="travel-eyebrow">Prochaine étape</span><h2>{itinerary[0]?.title ?? "Itinéraire à imaginer"}</h2></div><MapPin size={22} /></header>{itinerary[0] ? <p>{itinerary[0].subtitle} · {shortDate(itinerary[0].date)}</p> : <p>Ajoutez votre premier vol, logement ou activité.</p>}<button onClick={() => onNavigate("itinerary")}>Voir l’itinéraire</button></section>
    <button type="button" className="travel-overview-mini" disabled={Boolean(nextFlight)} onClick={() => onCreate("flight")}><span><Plane size={19} /></span><div><small>Prochain vol</small><strong>{nextFlight ? `${nextFlight.fromCode} → ${nextFlight.toCode}` : "Aucun vol"}</strong><p>{nextFlight ? `${nextFlight.airline} ${nextFlight.flightNumber ?? ""} · ${timeLabel(nextFlight.departDate)}` : "Ajoutez vos billets"}</p></div></button>
    <button type="button" className="travel-overview-mini" disabled={Boolean(nextStay)} onClick={() => onCreate("stay")}><span><BedDouble size={19} /></span><div><small>Logement</small><strong>{nextStay?.name ?? "À choisir"}</strong><p>{nextStay ? `${nextStay.city} · ${shortDate(nextStay.startDate)}` : "Ajoutez votre hébergement"}</p></div></button>
    <button type="button" className="travel-overview-mini" disabled={Boolean(nextActivity)} onClick={() => onCreate("activity")}><span><MapPin size={19} /></span><div><small>Prochaine activité</small><strong>{nextActivity?.title ?? "À planifier"}</strong><p>{nextActivity ? `${nextActivity.city} · ${shortDate(nextActivity.activityDate)}` : "Ajoutez une expérience"}</p></div></button>
    <section className="travel-panel travel-overview-progress"><header><span>Budget</span><b>{eur.format(spent)} / {eur.format(targetBudget)}</b></header><div className="travel-progress"><i style={{ width: `${budgetProgress}%` }} /></div><button onClick={() => onNavigate("expenses")}><Receipt size={15} /> Gérer les dépenses</button></section>
    <section className="travel-panel travel-overview-progress"><header><span>Checklist</span><b>{complete} / {checks.length}</b></header><div className="travel-progress"><i style={{ width: `${checklistProgress}%` }} /></div><button onClick={() => onNavigate("checklist")}><ClipboardCheck size={15} /> Continuer la préparation</button></section>
    <section className="travel-panel travel-overview-members"><header className="travel-section-head"><div><span className="travel-eyebrow">Avec vous</span><h2>{participants.length} voyageur{participants.length > 1 ? "s" : ""}</h2></div><button onClick={() => onNavigate("members")}>Gérer</button></header><div>{participants.map((id) => <span key={id}><V2Avatar name={displayName(id)} /><small>{displayName(id)}</small></span>)}</div></section>
  </div>;
}
