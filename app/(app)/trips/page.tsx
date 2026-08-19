"use client";

import { CalendarDays, ChevronRight, MapPin, Plane, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TravelCover } from "@/components/travel/travel-cover";
import { TravelFriendsPanel } from "@/components/travel/travel-friends-panel";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { RowMenu } from "@/components/ui/menu";
import { Field, FormModal, FormRow } from "@/components/ui/modal";
import { AmountField, DateField, FormSection } from "@/components/ui/premium";
import { V2Skeleton } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { tripParticipants, visibleTrips } from "@/lib/domain/permissions";
import { tripExpensesTotal } from "@/lib/domain/trip-expenses";
import { tripTotals } from "@/lib/domain/trips";
import { eur, fromDateInput, toDateInput } from "@/lib/format";
import { destinationImageProvider } from "@/lib/travel/destination-images";
import { countryCodeToFlag, destinationSuggestions, tripCreationDetails } from "@/lib/travel/destinations";
import { tripCountdown, tripDayCount, tripRangeLabel } from "@/lib/travel/presentation";
import type { Trip } from "@/types/domain";

type Tab = "upcoming" | "past" | "shared";
type Draft = Pick<Trip, "title" | "startDate" | "endDate" | "peopleCount" | "targetBudget"> & {
  countryName: string; countryCode: string;
};

const blank = (): Draft => ({
  title: "", countryName: "", countryCode: "",
  startDate: new Date().toISOString(), endDate: new Date().toISOString(), peopleCount: 1, targetBudget: 0,
});

