"use client";

import { Check, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog, useToast } from "@/components/ui/feedback";
import { Field, FormModal } from "@/components/ui/modal";
import { V2Avatar, V2Empty } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";

export function TravelFriendsPanel() {
  const {
    data, userId, displayName, localMode, sendTravelFriendRequest,
    respondTravelFriendRequest, removeTravelFriend,
  } = useBudgyData();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string>();
  const { showToast } = useToast();
  const friends = useMemo(() => data.travelFriends.filter((friend) => friend.userA === userId || friend.userB === userId), [data.travelFriends, userId]);
  const incoming = data.travelFriendRequests.filter((request) => request.recipientId === userId && request.status === "pending");
  const outgoing = data.travelFriendRequests.filter((request) => request.senderId === userId && request.status === "pending");

  const addFriend = async () => {
    if (!handle.trim() || busy) return;
    setBusy(true);
    try {
      await sendTravelFriendRequest(handle.trim());
      showToast({ title: "Demande envoyée", detail: `À ${handle.trim()}`, tone: "success" });
      setHandle(""); setOpen(false);
    } catch {
      showToast({ title: "Demande impossible", detail: localMode ? "Connectez Supabase pour ajouter un ami." : "Vérifiez le pseudo ou une demande existante.", tone: "error" });
    } finally { setBusy(false); }
  };

  const answer = async (id: string, accept: boolean) => {
    try {
      await respondTravelFriendRequest(id, accept);
      showToast({ title: accept ? "Ami de voyage ajouté" : "Demande refusée", tone: "success" });
    } catch { showToast({ title: "Réponse impossible", tone: "error" }); }
  };

  return (
    <section className="travel-panel travel-friends-panel">
      <header className="travel-section-head">
        <div><span className="travel-eyebrow">Votre cercle privé</span><h2>Amis de voyage</h2></div>
        <button className="travel-button travel-button-soft" onClick={() => setOpen(true)}><UserPlus size={16} /> Ajouter</button>
      </header>
      {incoming.map((request) => (
        <div className="travel-request" key={request.id}>
          <V2Avatar name={displayName(request.senderId)} />
          <div><strong>{displayName(request.senderId)}</strong><span>Souhaite devenir votre ami de voyage</span></div>
          <button aria-label="Accepter" onClick={() => void answer(request.id, true)}><Check size={17} /></button>
          <button aria-label="Refuser" onClick={() => void answer(request.id, false)}><X size={17} /></button>
        </div>
      ))}
      {friends.length === 0 && incoming.length === 0 ? (
        <V2Empty icon={Users} title="Voyager, c’est mieux à plusieurs." text="Ajoutez vos proches ici, puis invitez-les à vos voyages sans créer de réseau social public." />
      ) : friends.map((friend) => {
        const friendId = friend.userA === userId ? friend.userB : friend.userA;
        return <div className="travel-friend-row" key={friend.id}><V2Avatar name={displayName(friendId)} /><div><strong>{displayName(friendId)}</strong><span>Ami de voyage</span></div><button aria-label={`Supprimer ${displayName(friendId)}`} onClick={() => setPendingRemoval(friend.id)}><UserMinus size={17} /></button></div>;
      })}
      {outgoing.length > 0 ? <p className="travel-hint">{outgoing.length} demande{outgoing.length > 1 ? "s" : ""} en attente.</p> : null}
      <FormModal open={open} title="Ajouter un ami de voyage" submitLabel={busy ? "Envoi…" : "Envoyer la demande"} disableSubmit={!handle.trim() || busy} onClose={() => setOpen(false)} onSubmit={() => void addFriend()} icon={UserPlus} tone="cyan">
        <div className="form-grid"><p className="travel-form-intro">La recherche est exacte et privée : aucun annuaire complet d’utilisateurs n’est exposé.</p><Field label="Pseudo Budgy"><input className="input" autoComplete="off" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="Kevin" /></Field></div>
      </FormModal>
      <ConfirmDialog open={Boolean(pendingRemoval)} title="Supprimer cet ami de voyage ?" detail="Vous pourrez lui renvoyer une demande plus tard. Les voyages déjà partagés restent inchangés." confirmLabel="Supprimer" onCancel={() => setPendingRemoval(undefined)} onConfirm={() => { if (pendingRemoval) void removeTravelFriend(pendingRemoval); setPendingRemoval(undefined); }} />
    </section>
  );
}

