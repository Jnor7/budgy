"use client";

import { Plane, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RowMenu } from "@/components/ui/menu";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { Field, Sheet } from "@/components/ui/modal";
import { V2Avatar, V2Empty, V2Skeleton } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { canManageTripMembers, tripParticipants, visibleTrips } from "@/lib/domain/permissions";
import { fromDateInput, toDateInput } from "@/lib/format";
import type { Trip } from "@/types/domain";

type Draft = Pick<Trip, "title" | "destinationSummary" | "startDate" | "endDate" | "peopleCount" | "targetBudget" | "notes" | "isCompleted" | "coverImageUrl">;

const blank = (): Draft => ({
  title: "", destinationSummary: "",
  startDate: new Date().toISOString(), endDate: new Date().toISOString(),
  peopleCount: 1, targetBudget: 0, notes: "", isCompleted: false, coverImageUrl: "",
});

const dayCount = (start: string, end: string) => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(Math.round(diff / 86_400_000) + 1, 1);
};

const rangeLabel = (start: string, end: string) => {
  const from = new Date(start);
  const to = new Date(end);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
  const full = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return sameMonth ? `${day.format(from)} – ${full.format(to)}` : `${full.format(from)} → ${full.format(to)}`;
};

export default function TripsPage() {
  const { data, ready, userId, displayName, create, update, remove } = useBudgyData();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState<Draft>(blank);
  const [pendingDelete, setPendingDelete] = useState<Trip>();
  const { showToast } = useToast();

  const mine = useMemo(
    () => visibleTrips(data.trips, data.tripMembers, userId),
    [data.tripMembers, data.trips, userId],
  );
  const trips = useMemo(
    () => mine
      .filter((trip) => (tab === "upcoming" ? !trip.isCompleted : trip.isCompleted))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [mine, tab],
  );

  const startEdit = (trip: Trip) => {
    setEditing(trip.id);
    setDraft({
      title: trip.title, destinationSummary: trip.destinationSummary,
      startDate: trip.startDate, endDate: trip.endDate, peopleCount: trip.peopleCount,
      targetBudget: trip.targetBudget, notes: trip.notes, isCompleted: trip.isCompleted,
      coverImageUrl: trip.coverImageUrl ?? "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft.title.trim()) return;
    if (editing) update("trips", editing, draft);
    else create("trips", { ...draft, createdAt: new Date().toISOString() });
    setOpen(false);
  };

  const deleteTrip = (id: string) => {
    data.flights.filter((item) => item.tripId === id).forEach((item) => remove("flights", item.id));
    data.accommodations.filter((item) => item.tripId === id).forEach((item) => remove("accommodations", item.id));
    data.tripActivities.filter((item) => item.tripId === id).forEach((item) => remove("tripActivities", item.id));
    data.tripChecklistItems.filter((item) => item.tripId === id).forEach((item) => remove("tripChecklistItems", item.id));
    remove("trips", id);
    showToast({ title: "Voyage supprimé", tone: "success" });
  };

  if (!ready) return <main className="page v2-page v2"><V2Skeleton height={70} /><V2Skeleton height={240} /></main>;

  return (
    <main className="page v2-page v2">
      <header className="v2-greet">
        <div>
          <h1>Mes voyages</h1>
          <p>{trips.length} voyage{trips.length > 1 ? "s" : ""} {tab === "upcoming" ? "à venir" : "terminés"}</p>
        </div>
        <button className="fab" aria-label="Créer un voyage" onClick={() => { setEditing(undefined); setDraft(blank()); setOpen(true); }}>
          <Plus />
        </button>
      </header>

      <div className="segmented">
        <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>À venir</button>
        <button className={tab === "past" ? "active" : ""} onClick={() => setTab("past")}>Passés</button>
      </div>

      {trips.length === 0 ? (
        <V2Empty
          icon={Plane}
          title={tab === "upcoming" ? "Aucun voyage pour le moment ✈️" : "Aucun voyage terminé"}
          text={tab === "upcoming"
            ? "Commencez à préparer votre prochaine aventure : vols, logements, activités et budget partagé."
            : "Vos voyages terminés apparaîtront ici."}
          action={tab === "upcoming"
            ? <button className="button button-primary" onClick={() => { setEditing(undefined); setDraft(blank()); setOpen(true); }}>Créer un voyage</button>
            : undefined}
        />
      ) : null}

      {trips.map((trip) => {
        const flights = data.flights.filter((item) => item.tripId === trip.id);
        const stays = data.accommodations.filter((item) => item.tripId === trip.id);
        const activities = data.tripActivities.filter((item) => item.tripId === trip.id);
        const participants = tripParticipants(trip, data.tripMembers);
        const shared = participants.length > 1;
        const owner = canManageTripMembers(trip, data.tripMembers, userId);

        return (
          <section className="v2-card v2-trip" key={trip.id}>
            <Link href={`/trips/${trip.id}`}>
              <div
                className="v2-trip-cover"
                style={trip.coverImageUrl ? { backgroundImage: `url(${trip.coverImageUrl})` } : undefined}
              >
                {shared ? (
                  <div className="v2-avatars" style={{ position: "absolute", right: 14, top: 14, zIndex: 1 }}>
                    {participants.slice(0, 4).map((participant) => (
                      <V2Avatar key={participant.userId} name={displayName(participant.userId)} />
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>

            <div className="v2-trip-body">
              <div className="spread">
                <Link href={`/trips/${trip.id}`} style={{ minWidth: 0, flex: 1 }}>
                  <h3>{trip.title}</h3>
                  <div className="v2-trip-meta">
                    <span>{rangeLabel(trip.startDate, trip.endDate)}</span>
                    <span>{dayCount(trip.startDate, trip.endDate)} jours</span>
                  </div>
                </Link>
                {owner ? <RowMenu onEdit={() => startEdit(trip)} onDelete={() => setPendingDelete(trip)} /> : null}
              </div>

              <div className="v2-trip-stats">
                <div>
                  <span>Vols</span>
                  <b>{flights.length === 0 ? "À réserver" : flights.every((item) => item.status !== "a_reserver") ? "Réservé" : `${flights.length} vol(s)`}</b>
                </div>
                <div>
                  <span>Hébergement</span>
                  <b>{stays.length === 0 ? "À réserver" : stays.every((item) => item.status !== "a_reserver") ? "Réservé" : `${stays.length} nuitée(s)`}</b>
                </div>
                <div>
                  <span>Activités</span>
                  <b>{activities.length} prévue{activities.length > 1 ? "s" : ""}</b>
                </div>
              </div>

              {shared ? (
                <div className="row muted small" style={{ marginTop: 10 }}>
                  <Users size={14} /> Voyage partagé avec {participants.length - 1} personne(s)
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      <Sheet
        open={open} title={editing ? "Modifier le voyage" : "Nouveau voyage"}
        submitLabel={editing ? "Enregistrer" : "Créer"} disableSubmit={!draft.title.trim()}
        onClose={() => setOpen(false)} onSubmit={save}
      >
        <div className="form-grid">
          <Field label="Titre"><input className="input" value={draft.title} placeholder="Dubaï, New York…" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
          <Field label="Destination"><input className="input" value={draft.destinationSummary} onChange={(event) => setDraft({ ...draft, destinationSummary: event.target.value })} /></Field>
          <div className="grid-2">
            <Field label="Départ"><input className="input" type="date" value={toDateInput(draft.startDate)} onChange={(event) => setDraft({ ...draft, startDate: fromDateInput(event.target.value) })} /></Field>
            <Field label="Retour"><input className="input" type="date" value={toDateInput(draft.endDate)} onChange={(event) => setDraft({ ...draft, endDate: fromDateInput(event.target.value) })} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Voyageurs"><input className="input" type="number" min="1" value={draft.peopleCount} onChange={(event) => setDraft({ ...draft, peopleCount: Number(event.target.value) })} /></Field>
            <Field label="Budget cible"><input className="input" type="number" inputMode="decimal" value={draft.targetBudget || ""} onChange={(event) => setDraft({ ...draft, targetBudget: Number(event.target.value) })} /></Field>
          </div>
          <Field label="Notes"><textarea className="textarea" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
          {editing ? (
            <button className="card-flat spread" onClick={() => setDraft({ ...draft, isCompleted: !draft.isCompleted })}>
              <span>Voyage terminé</span>
              <span className={`status-dot ${draft.isCompleted ? "active" : ""}`} />
            </button>
          ) : null}
        </div>
      </Sheet>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Supprimer ce voyage ?" detail={`Le voyage « ${pendingDelete?.title ?? ""} » et ses vols, logements, activités et listes seront définitivement supprimés.`} onCancel={() => setPendingDelete(undefined)} onConfirm={() => { if (pendingDelete) deleteTrip(pendingDelete.id); setPendingDelete(undefined); }} />
    </main>
  );
}
