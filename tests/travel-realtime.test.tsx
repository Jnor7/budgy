import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useBudgyData } from "@/lib/data/data-provider";
import { emptyData } from "@/lib/data/seed";
import type { AppData, DirectoryProfile } from "@/types/domain";

/**
 * Ces tests exercent le vrai `DataProvider` (pas une réimplémentation) avec un
 * `NeonRepository` mocké, exactement comme `tests/data-provider-migration.test.tsx`.
 * Ils couvrent la régression ciblée par cette passe : lenteur perçue des
 * amis/invitations de voyage (optimistic UI, refresh ciblé, sondage adaptatif).
 */

vi.mock("@/lib/neon/config", () => ({ usesNeon: true, hasInvalidNeonMode: false }));

const USER_ID = "5dc4ad8a-6dd1-41df-95a8-2062084f1935";
const FRIEND_ID = "friend-profile-id";

const mocked = vi.hoisted(() => {
  let loadedData: AppData;
  return {
    client: {},
    setLoadedData: (data: AppData) => { loadedData = data; },
    loadAll: vi.fn(async () => structuredClone(loadedData)),
    loadTravel: vi.fn(async () => ({})),
    sendTravelFriendRequest: vi.fn(async () => ({ status: "sent" })),
    respondTravelFriendRequest: vi.fn(async () => ({ status: "accepted" })),
    removeTravelFriend: vi.fn(async () => undefined),
    inviteToTrip: vi.fn(async () => ({ status: "sent" })),
    respondInvitation: vi.fn(async () => ({ status: "accepted" })),
  };
});

vi.mock("@/lib/neon/client", () => ({ getNeonDataClient: () => mocked.client }));
vi.mock("@/lib/data/neon-repository", () => ({
  NeonRepository: vi.fn().mockImplementation(function RepositoryMock() {
    return {
      currentBudgyUserId: async () => USER_ID,
      loadAll: mocked.loadAll,
      loadTravel: mocked.loadTravel,
      loadProfile: async () => ({ userId: USER_ID, username: "Jnor7", avatarUrl: "", createdAt: "2026-01-01", updatedAt: "2026-01-01" }),
      loadDirectory: async () => [],
      setModules: async () => undefined,
      sendTravelFriendRequest: mocked.sendTravelFriendRequest,
      respondTravelFriendRequest: mocked.respondTravelFriendRequest,
      removeTravelFriend: mocked.removeTravelFriend,
      inviteToTrip: mocked.inviteToTrip,
      respondInvitation: mocked.respondInvitation,
    };
  }),
}));

const chloeProfile: DirectoryProfile = { userId: FRIEND_ID, username: "Chlo", avatarUrl: "" };

function Probe() {
  const {
    data, ready, sendTravelFriendRequest, respondTravelFriendRequest, removeTravelFriend,
    inviteToTrip, respondInvitation, registerFastPolling,
  } = useBudgyData();
  const incoming = data.travelFriendRequests.filter((request) => request.status === "pending" && request.recipientId === USER_ID);
  const outgoing = data.travelFriendRequests.filter((request) => request.status === "pending" && request.senderId === USER_ID);
  const friends = data.travelFriends;
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="outgoing-count">{outgoing.length}</span>
      <span data-testid="incoming-count">{incoming.length}</span>
      <span data-testid="friends-count">{friends.length}</span>
      <button onClick={() => { void sendTravelFriendRequest("chlo", chloeProfile).catch(() => undefined); }}>send</button>
      <button onClick={() => { void respondTravelFriendRequest("req-1", true).catch(() => undefined); }}>accept</button>
      <button onClick={() => { void removeTravelFriend("friend-row-1").catch(() => undefined); }}>remove-friend</button>
      <button onClick={() => { void inviteToTrip("trip-1", { handle: "chlo" }).catch(() => undefined); }}>invite</button>
      <button onClick={() => { void respondInvitation("invitation-1", true).catch(() => undefined); }}>respond-invitation</button>
      <button onClick={() => { const unregister = registerFastPolling(); (window as unknown as { __unregister?: () => void }).__unregister = unregister; }}>register-fast</button>
      <button onClick={() => { (window as unknown as { __unregister?: () => void }).__unregister?.(); }}>unregister-fast</button>
    </div>
  );
}

