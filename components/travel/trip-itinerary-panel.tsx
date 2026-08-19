"use client";

import { BedDouble, MapPin, Plane, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AirportPicker } from "@/components/ui/airport-picker";
import { useToast } from "@/components/ui/feedback";
import { Field, FormModal, FormRow } from "@/components/ui/modal";
import { AmountField, DateField, DateTimeField, FormSection } from "@/components/ui/premium";
import { useBudgyData } from "@/lib/data/data-provider";
import { canEditTrip } from "@/lib/domain/permissions";
import { eur, fromDateInput, toDateInput } from "@/lib/format";
import { airports, type Airport } from "@/lib/airports/airports";
import { airlineProvider } from "@/lib/travel/airlines";
import { buildItinerary } from "@/lib/travel/itinerary";
import { itineraryDayLabel, timeLabel, tripDayCount } from "@/lib/travel/presentation";
import type { Accommodation, Flight, Trip, TripActivity } from "@/types/domain";

export type ItineraryKind = "flight" | "stay" | "activity";
type Kind = ItineraryKind;
type Draft = {
  title: string; city: string; fromCode: string; toCode: string; startDate: string; endDate: string;
  price: number; status: string; airlineCode: string; flightNumber: string; departureTerminal: string;
  arrivalTerminal: string; gate: string; bookingReference: string; checkInTime: string; checkOutTime: string;
  durationMinutes: number; pricePerPerson: boolean; category: string; note: string;
};

const blank = (date: string): Draft => ({
  title: "", city: "", fromCode: "CDG", toCode: "DXB", startDate: date, endDate: date,
  price: 0, status: "a_reserver", airlineCode: "", flightNumber: "", departureTerminal: "",
  arrivalTerminal: "", gate: "", bookingReference: "", checkInTime: "15:00", checkOutTime: "11:00",
  durationMinutes: 120, pricePerPerson: false, category: "visite", note: "",
});

const dateTimeInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const fromDateTimeInput = (value: string) => new Date(value).toISOString();
const staticAirport = (code: string) => airports.find((item) => item.code === code);

