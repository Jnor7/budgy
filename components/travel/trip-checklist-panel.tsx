"use client";

import { Check, ClipboardCheck, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { Field, FormModal } from "@/components/ui/modal";
import { V2Avatar } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { canEditTrip, tripParticipants } from "@/lib/domain/permissions";
import type { Trip } from "@/types/domain";

type Filter = "all" | "todo" | "done" | "mine";

export function TripChecklistPanel({ trip }: { trip: Trip }) {
  const { data, userId, displayName, avatarUrl, create, update, remove } = useBudgyData();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Documents");
  const [assignedTo, setAssignedTo] = useState("");
  const items = data.tripChecklistItems.filter((item) => item.tripId === trip.id);
  const participants = useMemo(() => tripParticipants(trip, data.tripMembers), [data.tripMembers, trip]);
  const canEdit = canEditTrip(trip, data.tripMembers, userId);
  const completed = items.filter((item) => item.isDone).length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
  const filtered = items.filter((item) => filter === "all" || (filter === "todo" && !item.isDone) || (filter === "done" && item.isDone) || (filter === "mine" && item.assignedTo === userId));

  const save = () => {
    if (!title.trim()) return;
    create("tripChecklistItems", { tripId: trip.id, title: title.trim(), category, isDone: false, assignedTo: assignedTo || undefined });
    showToast({ title: "Tâche ajoutée", detail: assignedTo ? `Assignée à ${displayName(assignedTo)}` : "Non assignée", tone: "success" });
  };

  return <div className="travel-tab-stack">
    <section className="travel-check-progress"><div><span><ClipboardCheck size={20} /></span><div><b>{completed} / {items.length} terminées</b><small>{progress}% de préparation</small></div><strong>{progress}%</strong></div><div className="travel-progress"><i style={{ width: `${progress}%` }} /></div></section>
    <div className="travel-filter-row" role="tablist">{(["all", "todo", "done", "mine"] as const).map((value) => <button key={value} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "Tout" : value === "todo" ? "À faire" : value === "done" ? "Terminé" : "À moi"}</button>)}</div>
    <section className="travel-panel"><header className="travel-section-head"><div><span className="travel-eyebrow">Préparation partagée</span><h2>Checklist</h2></div>{canEdit ? <button className="travel-button travel-button-soft" onClick={() => { setTitle(""); setAssignedTo(""); setOpen(true); }}><Plus size={16} /> Ajouter</button> : null}</header>
      {filtered.length === 0 ? <div className="travel-inline-empty"><span><Check size={22} /></span><div><strong>{items.length === 0 ? "La liste est prête à commencer" : "Aucun élément ici"}</strong><p>{items.length === 0 ? "Ajoutez passeport, visa, réservation ou valise puis assignez chaque tâche." : "Essayez un autre filtre."}</p></div></div> : filtered.map((item) => <div className={`travel-check-row ${item.isDone ? "is-done" : ""}`} key={item.id}><button className="travel-check-toggle" disabled={!canEdit} aria-label={item.isDone ? `Rouvrir ${item.title}` : `Terminer ${item.title}`} onClick={() => update("tripChecklistItems", item.id, { isDone: !item.isDone })}>{item.isDone ? <Check size={16} /> : null}</button><div><strong>{item.title}</strong><span>{item.category}</span></div>{item.assignedTo ? <span className="travel-assignee"><V2Avatar name={displayName(item.assignedTo)} url={avatarUrl(item.assignedTo)} />{displayName(item.assignedTo)}</span> : <span className="travel-assignee muted"><UserRound size={14} /> Non assigné</span>}{canEdit ? <button className="travel-row-delete" aria-label={`Supprimer ${item.title}`} onClick={() => remove("tripChecklistItems", item.id)}><Trash2 size={15} /></button> : null}</div>)}
    </section>
    <FormModal open={open} title="Nouvelle tâche" submitLabel="Ajouter à la checklist" disableSubmit={!title.trim()} onClose={() => setOpen(false)} onSubmit={save} icon={ClipboardCheck} tone="cyan"><div className="form-grid"><Field label="Tâche"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Faire l’ESTA" /></Field><Field label="Catégorie"><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}><option>Documents</option><option>Réservations</option><option>Valise</option><option>Pratique</option><option>Autre</option></select></Field><Field label="Assigner à"><select className="select" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Non assigné</option>{participants.map((participant) => <option value={participant.userId} key={participant.userId}>{participant.userId === userId ? "Moi" : displayName(participant.userId)}</option>)}</select></Field></div></FormModal>
  </div>;
}