beforeEach(() => {
  mocked.setLoadedData(structuredClone(emptyData));
  mocked.loadAll.mockClear();
  mocked.loadTravel.mockClear();
  mocked.sendTravelFriendRequest.mockReset().mockResolvedValue({ status: "sent" });
  mocked.respondTravelFriendRequest.mockReset().mockResolvedValue({ status: "accepted" });
  mocked.removeTravelFriend.mockReset().mockResolvedValue(undefined);
  mocked.inviteToTrip.mockReset().mockResolvedValue({ status: "sent" });
  mocked.respondInvitation.mockReset().mockResolvedValue({ status: "accepted" });
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

async function renderReady() {
  render(<DataProvider><Probe /></DataProvider>);
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
}

describe("Amis de voyage — optimistic UI", () => {
  it("1. envoyer une demande d'ami affiche un etat optimiste immediatement, avant la resolution reseau", async () => {
    let resolveSend: (() => void) | undefined;
    mocked.sendTravelFriendRequest.mockImplementation(() => new Promise((resolve) => {
      resolveSend = () => resolve({ status: "sent" });
    }));
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    // Etat optimiste visible AVANT que la promesse reseau ne se resolve.
    await waitFor(() => expect(screen.getByTestId("outgoing-count").textContent).toBe("1"));
    expect(mocked.loadTravel).not.toHaveBeenCalled();

    resolveSend?.();
    await waitFor(() => expect(mocked.loadTravel).toHaveBeenCalledTimes(1));
  });

  it("2. une erreur backend annule l'etat optimiste (rollback)", async () => {
    mocked.sendTravelFriendRequest.mockRejectedValue(new Error("Pseudo introuvable"));
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(screen.getByTestId("outgoing-count").textContent).toBe("1"));

    await waitFor(() => expect(screen.getByTestId("outgoing-count").textContent).toBe("0"));
  });

  it("3. accepter une demande met a jour l'UI immediatement puis rafraichit les donnees Voyages", async () => {
    const seeded = structuredClone(emptyData);
    seeded.travelFriendRequests = [{ id: "req-1", senderId: FRIEND_ID, recipientId: USER_ID, status: "pending", createdAt: "2026-08-19T10:00:00.000Z" }];
    mocked.setLoadedData(seeded);
    let resolveRespond: (() => void) | undefined;
    mocked.respondTravelFriendRequest.mockImplementation(() => new Promise((resolve) => {
      resolveRespond = () => resolve({ status: "accepted" });
    }));
    await renderReady();
    await waitFor(() => expect(screen.getByTestId("incoming-count").textContent).toBe("1"));

    fireEvent.click(screen.getByRole("button", { name: "accept" }));

    // La demande disparait des demandes en attente et l'ami apparait, avant meme
    // que le reseau ne confirme.
    await waitFor(() => expect(screen.getByTestId("incoming-count").textContent).toBe("0"));
    expect(screen.getByTestId("friends-count").textContent).toBe("1");
    expect(mocked.loadTravel).not.toHaveBeenCalled();

    resolveRespond?.();
    await waitFor(() => expect(mocked.loadTravel).toHaveBeenCalledTimes(1));
  });

  it("supprimer un ami : optimiste, avec rollback si le serveur refuse", async () => {
    const seeded = structuredClone(emptyData);
    seeded.travelFriends = [{ id: "friend-row-1", userA: USER_ID, userB: FRIEND_ID, createdAt: "2026-08-19T10:00:00.000Z" }];
    mocked.setLoadedData(seeded);
    mocked.removeTravelFriend.mockRejectedValue(new Error("Introuvable"));
    await renderReady();
    await waitFor(() => expect(screen.getByTestId("friends-count").textContent).toBe("1"));

    fireEvent.click(screen.getByRole("button", { name: "remove-friend" }));
    await waitFor(() => expect(screen.getByTestId("friends-count").textContent).toBe("0"));
    // Rollback apres l'echec reseau.
    await waitFor(() => expect(screen.getByTestId("friends-count").textContent).toBe("1"));
  });
});

describe("Invitations de voyage — refresh cible", () => {
  it("4. inviteToTrip rafraichit uniquement les donnees Voyages (pas un reload complet)", async () => {
    await renderReady();
    mocked.loadAll.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "invite" }));
    await waitFor(() => expect(mocked.inviteToTrip).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocked.loadTravel).toHaveBeenCalledTimes(1));
    expect(mocked.loadAll).not.toHaveBeenCalled();
  });

  it("repondre a une invitation rafraichit uniquement les donnees Voyages", async () => {
    await renderReady();
    mocked.loadAll.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "respond-invitation" }));
    await waitFor(() => expect(mocked.respondInvitation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocked.loadTravel).toHaveBeenCalledTimes(1));
    expect(mocked.loadAll).not.toHaveBeenCalled();
  });
});

describe("Sondage adaptatif", () => {
  it("5. le sondage collaboratif accelere a ~2s quand un ecran est enregistre", async () => {
    vi.useFakeTimers();
    try {
      render(<DataProvider><Probe /></DataProvider>);
      await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"), { timeout: 5000 });
      mocked.loadTravel.mockClear();

      fireEvent.click(screen.getByRole("button", { name: "register-fast" }));

      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(mocked.loadTravel.mock.calls.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sans ecran collaboratif enregistre, le sondage reste au rythme lent (~7s), pas ~2s", async () => {
    vi.useFakeTimers();
    try {
      render(<DataProvider><Probe /></DataProvider>);
      await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"), { timeout: 5000 });
      mocked.loadTravel.mockClear();

      await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
      expect(mocked.loadTravel).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(mocked.loadTravel.mock.calls.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("6. le sondage est nettoye au demontage (aucun appel apres unmount)", async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<DataProvider><Probe /></DataProvider>);
      await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"), { timeout: 5000 });
      mocked.loadTravel.mockClear();

      act(() => { unmount(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
      expect(mocked.loadTravel).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("7. visibilitychange et focus declenchent un refresh immediat sans attendre le minuteur", async () => {
    await renderReady();
    mocked.loadTravel.mockClear();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(mocked.loadTravel).toHaveBeenCalledTimes(1));

    mocked.loadTravel.mockClear();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(mocked.loadTravel).toHaveBeenCalledTimes(1));
  });
});