export function TripItineraryPanel({ trip, initialKind, onInitialKindConsumed }: { trip: Trip; initialKind?: ItineraryKind; onInitialKindConsumed?: () => void }) {
  const { data, userId, create, update, remove } = useBudgyData();
  const { showToast } = useToast();
  const [kind, setKind] = useState<Kind | undefined>(initialKind);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState(() => blank(trip.startDate));
  const [airportField, setAirportField] = useState<"from" | "to">();
  const [selectedAirports, setSelectedAirports] = useState<Record<string, Airport>>({});
  const flights = data.flights.filter((item) => item.tripId === trip.id);
  const stays = data.accommodations.filter((item) => item.tripId === trip.id);
  const activities = data.tripActivities.filter((item) => item.tripId === trip.id);
  const timeline = buildItinerary(flights, stays, activities);
  const canEdit = canEditTrip(trip, data.tripMembers, userId);
  const airlineSuggestions = useMemo(() => kind === "flight" ? airlineProvider.search(draft.title) : [], [draft.title, kind]);
  const airport = (code: string) => selectedAirports[code] ?? staticAirport(code);

  const openCreate = (value: Kind) => { setKind(value); setEditing(undefined); setDraft(blank(trip.startDate)); };
  const editFlight = (item: Flight) => { setKind("flight"); setEditing(item.id); setDraft({ ...blank(item.departDate), title: item.airline, fromCode: item.fromCode, toCode: item.toCode, startDate: item.departDate, endDate: item.arriveDate, price: item.price, status: item.status, airlineCode: item.airlineCode ?? "", flightNumber: item.flightNumber ?? "", departureTerminal: item.departureTerminal ?? "", arrivalTerminal: item.arrivalTerminal ?? "", gate: item.gate ?? "", bookingReference: item.bookingReference ?? "" }); };
  const editStay = (item: Accommodation) => { setKind("stay"); setEditing(item.id); setDraft({ ...blank(item.startDate), title: item.name, city: item.city, startDate: item.startDate, endDate: item.endDate, price: item.price, status: item.status, checkInTime: item.checkInTime ?? "15:00", checkOutTime: item.checkOutTime ?? "11:00", bookingReference: item.bookingLink, note: item.attachmentNote }); };
  const editActivity = (item: TripActivity) => { setKind("activity"); setEditing(item.id); setDraft({ ...blank(item.activityDate), title: item.title, city: item.city, startDate: item.activityDate, endDate: item.activityDate, price: item.price, status: item.status, durationMinutes: item.durationMinutes ?? 120, pricePerPerson: item.pricePerPerson ?? false, category: item.category ?? "visite" }); };

  const save = () => {
    if (!kind || !draft.title.trim()) return;
    if (kind === "flight") {
      const payload = { tripId: trip.id, airline: draft.title.trim(), airlineCode: draft.airlineCode, flightNumber: draft.flightNumber.trim(), fromCode: draft.fromCode, toCode: draft.toCode, departDate: draft.startDate, arriveDate: draft.endDate, price: draft.price, bookingLink: "", attachmentNote: "", status: draft.status, departureTerminal: draft.departureTerminal, arrivalTerminal: draft.arrivalTerminal, gate: draft.gate, bookingReference: draft.bookingReference };
      if (editing) update("flights", editing, payload); else create("flights", payload);
    } else if (kind === "stay") {
      const payload = { tripId: trip.id, name: draft.title.trim(), city: draft.city.trim(), startDate: draft.startDate, endDate: draft.endDate, price: draft.price, bookingLink: draft.bookingReference.trim(), attachmentNote: draft.note.trim(), status: draft.status, checkInTime: draft.checkInTime || undefined, checkOutTime: draft.checkOutTime || undefined, imageUrl: "" };
      if (editing) update("accommodations", editing, payload); else create("accommodations", payload);
    } else {
      const payload = { tripId: trip.id, title: draft.title.trim(), city: draft.city.trim(), activityDate: draft.startDate, price: draft.price, link: "", status: draft.status, note: "", durationMinutes: draft.durationMinutes, pricePerPerson: draft.pricePerPerson, category: draft.category };
      if (editing) update("tripActivities", editing, payload); else create("tripActivities", payload);
    }
    showToast({ title: editing ? "Étape modifiée" : "Étape ajoutée", detail: draft.title, tone: "success" });
    setKind(undefined);
    onInitialKindConsumed?.();
  };

  const closeEditor = () => { setKind(undefined); onInitialKindConsumed?.(); };

  return <div className="travel-tab-stack"><section className="travel-panel"><header className="travel-section-head"><div><span className="travel-eyebrow">Planning chronologique</span><h2>Itinéraire</h2></div>{canEdit ? <div className="travel-add-cluster"><button aria-label="Ajouter un vol" onClick={() => openCreate("flight")}><Plane size={17} /></button><button aria-label="Ajouter un logement" onClick={() => openCreate("stay")}><BedDouble size={17} /></button><button aria-label="Ajouter une activité" onClick={() => openCreate("activity")}><MapPin size={17} /></button></div> : null}</header>
    {timeline.length === 0 ? <div className="travel-empty travel-empty-inline"><span><MapPin size={25} /></span><h2>Votre itinéraire prend vie ici</h2><p>Ajoutez un vol, un logement ou une activité. Tout sera regroupé automatiquement par jour.</p>{canEdit ? <button className="travel-button" onClick={() => openCreate("flight")}><Plus size={16} /> Première étape</button> : null}</div> : <div className="travel-timeline">{timeline.map((item, index) => { const previous = timeline[index - 1]; const newDay = !previous || previous.date.slice(0, 10) !== item.date.slice(0, 10); return <div key={`${item.kind}-${item.id}`}>{newDay ? <h3>{itineraryDayLabel(item.date)}</h3> : null}{item.kind === "flight" ? <FlightCard item={item.flight} canEdit={canEdit} onEdit={() => editFlight(item.flight)} onDelete={() => remove("flights", item.id)} /> : item.kind === "stay" ? <StayCard item={item.stay} canEdit={canEdit} onEdit={() => editStay(item.stay)} onDelete={() => remove("accommodations", item.id)} /> : <ActivityCard item={item.activity} canEdit={canEdit} onEdit={() => editActivity(item.activity)} onDelete={() => remove("tripActivities", item.id)} />}</div>; })}</div>}
  </section>
  <FormModal open={Boolean(kind)} title={kind === "flight" ? (editing ? "Modifier le vol" : "Nouveau vol") : kind === "stay" ? (editing ? "Modifier le logement" : "Nouveau logement") : (editing ? "Modifier l’activité" : "Nouvelle activité")} submitLabel={editing ? "Enregistrer" : "Ajouter à l’itinéraire"} disableSubmit={!draft.title.trim() || (kind === "flight" && (!draft.fromCode || !draft.toCode))} onClose={closeEditor} onSubmit={save} icon={kind === "stay" ? BedDouble : kind === "activity" ? MapPin : Plane} tone="cyan"><div className="form-grid">{kind === "flight" ? <><FormSection title="Trajet"><div className="travel-airport-route"><button type="button" onClick={() => setAirportField("from")}><small>Départ</small><b>{draft.fromCode}</b><span>{airport(draft.fromCode)?.name ?? "Choisir"}</span></button><Plane size={20} /><button type="button" onClick={() => setAirportField("to")}><small>Arrivée</small><b>{draft.toCode}</b><span>{airport(draft.toCode)?.name ?? "Choisir"}</span></button></div></FormSection><FormSection title="Vol"><FormRow><Field label="Compagnie"><input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Emirates" /></Field><Field label="Numéro"><input className="input" value={draft.flightNumber} onChange={(event) => setDraft({ ...draft, flightNumber: event.target.value.toUpperCase() })} placeholder="EK74" /></Field></FormRow>{draft.title && airlineSuggestions.length > 0 ? <div className="airline-suggestions">{airlineSuggestions.slice(0, 3).map((airline) => <button type="button" key={airline.iata} onClick={() => setDraft({ ...draft, title: airline.name, airlineCode: airline.iata, flightNumber: draft.flightNumber || airline.iata })}><b>{airline.iata}</b>{airline.name}</button>)}</div> : null}<FormRow className="travel-datetime-row"><Field label="Départ"><DateTimeField value={dateTimeInput(draft.startDate)} timeLabel="Heure de départ" onChange={(value) => setDraft({ ...draft, startDate: fromDateTimeInput(value) })} /></Field><Field label="Arrivée"><DateTimeField value={dateTimeInput(draft.endDate)} timeLabel="Heure d’arrivée" onChange={(value) => setDraft({ ...draft, endDate: fromDateTimeInput(value) })} /></Field></FormRow></FormSection><FormSection title="Détails facultatifs"><FormRow><Field label="Terminal départ"><input className="input" value={draft.departureTerminal} onChange={(event) => setDraft({ ...draft, departureTerminal: event.target.value })} placeholder="2C" /></Field><Field label="Terminal arrivée"><input className="input" value={draft.arrivalTerminal} onChange={(event) => setDraft({ ...draft, arrivalTerminal: event.target.value })} placeholder="3" /></Field></FormRow><FormRow><Field label="Porte"><input className="input" value={draft.gate} onChange={(event) => setDraft({ ...draft, gate: event.target.value })} placeholder="A12" /></Field><Field label="Référence"><input className="input" value={draft.bookingReference} onChange={(event) => setDraft({ ...draft, bookingReference: event.target.value.toUpperCase() })} placeholder="ABC123" /></Field></FormRow><Field label="Prix"><AmountField size="compact" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} /></Field></FormSection></> : kind === "stay" ? <><FormSection title="Logement"><Field label="Nom"><input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Atlantis The Royal" /></Field><Field label="Adresse ou ville"><input className="input" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} placeholder={trip.title} /></Field></FormSection><FormSection title="Séjour"><FormRow><Field label="Arrivée"><DateField value={toDateInput(draft.startDate)} onChange={(value) => setDraft({ ...draft, startDate: fromDateInput(value) })} /></Field><Field label="Départ"><DateField value={toDateInput(draft.endDate)} onChange={(value) => setDraft({ ...draft, endDate: fromDateInput(value) })} /></Field></FormRow><FormRow><Field label="Check-in"><input className="input" type="time" value={draft.checkInTime} onChange={(event) => setDraft({ ...draft, checkInTime: event.target.value })} /></Field><Field label="Check-out"><input className="input" type="time" value={draft.checkOutTime} onChange={(event) => setDraft({ ...draft, checkOutTime: event.target.value })} /></Field></FormRow><Field label="Prix total"><AmountField size="compact" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} /></Field><Field label="Référence de réservation"><input className="input" value={draft.bookingReference} onChange={(event) => setDraft({ ...draft, bookingReference: event.target.value })} placeholder="BOOK-1234" /></Field><Field label="Notes"><textarea className="textarea" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Accès, contact, informations utiles…" /></Field></FormSection></> : <><FormSection title="Activité"><Field label="Nom"><input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Burj Khalifa" /></Field><FormRow><Field label="Ville"><input className="input" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></Field><Field label="Catégorie"><select className="select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="restaurant">Restaurant</option><option value="visite">Visite</option><option value="plage">Plage</option><option value="loisir">Loisir</option><option value="shopping">Shopping</option></select></Field></FormRow><Field label="Date et heure"><DateTimeField value={dateTimeInput(draft.startDate)} timeLabel="Heure de l’activité" onChange={(value) => setDraft({ ...draft, startDate: fromDateTimeInput(value) })} /></Field><FormRow><Field label="Durée (min)"><input className="input" type="number" min="15" step="15" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /></Field><Field label="Prix"><AmountField size="compact" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} /></Field></FormRow><button type="button" className={`travel-toggle-line ${draft.pricePerPerson ? "active" : ""}`} onClick={() => setDraft({ ...draft, pricePerPerson: !draft.pricePerPerson })}><span>Prix par personne</span><i /></button></FormSection></>}</div></FormModal>
  <AirportPicker open={Boolean(airportField)} title={airportField === "from" ? "Aéroport de départ" : "Aéroport d’arrivée"} value={airportField === "from" ? draft.fromCode : draft.toCode} onClose={() => setAirportField(undefined)} onSelect={(code, selected) => { setSelectedAirports((current) => ({ ...current, [code]: selected })); if (airportField) setDraft((current) => ({ ...current, [airportField === "from" ? "fromCode" : "toCode"]: code })); }} />
  </div>;
}

