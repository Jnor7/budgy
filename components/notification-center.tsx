"use client";

import { Bell, BellOff, Check, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/modal";
import { V2Icon } from "@/components/ui/v2";
import { useBudgyData } from "@/lib/data/data-provider";
import { shortDate } from "@/lib/format";

/**
 * Cloche + centre de notifications (§27, §42).
 * Ne génère aucune notification côté client : tout vient de la table `notifications`,
 * écrite exclusivement par les fonctions SECURITY DEFINER.
 */
export function NotificationCenter() {
  const { data, respondInvitation, respondTravelFriendRequest, markNotificationRead } = useBudgyData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");

  const notifications = useMemo(
    () => [...data.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.notifications],
  );
  const unread = notifications.filter((item) => !item.readAt).length;

  const answer = async (notificationId: string, invitationId: string, accept: boolean) => {
    setBusy(notificationId);
    setError("");
    try {
      await respondInvitation(invitationId, accept);
    } catch {
      setError("La réponse n'a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      setBusy(undefined);
    }
  };

  const answerFriend = async (notificationId: string, requestId: string, accept: boolean) => {
    setBusy(notificationId); setError("");
    try { await respondTravelFriendRequest(requestId, accept); }
    catch { setError("La réponse n'a pas pu être envoyée. Réessayez dans un instant."); }
    finally { setBusy(undefined); }
  };

  return (
    <>
      <button className="v2-bell" onClick={() => setOpen(true)} aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}>
        <Bell size={20} />
        {unread > 0 ? <span className="v2-bell-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      <Sheet open={open} title="Notifications" onClose={() => setOpen(false)}>
        <div className="stack-sm">
          {error ? <p className="error">{error}</p> : null}
          {notifications.length === 0 ? (
            <div className="v2-empty">
              <span className="v2-empty-icon"><BellOff size={26} /></span>
              <h3>Rien à signaler</h3>
              <p>Les invitations à un voyage et les échéances importantes apparaîtront ici.</p>
            </div>
          ) : null}

          {notifications.map((notification, index) => {
            const invitationId = typeof notification.payload?.invitation_id === "string"
              ? notification.payload.invitation_id
              : undefined;
            const friendRequestId = typeof notification.payload?.friend_request_id === "string" ? notification.payload.friend_request_id : undefined;
            const pending = notification.kind === "trip_invitation" && invitationId && !notification.readAt;
            const pendingFriend = notification.kind === "travel_friend_request" && friendRequestId && !notification.readAt;
            const day = new Date(notification.createdAt).toDateString();
            const previousDay = index > 0 ? new Date(notifications[index - 1]!.createdAt).toDateString() : "";
            const dayLabel = day === new Date().toDateString() ? "Aujourd’hui" : shortDate(notification.createdAt);
            return (
              <Fragment key={notification.id}>
              {day !== previousDay ? <h3 className="notification-day">{dayLabel}</h3> : null}
              <div className="v2-card v2-card-tight" style={{ opacity: notification.readAt ? .62 : 1 }}>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <V2Icon icon={Bell} tone={notification.kind === "trip_invitation" ? "purple" : "cyan"} />
                  <div className="list-main">
                    <strong>{notification.title}</strong>
                    {notification.body ? <div className="muted small">{notification.body}</div> : null}
                    <div className="muted small">{shortDate(notification.createdAt)}</div>
                  </div>
                </div>
                {pending ? (
                  <div className="grid-2" style={{ marginTop: 12 }}>
                    <button
                      className="button button-primary"
                      disabled={busy === notification.id}
                      onClick={() => void answer(notification.id, invitationId, true)}
                    >
                      <Check size={16} /> Accepter
                    </button>
                    <button
                      className="button button-danger"
                      disabled={busy === notification.id}
                      onClick={() => void answer(notification.id, invitationId, false)}
                    >
                      <X size={16} /> Refuser
                    </button>
                  </div>
                ) : pendingFriend ? (
                  <div className="grid-2" style={{ marginTop: 12 }}>
                    <button className="button button-primary" disabled={busy === notification.id} onClick={() => void answerFriend(notification.id, friendRequestId, true)}><Check size={16} /> Accepter</button>
                    <button className="button button-danger" disabled={busy === notification.id} onClick={() => void answerFriend(notification.id, friendRequestId, false)}><X size={16} /> Refuser</button>
                  </div>
                ) : !notification.readAt ? (
                  <button
                    className="button button-ghost"
                    style={{ marginTop: 8 }}
                    onClick={() => void markNotificationRead(notification.id)}
                  >
                    Marquer comme lu
                  </button>
                ) : null}
              </div></Fragment>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