export default function TripsPage() {
  const { data, ready, userId, create, update, updateAndWait, remove, reload } = useBudgyData();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip>();
  const [draft, setDraft] = useState<Draft>(blank);
  const [pendingDelete, setPendingDelete] = useState<Trip>();
  const [showFriends, setShowFriends] = useState(false);
  const [coverRefreshing, setCoverRefreshing] = useState(false);
  const { showToast } = useToast();

  const visible = useMemo(() => visibleTrips(data.trips, data.tripMembers, userId), [data.tripMembers, data.trips, userId]);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => visible.filter((trip) => {
    if (tab === "shared") return trip.userId !== userId;
    const isPast = trip.isCompleted || trip.endDate.slice(0, 10) < today;
    return tab === "past" ? isPast : !isPast;
  }).sort((a, b) => a.startDate.localeCompare(b.startDate)), [tab, today, userId, visible]);
  const hero = tab === "upcoming" ? filtered[0] : undefined;
  const cards = hero ? filtered.slice(1) : filtered;
  const suggestions = destinationSuggestions(draft.title);

  const spending = (trip: Trip) => {
    const expenses = data.tripExpenses.filter((item) => item.tripId === trip.id);
    if (expenses.length > 0) return tripExpensesTotal(expenses);
    return tripTotals(
      data.flights.filter((item) => item.tripId === trip.id),
      data.accommodations.filter((item) => item.tripId === trip.id),
      data.tripActivities.filter((item) => item.tripId === trip.id),
    ).totalBudget;
  };

  const startCreate = () => { setEditing(undefined); setDraft(blank()); setOpen(true); };
  const startEdit = (trip: Trip) => {
    setEditing(trip);
    setDraft({ title: trip.title, countryName: trip.countryName || trip.destinationSummary, countryCode: trip.countryCode || "", startDate: trip.startDate, endDate: trip.endDate, peopleCount: trip.peopleCount, targetBudget: trip.targetBudget });
    setOpen(true);
  };

  const resolveCover = async (trip: Trip, destination: string, country: string, excludePhotoId = "") => {
    const image = await destinationImageProvider.findLandscape(destination, country, { tripId: trip.id, excludePhotoId });
    if (image.provider !== "unsplash" || !image.imageUrl || !image.photographer) return false;
    try {
      const patch = { coverImageUrl: image.imageUrl, coverImageProvider: image.provider, coverImageId: image.photoId, coverPhotographer: image.photographer, coverPhotographerUrl: image.photographerUrl, coverAttribution: image.attribution };
      await updateAndWait("trips", trip.id, patch);
      await reload();
      setEditing((current) => current?.id === trip.id ? { ...current, ...patch } : current);
      return true;
    } catch {
      return false;
    }
  };

  const refreshEditingCover = async () => {
    if (!editing || coverRefreshing) return;
    setCoverRefreshing(true);
    const destination = tripCreationDetails(draft.title.trim() || editing.title, draft.countryName, draft.countryCode);
    const refreshed = await resolveCover({ ...editing, ...destination }, destination.title, destination.countryName, editing.coverImageId);
    showToast(refreshed
      ? { title: "Photo actualisée", detail: "La nouvelle couverture est enregistrée.", tone: "success" }
      : { title: "Impossible de récupérer une photo pour le moment.", tone: "error" });
    setCoverRefreshing(false);
  };

  const save = () => {
    const title = draft.title.trim();
    if (!title) return;
    const destination = tripCreationDetails(title, draft.countryName, draft.countryCode);
    const { countryName, countryCode } = destination;
    const payload = { ...destination, startDate: draft.startDate, endDate: draft.endDate, peopleCount: Math.max(1, draft.peopleCount), targetBudget: draft.targetBudget };
    if (editing) {
      update("trips", editing.id, payload);
      if (!editing.coverImageUrl || editing.title !== title || editing.countryName !== countryName) void resolveCover({ ...editing, ...payload }, title, countryName);
      showToast({ title: "Voyage modifié", detail: `${title} ${countryCodeToFlag(countryCode)}`, tone: "success" });
    } else {
      const trip = create("trips", { ...payload, notes: "", isCompleted: false, createdAt: new Date().toISOString(), coverImageUrl: "", coverImageProvider: "", coverImageId: "", coverPhotographer: "", coverPhotographerUrl: "", coverAttribution: "" });
      void resolveCover(trip, title, countryName);
      showToast({ title: "Voyage créé", detail: `${title} ${countryCodeToFlag(countryCode)}`, tone: "success" });
    }
    setOpen(false);
  };

  const deleteTrip = (trip: Trip) => {
    const expenses = data.tripExpenses.filter((item) => item.tripId === trip.id);
    const expenseIds = new Set(expenses.map((item) => item.id));
    data.tripExpenseSplits.filter((item) => expenseIds.has(item.expenseId)).forEach((item) => remove("tripExpenseSplits", item.id));
    expenses.forEach((item) => remove("tripExpenses", item.id));
    data.flights.filter((item) => item.tripId === trip.id).forEach((item) => remove("flights", item.id));
    data.accommodations.filter((item) => item.tripId === trip.id).forEach((item) => remove("accommodations", item.id));
    data.tripActivities.filter((item) => item.tripId === trip.id).forEach((item) => remove("tripActivities", item.id));
    data.tripChecklistItems.filter((item) => item.tripId === trip.id).forEach((item) => remove("tripChecklistItems", item.id));
    remove("trips", trip.id);
    showToast({ title: "Voyage supprimé", tone: "success" });
  };

  if (!ready) return <main className="page travel-page"><V2Skeleton height={82} /><V2Skeleton height={360} /></main>;
  return <main className="page travel-page">
    <header className="travel-dashboard-head"><div><span className="travel-eyebrow"><Sparkles size={13} /> Budgy Travel</span><h1>Voyages</h1><p>Préparez, partagez, partez.</p></div><button className="travel-fab" aria-label="Créer un voyage" onClick={startCreate}><Plus /></button></header>
    <div className="travel-segments" role="tablist" aria-label="Filtrer les voyages">{(["upcoming", "past", "shared"] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === "upcoming" ? "À venir" : value === "past" ? "Passés" : "Partagés"}</button>)}</div>
    {hero ? <TripHero trip={hero} spent={spending(hero)} participants={tripParticipants(hero, data.tripMembers).length} onEdit={() => startEdit(hero)} onDelete={() => setPendingDelete(hero)} /> : null}
    {cards.length > 0 ? <section className="travel-list"><header><h2>{hero ? "Les prochains ensuite" : tab === "past" ? "Souvenirs" : "Voyages partagés"}</h2><span>{cards.length}</span></header>{cards.map((trip) => <TripCard key={trip.id} trip={trip} spent={spending(trip)} participants={tripParticipants(trip, data.tripMembers).length} owned={trip.userId === userId} onEdit={() => startEdit(trip)} onDelete={() => setPendingDelete(trip)} />)}</section> : null}
    {filtered.length === 0 ? <section className="travel-empty"><span><Plane size={28} /></span><h2>{tab === "shared" ? "Aucun voyage partagé" : tab === "past" ? "Vos souvenirs apparaîtront ici" : "Votre prochaine aventure commence ici"}</h2><p>{tab === "upcoming" ? "Créez un voyage en quelques secondes. La cover et le drapeau s’ajoutent automatiquement." : "Changez de filtre ou préparez un nouveau départ."}</p>{tab === "upcoming" ? <button className="travel-button" onClick={startCreate}><Plus size={17} /> Créer un voyage</button> : null}</section> : null}
    <button className="travel-friends-toggle" aria-expanded={showFriends} onClick={() => setShowFriends((value) => !value)}><span><Users size={19} /><b>Amis de voyage</b><small>Votre cercle, uniquement dans Voyages</small></span><ChevronRight className={showFriends ? "is-open" : ""} /></button>
    {showFriends ? <TravelFriendsPanel /> : null}
    <FormModal open={open} title={editing ? "Modifier le voyage" : "Nouveau voyage"} submitLabel={editing ? "Enregistrer" : "Créer le voyage"} disableSubmit={!draft.title.trim() || draft.endDate < draft.startDate} onClose={() => setOpen(false)} onSubmit={save} icon={MapPin} tone="cyan"><div className="form-grid travel-create-form"><FormSection title="Où partez-vous ?"><Field label="Destination"><input className="input" autoComplete="off" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Tokyo" /></Field>{suggestions.length > 0 ? <div className="destination-suggestions">{suggestions.map((suggestion) => <button type="button" key={`${suggestion.city}-${suggestion.countryCode}`} onClick={() => setDraft({ ...draft, title: suggestion.city, countryName: suggestion.country, countryCode: suggestion.countryCode })}><MapPin size={15} /><span><b>{suggestion.city}, {suggestion.country}</b><small>{countryCodeToFlag(suggestion.countryCode)} Suggestion</small></span></button>)}</div> : null}<Field label="Pays"><input className="input" value={draft.countryName} onChange={(event) => setDraft({ ...draft, countryName: event.target.value, countryCode: "" })} placeholder="Japon" /></Field>{editing ? <button type="button" className="travel-cover-refresh" data-form-dirty-ignore onClick={() => void refreshEditingCover()} disabled={coverRefreshing}>{coverRefreshing ? "Recherche de la photo…" : "Rafraîchir la photo"}</button> : null}</FormSection><FormSection title="Dates"><FormRow><Field label="Départ"><DateField value={toDateInput(draft.startDate)} onChange={(value) => setDraft({ ...draft, startDate: fromDateInput(value) })} /></Field><Field label="Retour"><DateField value={toDateInput(draft.endDate)} onChange={(value) => setDraft({ ...draft, endDate: fromDateInput(value) })} /></Field></FormRow></FormSection><FormSection title="L’essentiel"><FormRow><Field label="Voyageurs"><div className="travel-number-field"><Users size={16} /><input className="input" type="number" min="1" value={draft.peopleCount} onChange={(event) => setDraft({ ...draft, peopleCount: Math.max(1, Number(event.target.value) || 1) })} /></div></Field><Field label="Budget cible"><AmountField size="compact" value={draft.targetBudget} onChange={(targetBudget) => setDraft({ ...draft, targetBudget })} /></Field></FormRow></FormSection><p className="travel-form-intro">Vols, logements, activités et membres pourront être ajoutés dans le voyage.</p></div></FormModal>
    <ConfirmDialog open={Boolean(pendingDelete)} title="Supprimer ce voyage ?" detail={`« ${pendingDelete?.title ?? ""} » et ses éléments seront définitivement supprimés.`} onCancel={() => setPendingDelete(undefined)} onConfirm={() => { if (pendingDelete) deleteTrip(pendingDelete); setPendingDelete(undefined); }} />
  </main>;
}