function FlightCard({ item, canEdit, onEdit, onDelete }: { item: Flight; canEdit: boolean; onEdit: () => void; onDelete: () => void }) { return <article className="boarding-pass" onClick={canEdit ? onEdit : undefined}><header><span><Plane size={18} /></span><div><strong>{item.airline}</strong><small>{item.flightNumber || item.airlineCode || "Vol"}</small></div>{canEdit ? <button aria-label="Supprimer le vol" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={15} /></button> : null}</header><div className="boarding-route"><div><b>{item.fromCode}</b><span>{timeLabel(item.departDate)}</span></div><i><Plane size={17} /></i><div><b>{item.toCode}</b><span>{timeLabel(item.arriveDate)}</span></div></div><footer><span>{item.departureTerminal ? `Terminal ${item.departureTerminal}` : "Terminal à confirmer"}</span><span>{item.gate ? `Porte ${item.gate}` : ""}</span><b>{eur.format(item.price)}</b></footer></article>; }
function StayCard({ item, canEdit, onEdit, onDelete }: { item: Accommodation; canEdit: boolean; onEdit: () => void; onDelete: () => void }) { return <article className="travel-stay-card" onClick={canEdit ? onEdit : undefined}><span><BedDouble size={20} /></span><div><strong>{item.name}</strong><p>{item.city} · {tripDayCount(item.startDate, item.endDate) - 1} nuits</p><small>Check-in {item.checkInTime?.slice(0, 5) || "—"} · Check-out {item.checkOutTime?.slice(0, 5) || "—"}</small></div><b>{eur.format(item.price)}</b>{canEdit ? <button aria-label="Supprimer le logement" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={15} /></button> : null}</article>; }
function ActivityCard({ item, canEdit, onEdit, onDelete }: { item: TripActivity; canEdit: boolean; onEdit: () => void; onDelete: () => void }) { const icons: Record<string, string> = { restaurant: "🍽️", visite: "🏛️", plage: "🏖️", loisir: "🎢", shopping: "🛍️" }; return <article className="travel-activity-card" onClick={canEdit ? onEdit : undefined}><span>{icons[item.category ?? "visite"] ?? "📍"}</span><div><strong>{item.title}</strong><p>{timeLabel(item.activityDate)} · {Math.round((item.durationMinutes ?? 120) / 60 * 10) / 10}h</p><small>{item.status === "reserve" ? "Réservé" : "À prévoir"}</small></div><b>{eur.format(item.price)}{item.pricePerPerson ? <small>/ pers.</small> : null}</b>{canEdit ? <button aria-label="Supprimer l’activité" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={15} /></button> : null}</article>; }
