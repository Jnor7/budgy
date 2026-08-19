"use client";

import { Check, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog, SuccessState, useToast } from "@/components/ui/feedback";
import { FormModal } from "@/components/ui/modal";
import { V2Avatar, V2Empty } from "@/components/ui/v2";
import { TravelProfileSearch } from "@/components/travel/travel-profile-search";
import { useBudgyData } from "@/lib/data/data-provider";
import type { DirectoryProfile } from "@/types/domain";

type FriendRequestState = "idle" | "selected" | "sending" | "success" | "error";

export function TravelFriendsPanel() {
  const {
    data, userId, displayName, avatarUrl, localMode, sendTravelFriendRequest,
    respondTravelFriendRequest, removeTravelFriend, searchTravelProfiles,
  } = useBudgyData();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<DirectoryProfile>();
  const [requestState, setRequestState] = useState<FriendRequestState>("idle");
  const [pendingRemoval, setPendingRemoval] = useState<string>();
  const successTimer = useRef<number | undefined>(undefined);
  const { showToast } = useToast();
  const friends = useMemo(() => data.travelFriends.filter((friend) => friend.userA === userId || friend.userB === userId), [data.travelFriends, userId]);
  const incoming = data.travelFriendRequests.filter((request) => request.recipientId === userId && request.status === "pending");
  const outgoing = data.travelFriendRequests.filter((request) => request.senderId === userId && request.status === "pending");

  const close = useCallback(() => {
    if (successTimer.current) window.clearTimeout(successTimer.current);
    successTimer.current = undefined;
    setHandle(""); setSelectedProfile(undefined); setRequestState("idle"); setOpen(false);
  }, []);

  useEffect(() => {
    if (requestState !== "success") return;
    successTimer.current = window.setTimeout(close, 1200);
    return () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
      successTimer.current = undefined;
    };
  }, [close, requestState]);
  const statusFor = (candidateId: string) => {
    if (friends.some((friend) => friend.userA === candidateId || friend.userB === candidateId)) return "✓ Déjà ami";
    if (outgoing.some((request) => request.recipientId === candidateId)) return "✓ Demande déjà envoyée";
    return undefined;
  };
  const selectedStatus = selectedProfile ? statusFor(selectedProfile.userId) : undefined;
  const busy = requestState === "sending";

  const addFriend = async () => {
    if (!selectedProfile || selectedStatus || busy) return;
    setRequestState("sending");
    try {
      await sendTravelFriendRequest(selectedProfile.username);
      setRequestState("success");
    } catch {
      setRequestState("error");
      showToast({ title: "Demande impossible", detail: localMode ? "Connectez Supabase pour ajouter un ami." : "Vérifiez le pseudo ou une demande existante.", tone: "error" });
    }
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
          <V2Avatar name={displayName(request.senderId)} url={avatarUrl(request.senderId)} />
          <div><strong>{displayName(request.senderId)}</strong><span>Souhaite devenir votre ami de voyage</span></div>
          <button aria-label="Accepter" onClick={() => void answer(request.id, true)}><Check size={17} /></button>
          <button aria-label="Refuser" onClick={() => void answer(request.id, false)}><X size={17} /></button>
        </div>
      ))}
      {friends.length === 0 && incoming.length === 0 ? (
        <V2Empty icon={Users} title="Voyager, c’est mieux à plusieurs." text="Ajoutez vos proches ici, puis invitez-les à vos voyages sans créer de réseau social public." />
      ) : friends.map((friend) => {
        const friendId = friend.userA === userId ? friend.userB : friend.userA;
        return <div className="travel-friend-row" key={friend.id}><V2Avatar name={displayName(friendId)} url={avatarUrl(friendId)} /><div><strong>{displayName(friendId)}</strong><span>Ami de voyage</span></div><button aria-label={`Supprimer ${displayName(friendId)}`} onClick={() => setPendingRemoval(friend.id)}><UserMinus size={17} /></button></div>;
      })}
      {outgoing.length > 0 ? <p className="travel-hint">{outgoing.length} demande{outgoing.length > 1 ? "s" : ""} en attente.</p> : null}
      <FormModal open={open} title="Ajouter un ami de voyage" submitLabel={requestState === "sending" ? "Envoi..." : requestState === "success" ? "Demande envoyée" : selectedProfile && !selectedStatus ? "Confirmer la demande" : selectedStatus ?? "Sélectionner un profil"} disableSubmit={!selectedProfile || Boolean(selectedStatus) || busy || requestState === "success"} closeOnSubmit={false} onClose={close} onSubmit={() => void addFriend()} icon={UserPlus} tone="cyan">
        {requestState === "success" && selectedProfile ? <SuccessState title="Demande envoyée !" detail={`Votre demande a bien été envoyée à ${selectedProfile.username}.`} /> : <div className="form-grid"><p className="travel-form-intro">Recherche privée à partir de deux caractères, limitée aux profils publics nécessaires.</p><TravelProfileSearch value={handle} onChange={(value) => { setHandle(value); setSelectedProfile(undefined); setRequestState("idle"); }} onSelect={(candidate) => { setHandle(candidate.username); setSelectedProfile(candidate); setRequestState("selected"); }} search={searchTravelProfiles} statusFor={(candidate) => statusFor(candidate.userId)} />{requestState === "error" ? <p className="error">Impossible d&apos;envoyer la demande.</p> : null}</div>}
      </FormModal>
      <ConfirmDialog open={Boolean(pendingRemoval)} title="Supprimer cet ami de voyage ?" detail="Vous pourrez lui renvoyer une demande plus tard. Les voyages déjà partagés restent inchangés." confirmLabel="Supprimer" onCancel={() => setPendingRemoval(undefined)} onConfirm={() => { if (pendingRemoval) void removeTravelFriend(pendingRemoval); setPendingRemoval(undefined); }} />
    </section>
  );
}