function TripHero({ trip, spent, participants, onEdit, onDelete }: { trip: Trip; spent: number; participants: number; onEdit: () => void; onDelete: () => void }) {
  const progress = trip.targetBudget > 0 ? Math.min((spent / trip.targetBudget) * 100, 100) : 0;
  return <section className="travel-hero-wrap"><TravelCover imageUrl={trip.coverImageUrl} destination={trip.title} countryCode={trip.countryCode} className="travel-hero" eager><div className="travel-hero-top"><span>{tripCountdown(trip.startDate)}</span><RowMenu onEdit={onEdit} onDelete={onDelete} /></div><div className="travel-hero-main"><span className="travel-kicker">Prochain voyage</span><h2>{trip.title} <em>{countryCodeToFlag(trip.countryCode)}</em></h2><p><CalendarDays size={15} /> {tripRangeLabel(trip.startDate, trip.endDate)} · {tripDayCount(trip.startDate, trip.endDate)} jours</p><p><Users size={15} /> {participants || trip.peopleCount} voyageur{(participants || trip.peopleCount) > 1 ? "s" : ""}</p></div><div className="travel-hero-budget"><div><span>Budget</span><b>{eur.format(spent)} <small>/ {eur.format(trip.targetBudget)}</small></b></div><div className="travel-progress"><i style={{ width: `${progress}%` }} /></div><Link href={`/trips/${trip.id}`}>Voir le voyage <ChevronRight size={17} /></Link></div></TravelCover>{trip.coverAttribution ? <small className="travel-attribution">{trip.coverAttribution}</small> : null}</section>;
}

function TripCard({ trip, spent, participants, owned, onEdit, onDelete }: { trip: Trip; spent: number; participants: number; owned: boolean; onEdit: () => void; onDelete: () => void }) {
  const progress = trip.targetBudget > 0 ? Math.min((spent / trip.targetBudget) * 100, 100) : 0;
  return <article className="travel-card"><Link href={`/trips/${trip.id}`}><TravelCover imageUrl={trip.coverImageUrl} destination={trip.title} countryCode={trip.countryCode} className="travel-card-cover" /></Link><div className="travel-card-body"><div className="travel-card-title"><Link href={`/trips/${trip.id}`}><h3>{trip.title} {countryCodeToFlag(trip.countryCode)}</h3><p>{tripRangeLabel(trip.startDate, trip.endDate)} · {tripDayCount(trip.startDate, trip.endDate)} jours</p></Link>{owned ? <RowMenu onEdit={onEdit} onDelete={onDelete} /> : null}</div><div className="travel-card-meta"><span><Users size={14} /> {participants || trip.peopleCount}</span><span>{trip.isCompleted ? "Terminé" : tripCountdown(trip.startDate)}</span></div><div className="travel-card-budget"><span><i style={{ width: `${progress}%` }} /></span><b>{eur.format(spent)} / {eur.format(trip.targetBudget)}</b></div></div></article>;
}
