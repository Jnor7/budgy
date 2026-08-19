"use client";

import { ArrowLeftRight, Plus, Receipt, Trash2, UserPlus, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Field, FormModal } from "@/components/ui/modal";
import { AmountField } from "@/components/ui/premium";
import { V2Avatar, V2Icon } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { canEditTrip, canManageTripMembers, roleLabel, tripParticipants } from "@/lib/domain/permissions";
import { settlements, splitEqually, tripBalances, tripExpensesTotal } from "@/lib/domain/trip-expenses";
import { eur, shortDate } from "@/lib/format";
import type { Trip } from "@/types/domain";

export function TripCollaboration({ trip }: { trip: Trip }) {
  const {
    data, userId, displayName, create, remove, inviteToTrip, localMode,
  } = useBudgyData();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [payer, setPayer] = useState(userId);
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  const members = data.tripMembers;
  const participants = useMemo(() => tripParticipants(trip, members), [members, trip]);
  const participantIds = participants.map((participant) => participant.userId);
  const canEdit = canEditTrip(trip, members, userId);
  const canManage = canManageTripMembers(trip, members, userId);

  const expenses = useMemo(
    () => data.tripExpenses.filter((expense) => expense.tripId === trip.id),
    [data.tripExpenses, trip.id],
  );
  const splits = useMemo(
    () => data.tripExpenseSplits.filter((split) => split.tripId === trip.id),
    [data.tripExpenseSplits, trip.id],
  );
  const participantKey = participantIds.join(",");
  const balances = useMemo(
    () => tripBalances(expenses, splits, participantIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- participantKey résume participantIds (tableau stable en valeur)
    [expenses, splits, participantKey],
  );
  const transfers = useMemo(() => settlements(balances), [balances]);
  const pending = members.filter((member) => member.tripId === trip.id && member.status === "pending");

  const openExpense = () => {
    setTitle("");
    setAmount(0);
    setPayer(userId);
    setSharedWith(participantIds);
    setExpenseOpen(true);
  };

  const saveExpense = () => {
    if (!title.trim() || amount <= 0 || sharedWith.length === 0) return;
    const expense = create("tripExpenses", {
      tripId: trip.id, paidBy: payer, title: title.trim(), amount,
      currency: "EUR", date: new Date().toISOString().slice(0, 10),
      category: "Général", note: "", createdAt: new Date().toISOString(),
    });
    // Chaque part est rattachée au participant concerné, pas à l'auteur de la saisie.
    for (const part of splitEqually(amount, sharedWith)) {
      create("tripExpenseSplits", {
        expenseId: expense.id, tripId: trip.id, amount: part.amount,
        isSettled: false, createdAt: new Date().toISOString(),
      }, { userId: part.userId });
    }
    setExpenseOpen(false);
  };

  const sendInvite = async () => {
    const value = handle.trim();
    if (!value) return;
    setInviteError("");
    setInviteStatus("Envoi…");
    try {
      const isEmail = value.includes("@");
      const result = await inviteToTrip(trip.id, {
        handle: isEmail ? undefined : value,
        email: isEmail ? value : undefined,
        role,
      });
      setInviteStatus(result.resolved
        ? "Invitation envoyée. La personne la verra dans ses notifications."
        : "Aucun compte Budgy ne correspond encore. L'invitation est en attente.");
      setHandle("");
    } catch {
      setInviteStatus("");
      setInviteError("L'invitation n'a pas pu être envoyée. Vérifiez le pseudo ou l'e-mail.");
    }
  };

  const toggleShare = (target: string) =>
    setSharedWith((current) =>
      current.includes(target) ? current.filter((item) => item !== target) : [...current, target],
    );

  const total = tripExpensesTotal(expenses);

  return (
    <>
      <section className="v2-card">
        <div className="v2-card-head">
          <div className="row">
            <V2Icon icon={Users} tone="purple" />
            <h2>Participants</h2>
          </div>
          {canManage ? (
            <button className="button button-soft" onClick={() => setInviteOpen(true)}>
              <UserPlus size={16} /> Ajouter
            </button>
          ) : null}
        </div>

        <div className="v2-avatars" style={{ marginBottom: 12 }}>
          {participants.map((participant) => (
            <V2Avatar key={participant.userId} name={displayName(participant.userId)} />
          ))}
        </div>

        {participants.map((participant) => (
          <div className="v2-row" key={participant.userId}>
            <V2Avatar name={displayName(participant.userId)} />
            <span className="v2-row-main">
              <strong>{displayName(participant.userId)}{participant.userId === userId ? " (vous)" : ""}</strong>
              <span>{roleLabel(participant.role)}</span>
            </span>
            {canManage && participant.role !== "owner" ? (
              <button
                className="icon-button" aria-label={`Retirer ${displayName(participant.userId)}`}
                onClick={() => {
                  const membership = members.find(
                    (member) => member.tripId === trip.id && member.userId === participant.userId,
                  );
                  if (membership) remove("tripMembers", membership.id);
                }}
              >
                <Trash2 size={17} />
              </button>
            ) : null}
          </div>
        ))}

        {pending.length > 0 ? (
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            {pending.length} invitation(s) en attente de réponse.
          </p>
        ) : null}
      </section>

      <section className="v2-card">
        <div className="v2-card-head">
          <div className="row">
            <V2Icon icon={Receipt} tone="green" />
            <h2>Dépenses en commun</h2>
          </div>
          {canEdit ? (
            <button className="button button-soft" onClick={openExpense}><Plus size={16} /> Ajouter</button>
          ) : null}
        </div>

        {expenses.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Aucune dépense partagée. Ajoutez-en une pour répartir automatiquement les parts.
          </p>
        ) : (
          <>
            {expenses.map((expense) => {
              const shares = splits.filter((split) => split.expenseId === expense.id);
              return (
                <div className="v2-row" key={expense.id}>
                  <V2Avatar name={displayName(expense.paidBy)} />
                  <span className="v2-row-main">
                    <strong>{expense.title}</strong>
                    <span>
                      Payé par {displayName(expense.paidBy)} · {shortDate(expense.date)}
                      {shares.length > 0 ? ` · ${eur.format(shares[0]!.amount)} / pers.` : ""}
                    </span>
                  </span>
                  <span className="v2-row-value">{eur.format(expense.amount)}</span>
                  {canEdit ? (
                    <button className="icon-button" aria-label="Supprimer la dépense" onClick={() => remove("tripExpenses", expense.id)}>
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <div className="spread" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--v2-line)" }}>
              <strong>Total partagé</strong>
              <strong className="accent">{eur.format(total)}</strong>
            </div>
          </>
        )}
      </section>

      {expenses.length > 0 ? (
        <section className="v2-card">
          <div className="v2-card-head">
            <div className="row">
              <V2Icon icon={Wallet} tone="cyan" />
              <h2>Comptes du voyage</h2>
            </div>
          </div>

          {balances.map((balance) => (
            <div className="v2-row" key={balance.userId}>
              <V2Avatar name={displayName(balance.userId)} />
              <span className="v2-row-main">
                <strong>{displayName(balance.userId)}</strong>
                <span>A payé {eur.format(balance.paid)} · doit {eur.format(balance.owed)}</span>
              </span>
              <span className={`v2-row-value ${balance.net >= 0 ? "positive" : "negative"}`}>
                {balance.net >= 0 ? "+" : "−"}{eur.format(Math.abs(balance.net))}
              </span>
            </div>
          ))}

          {transfers.length > 0 ? (
            <div className="v2-banner" style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <strong className="row"><ArrowLeftRight size={16} /> Pour solder les comptes</strong>
              {transfers.map((transfer) => (
                <span key={`${transfer.from}-${transfer.to}-${transfer.amount}`}>
                  {displayName(transfer.from)} doit {eur.format(transfer.amount)} à {displayName(transfer.to)}.
                </span>
              ))}
            </div>
          ) : (
            <p className="positive small" style={{ marginTop: 12, marginBottom: 0 }}>Tous les comptes sont équilibrés.</p>
          )}
        </section>
      ) : null}

      <FormModal
        open={inviteOpen} title="Inviter un participant" submitLabel="Envoyer"
        disableSubmit={!handle.trim()} onClose={() => { setInviteOpen(false); setInviteStatus(""); setInviteError(""); }}
        onSubmit={() => void sendInvite()}
        icon={UserPlus} tone="cyan"
      >
        <div className="form-grid">
          {localMode ? <p className="v2-banner">Les invitations nécessitent un compte Budgy synchronisé.</p> : null}
          <Field label="Pseudo Budgy ou e-mail">
            <input className="input" value={handle} placeholder="chloe ou chloe@exemple.com" onChange={(event) => setHandle(event.target.value)} />
          </Field>
          <Field label="Droits accordés">
            <div className="segmented">
              <button className={role === "editor" ? "active" : ""} onClick={() => setRole("editor")}>Peut modifier</button>
              <button className={role === "viewer" ? "active" : ""} onClick={() => setRole("viewer")}>Lecture seule</button>
            </div>
          </Field>
          <p className="muted small" style={{ margin: 0 }}>
            Un participant ne voit que ce voyage. Votre budget, vos loyers, vos business et vos autres voyages restent privés.
          </p>
          {inviteError ? <p className="error">{inviteError}</p> : null}
          {inviteStatus ? <p className="positive small">{inviteStatus}</p> : null}
        </div>
      </FormModal>

      <FormModal
        open={expenseOpen} title="Nouvelle dépense partagée" submitLabel="Ajouter"
        disableSubmit={!title.trim() || amount <= 0 || sharedWith.length === 0}
        onClose={() => setExpenseOpen(false)} onSubmit={saveExpense}
        icon={Receipt} tone="cyan"
      >
        <div className="form-grid">
          <Field label="Intitulé">
            <input className="input" value={title} placeholder="Hôtel, restaurant, taxi…" onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Montant total">
            <AmountField size="modal" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Payé par">
            <select className="select" value={payer} onChange={(event) => setPayer(event.target.value)}>
              {participants.map((participant) => (
                <option value={participant.userId} key={participant.userId}>{displayName(participant.userId)}</option>
              ))}
            </select>
          </Field>
          <h3 className="section-title" style={{ marginBottom: 0 }}>Partagé entre</h3>
          {participants.map((participant) => (
            <button
              type="button" className="card-flat spread" key={participant.userId}
              onClick={() => toggleShare(participant.userId)}
            >
              <strong>{displayName(participant.userId)}</strong>
              <span className={`status-dot ${sharedWith.includes(participant.userId) ? "active" : ""}`} />
            </button>
          ))}
          {sharedWith.length > 0 && amount > 0 ? (
            <p className="v2-banner">
              Division égale : {eur.format(amount / sharedWith.length)} par personne.
            </p>
          ) : null}
        </div>
      </FormModal>
    </>
  );
}
