"use client";

import { Clock3, Plus, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/feedback";
import { Field, FormModal } from "@/components/ui/modal";
import { V2Avatar } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { canManageTripMembers, roleLabel, tripParticipants } from "@/lib/domain/permissions";
import type { Trip } from "@/types/domain";

export function TripMembersPanel({ trip }: { trip: Trip }) {
  const { data, userId, displayName, avatarUrl, inviteToTrip, remove, localMode } = useBudgyData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const participants = useMemo(() => tripParticipants(trip, data.tripMembers), [data.tripMembers, trip]);
  const canManage = canManageTripMembers(trip, data.tripMembers, userId);
  const pending = data.tripMembers.filter((member) => member.tripId === trip.id && member.status === "pending");
  const friends = data.travelFriends.filter((friend) => friend.userA === userId || friend.userB === userId).map((friend) => friend.userA === userId ? friend.userB : friend.userA).filter((id) => !participants.some((participant) => participant.userId === id) && !pending.some((member) => member.userId === id));

  const invite = async (value = handle) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await inviteToTrip(trip.id, { handle: value.trim(), role });
      showToast({ title: "Invitation envoyée", detail: `${value.trim()} · ${roleLabel(role)}`, tone: "success" });
      setHandle(""); setOpen(false);
    } catch { showToast({ title: "Invitation impossible", detail: localMode ? "Connectez Supabase pour inviter un membre." : "Vérifiez le pseudo et réessayez.", tone: "error" }); }
    finally { setBusy(false); }
  };

  return <div className="travel-tab-stack"><section className="travel-panel"><header className="travel-section-head"><div><span className="travel-eyebrow">Équipe du voyage</span><h2>{participants.length} voyageur{participants.length > 1 ? "s" : ""}</h2></div>{canManage ? <button className="travel-button travel-button-soft" onClick={() => setOpen(true)}><UserPlus size={16} /> Inviter</button> : null}</header>
    <div className="travel-member-avatars">{participants.slice(0, 8).map((participant) => <V2Avatar key={participant.userId} name={displayName(participant.userId)} url={avatarUrl(participant.userId)} />)}</div>
    {participants.map((participant) => <div className="travel-member-row" key={participant.userId}><V2Avatar name={displayName(participant.userId)} url={avatarUrl(participant.userId)} /><div><strong>{displayName(participant.userId)}{participant.userId === userId ? " (vous)" : ""}</strong><span>{roleLabel(participant.role)}</span></div><span className={`travel-role travel-role-${participant.role}`}><ShieldCheck size={14} />{participant.role === "owner" ? "Organisateur" : participant.role === "editor" ? "Membre" : "Lecture"}</span>{canManage && participant.role !== "owner" ? <button aria-label={`Retirer ${displayName(participant.userId)}`} onClick={() => { const member = data.tripMembers.find((item) => item.tripId === trip.id && item.userId === participant.userId); if (member) remove("tripMembers", member.id); }}><Trash2 size={16} /></button> : null}</div>)}
    {pending.map((member) => <div className="travel-member-row is-pending" key={member.id}><V2Avatar name={displayName(member.userId)} url={avatarUrl(member.userId)} /><div><strong>{displayName(member.userId)}</strong><span>Invitation envoyée</span></div><span className="travel-role"><Clock3 size={14} /> En attente</span></div>)}
  </section>
  {canManage ? <section className="travel-panel"><header className="travel-section-head"><div><span className="travel-eyebrow">Invitation rapide</span><h2>Mes amis</h2></div><Users size={22} /></header>{friends.length === 0 ? <div className="travel-inline-empty"><span><Users size={22} /></span><div><strong>Votre cercle est à jour</strong><p>Ajoutez des amis depuis le dashboard Voyages pour les retrouver ici.</p></div></div> : friends.map((friendId) => <div className="travel-friend-row" key={friendId}><V2Avatar name={displayName(friendId)} url={avatarUrl(friendId)} /><div><strong>{displayName(friendId)}</strong><span>Ami de voyage</span></div><button className="travel-button travel-button-soft" onClick={() => void invite(displayName(friendId))}><Plus size={15} /> Inviter</button></div>)}</section> : null}
  <FormModal open={open} title="Inviter au voyage" submitLabel={busy ? "Envoi…" : "Envoyer l’invitation"} disableSubmit={!handle.trim() || busy} onClose={() => { setHandle(""); setOpen(false); }} onSubmit={() => void invite()} icon={UserPlus} tone="cyan"><div className="form-grid"><Field label="Pseudo Budgy"><input className="input" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="Pseudo" /></Field><Field label="Permission"><select className="select" value={role} onChange={(event) => setRole(event.target.value as "editor" | "viewer")}><option value="editor">Membre · peut modifier</option><option value="viewer">Lecture seule</option></select></Field><p className="travel-form-intro">L’invité recevra une notification avec les actions Rejoindre ou Refuser.</p></div></FormModal></div>;
}
