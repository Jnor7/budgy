"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getNeonDataClient } from "@/lib/neon/client";
import { hasInvalidNeonMode, usesNeon } from "@/lib/neon/config";
import { NeonRepository, type RemoteImportResult } from "@/lib/data/neon-repository";
import { enabledModuleKeys, modulesForHistoricalData, MODULE_KEYS } from "@/lib/modules/registry";
import type { AppData, AppDataKey, AppEntity, BusinessPaymentInput, BusinessStockAdjustmentInput, BusinessTransactionInput, DirectoryProfile, ModuleKey, Profile, TripCoverPatch } from "@/types/domain";
import { demoData, emptyData, LOCAL_USER_ID } from "@/lib/data/seed";
import type { Airport } from "@/lib/airports/airports";
import { allAirportCountries, type AirportCountry } from "@/lib/airports/countries";

const STORAGE_KEY = "budgy.local-data.v1";
const TRAVEL_KEYS = new Set<AppDataKey>([
  "trips", "flights", "accommodations", "tripActivities", "tripChecklistItems", "tripMembers",
  "tripInvitations", "notifications", "tripExpenses", "tripExpenseSplits", "travelFriendRequests", "travelFriends",
]);

type EntityFor<K extends AppDataKey> = AppData[K][number];
type SyncStatus = "idle" | "loading" | "syncing" | "error";

interface DataContextValue {
  data: AppData;
  ready: boolean;
  localMode: boolean;
  userId: string;
  syncStatus: SyncStatus;
  syncError: string;
  /** `options.userId` permet d'attribuer une ligne Ã  un autre participant (parts de dÃ©pense partagÃ©e). */
  create: <K extends AppDataKey>(key: K, payload: Omit<EntityFor<K>, "id" | "userId">, options?: { userId?: string }) => EntityFor<K>;
  update: <K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => void;
  updateAndWait: <K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => Promise<void>;
  updateTripCoverAndWait: (tripId: string, cover: TripCoverPatch) => Promise<void>;
  remove: <K extends AppDataKey>(key: K, id: string) => void;
  replaceAll: (data: AppData) => void;
  importArchive: (data: AppData, checksum: string) => Promise<RemoteImportResult>;
  resetDemo: () => void;
  reload: () => Promise<void>;
  // --- V2 ---
  /** Modules rÃ©ellement activÃ©s, dans l'ordre choisi par l'utilisateur. */
  modules: ModuleKey[];
  isModuleOn: (key: ModuleKey) => boolean;
  /** Aucune ligne user_modules : le compte n'a jamais choisi sa configuration. */
  modulesConfigured: boolean;
  setModules: (keys: ModuleKey[]) => Promise<void>;
  profile: Profile | null;
  directory: DirectoryProfile[];
  displayName: (userId: string) => string;
  avatarUrl: (userId: string) => string;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  inviteToTrip: (tripId: string, options: { handle?: string; email?: string; role?: "editor" | "viewer" }) => Promise<Record<string, unknown>>;
  respondInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  sendTravelFriendRequest: (handle: string, optimisticProfile?: DirectoryProfile) => Promise<Record<string, unknown>>;
  respondTravelFriendRequest: (requestId: string, accept: boolean) => Promise<void>;
  removeTravelFriend: (friendId: string) => Promise<void>;
  searchTravelProfiles: (query: string) => Promise<DirectoryProfile[]>;
  searchAirportDirectory: (query: string) => Promise<Airport[]>;
  loadAirportCountries: () => Promise<AirportCountry[]>;
  markNotificationRead: (id: string) => Promise<void>;
  saveBusinessTransaction: (input: BusinessTransactionInput) => Promise<string>;
  cancelBusinessTransaction: (transactionId: string) => Promise<void>;
  recordBusinessPayment: (input: BusinessPaymentInput) => Promise<string>;
  adjustBusinessStock: (input: BusinessStockAdjustmentInput) => Promise<void>;
  /** Alias explicite de `!localMode`, pour ne jamais confondre "configurÃ©" et "prÃªt". */
  neonConfigured: boolean;
  /**
   * Un repository Neon authentifiÃ© existe rÃ©ellement. Contrairement Ã  `ready`,
   * qui ne fait que constater la fin du premier essai (succÃ¨s ou Ã©chec), ce boolÃ©en
   * est la seule source de vÃ©ritÃ© fiable pour savoir si les opÃ©rations distantes
   * (dont `importArchive`) peuvent Ãªtre appelÃ©es sans Ã©chouer immÃ©diatement.
   */
  repositoryReady: boolean;
  /**
   * Un ecran fortement collaboratif (Amis, Membres du voyage, Voyage partage)
   * appelle ceci dans un effet au montage et execute la fonction retournee au
   * demontage. Tant qu'au moins un composant est enregistre, le sondage
   * d'arriere-plan des donnees Voyages passe d'environ 7s a ~2s. Le reste de
   * l'application n'est jamais sonde plus vite que necessaire.
   */
  registerFastPolling: () => () => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const cloneDemo = () => structuredClone(demoData);
/** Ajoute les collections introduites aprÃ¨s V1 sans demander de rÃ©import local. */
const parseStoredData = (raw: string): AppData => ({ ...structuredClone(emptyData), ...JSON.parse(raw) as Partial<AppData> });

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState(LOCAL_USER_ID);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  /**
   * Miroir rÃ©actif de `repositoryRef.current !== null`. Un `useRef` seul ne dÃ©clenche
   * jamais de re-rendu : sans cet Ã©tat, aucun composant ne peut savoir si le repository
   * distant est rÃ©ellement disponible, ce qui a permis au bug de l'Ã©cran Migration
   * distant est rÃ©ellement disponible.
   */
  const [repositoryReady, setRepositoryReady] = useState(false);
  const repositoryRef = useRef<NeonRepository | null>(null);
  // Compteur d'ecrans collaboratifs actuellement montes (Amis, Membres, Voyage
  // partage). >0 => le sondage d'arriere-plan accelere de ~7s a ~2s.
  const fastPollCountRef = useRef(0);
  // Reveille immediatement le minuteur en cours (annule + reprogramme au bon
  // delai) quand le mode rapide passe de 0 a >0 : sans ca, un ecran qui
  // s'enregistre juste apres la programmation du minuteur lent devrait
  // attendre jusqu'a 7s avant que l'acceleration ne prenne effet.
  const wakePollRef = useRef<(() => void) | null>(null);
  const pendingInsertsRef = useRef(new Map<string, Promise<void>>());
  const airportCountriesRef = useRef<AirportCountry[] | null>(null);
  const dataRef = useRef(data);
  const localMode = !usesNeon;
  const neonConfigured = !localMode;

  const reportError = useCallback((reason: unknown) => {
    if (process.env.NODE_ENV !== "production") console.error("[budgy-data]", reason);
    setSyncStatus("error");
    setSyncError(reason instanceof Error ? reason.message : "La synchronisation a échoué.");
  }, []);

  const reload = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    setSyncStatus("loading");
    try {
      const uid = await repository.currentBudgyUserId();
      let loaded = await repository.loadAll();
      const inferred = modulesForHistoricalData(loaded);
      if (loaded.userModules.length === 0 && inferred.length > 0) {
        await repository.setModules(uid, inferred);
        loaded = await repository.loadAll();
      }
      setUserId(uid);
      setData(loaded);
      setProfile(await repository.loadProfile(uid));
      setDirectory(await repository.loadDirectory().catch((reason) => {
        if (process.env.NODE_ENV !== "production") console.warn("[budgy-data] directory unavailable", reason);
        return [];
      }));
      setSyncError("");
      setSyncStatus("idle");
      setRepositoryReady(true);
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [reportError]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    let reloadInFlight = false;

    // Sondage adaptatif : un setTimeout recursif (au lieu d'un setInterval fixe)
    // relit fastPollCountRef a chaque tick, donc l'intervalle change des le
    // prochain passage sans avoir a recreer le minuteur.
    const schedulePoll = () => {
      if (cancelled) return;
      const delay = fastPollCountRef.current > 0 ? 2000 : 7000;
      pollTimer = window.setTimeout(() => { void refreshCollaborativeData().finally(schedulePoll); }, delay);
    };
    // Permet a registerFastPolling() d'interrompre un minuteur lent deja
    // programme et de reprogrammer immediatement au bon delai.
    wakePollRef.current = () => {
      if (pollTimer) window.clearTimeout(pollTimer);
      schedulePoll();
    };

    const refreshCollaborativeData = async () => {
      if (cancelled || document.visibilityState !== "visible" || reloadInFlight || !repositoryRef.current) return;
      reloadInFlight = true;
      try {
        const repository = repositoryRef.current;
        const [nextTravel, nextDirectory] = await Promise.all([
          repository.loadTravel(),
          repository.loadDirectory().catch(() => []),
        ]);
        if (!cancelled) {
          setData((current) => ({ ...current, ...nextTravel }));
          setDirectory(nextDirectory);
        }
      } catch (reason) {
        if (!cancelled) reportError(reason);
      } finally {
        reloadInFlight = false;
      }
    };

    /** CrÃ©e le repository, charge les donnÃ©es et bascule `repositoryReady` de faÃ§on rÃ©active. */
    const attachRepository = async (client: ReturnType<typeof getNeonDataClient>) => {
      if (!client || cancelled) return;
      const repository = new NeonRepository(client);
      repositoryRef.current = repository;
      try {
        await reload();
        if (cancelled) return;
        schedulePoll();
        window.addEventListener("focus", refreshCollaborativeData);
        document.addEventListener("visibilitychange", refreshCollaborativeData);
      } catch (reason) {
        if (!cancelled) setRepositoryReady(false);
        reportError(reason);
      }
    };

    /** Session perdue (dÃ©connexion) : on revient Ã  un Ã©tat "configurÃ© mais non connectÃ©". */
    const detachRepository = () => {
      repositoryRef.current = null;
      if (pollTimer) window.clearTimeout(pollTimer);
      wakePollRef.current = null;
      window.removeEventListener("focus", refreshCollaborativeData);
      document.removeEventListener("visibilitychange", refreshCollaborativeData);
      setRepositoryReady(false);
      setProfile(null);
      setDirectory([]);
    };

    const initialize = async () => {
      if (localMode) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        try { setData(raw ? parseStoredData(raw) : cloneDemo()); }
        catch { setData(cloneDemo()); }
        setSyncError(hasInvalidNeonMode ? "Le mode Neon est demandé mais les variables .env sont absentes." : "");
        setSyncStatus(hasInvalidNeonMode ? "error" : "idle");
        setReady(true);
        return;
      }

      const client = getNeonDataClient();
      if (!client) {
        reportError(new Error("Neon n'est pas configuré."));
        setReady(true);
        return;
      }

      try {
        await attachRepository(client);
      } catch (reason) {
        detachRepository();
        reportError(reason);
      }

      if (!cancelled) setReady(true);
    };

    void initialize();
    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
      wakePollRef.current = null;
      window.removeEventListener("focus", refreshCollaborativeData);
      document.removeEventListener("visibilitychange", refreshCollaborativeData);
    };
  }, [localMode, reload, reportError]);

  useEffect(() => {
    if (ready && localMode) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, localMode, ready]);

  const refreshTravelAfterMutation = useCallback(async (key: AppDataKey) => {
    const repository = repositoryRef.current;
    if (!repository || !TRAVEL_KEYS.has(key)) return;
    const nextTravel = await repository.loadTravel();
    setData((current) => ({ ...current, ...nextTravel }));
  }, []);

  // Rafraichissement Voyages cible, reutilise par les actions Amis/Invitations
  // dediees ci-dessous a la place d'un `reload()` complet (§2 : eviter de
  // recharger toute la base quand un refresh cible suffit).
  const refreshTravelNow = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const nextTravel = await repository.loadTravel();
    setData((current) => ({ ...current, ...nextTravel }));
  }, []);

  const registerFastPolling = useCallback(() => {
    const wasIdle = fastPollCountRef.current === 0;
    fastPollCountRef.current += 1;
    if (wasIdle) wakePollRef.current?.();
    return () => { fastPollCountRef.current = Math.max(0, fastPollCountRef.current - 1); };
  }, []);

  const create = useCallback(<K extends AppDataKey>(key: K, payload: Omit<EntityFor<K>, "id" | "userId">, options?: { userId?: string }) => {
    const entity = { ...payload, id: crypto.randomUUID(), userId: options?.userId ?? userId } as EntityFor<K>;
    setData((current) => ({ ...current, [key]: [...current[key], entity] } as AppData));
    const repository = repositoryRef.current;
    if (repository) {
      setSyncStatus("syncing");
      const insertion = repository.insert(key, entity as AppEntity).then(async () => {
        await refreshTravelAfterMutation(key);
        setSyncError("");
        setSyncStatus("idle");
      }).catch((reason: unknown) => {
        setData((current) => ({ ...current, [key]: current[key].filter((item) => item.id !== entity.id) } as AppData));
        reportError(reason);
      });
      pendingInsertsRef.current.set(entity.id, insertion);
      void insertion.finally(() => pendingInsertsRef.current.delete(entity.id));
    }
    return entity;
  }, [refreshTravelAfterMutation, reportError, userId]);

  const updateAndWait = useCallback(async <K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => {
    const previous = dataRef.current[key].find((entity) => entity.id === id);
    setData((current) => ({ ...current, [key]: current[key].map((entity) => entity.id === id ? { ...entity, ...patch } : entity) } as AppData));
    const repository = repositoryRef.current;
    if (repository) {
      setSyncStatus("syncing");
      const pendingInsert = pendingInsertsRef.current.get(id);
      const persistence = pendingInsert
        ? pendingInsert.then(() => repository.update(key, id, patch as Partial<AppEntity>))
        : repository.update(key, id, patch as Partial<AppEntity>);
      try {
        await persistence;
        await refreshTravelAfterMutation(key);
        setSyncError("");
        setSyncStatus("idle");
      } catch (reason) {
        if (previous) setData((current) => ({ ...current, [key]: current[key].map((item) => item.id === id ? previous : item) } as AppData));
        reportError(reason);
        throw reason;
      }
    }
  }, [refreshTravelAfterMutation, reportError]);

  const update = useCallback(<K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => {
    void updateAndWait(key, id, patch).catch(() => undefined);
  }, [updateAndWait]);

  const updateTripCoverAndWait = useCallback(async (tripId: string, cover: TripCoverPatch) => {
    const previous = dataRef.current.trips.find((trip) => trip.id === tripId);
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) => trip.id === tripId ? { ...trip, ...cover } : trip),
    }));
    const repository = repositoryRef.current;
    if (!repository) return;
    setSyncStatus("syncing");
    try {
      await pendingInsertsRef.current.get(tripId);
      const persisted = await repository.updateTripCover(tripId, cover);
      setData((current) => ({
        ...current,
        trips: current.trips.map((trip) => trip.id === tripId ? { ...trip, ...persisted } : trip),
      }));
      setSyncError("");
      setSyncStatus("idle");
    } catch (reason) {
      if (previous) setData((current) => ({
        ...current,
        trips: current.trips.map((trip) => trip.id === tripId ? previous : trip),
      }));
      reportError(reason);
      throw reason;
    }
  }, [reportError]);

  const remove = useCallback(<K extends AppDataKey>(key: K, id: string) => {
    let removed: EntityFor<K> | undefined;
    let index = -1;
    setData((current) => {
      index = current[key].findIndex((entity) => entity.id === id);
      removed = current[key][index];
      return { ...current, [key]: current[key].filter((entity) => entity.id !== id) } as AppData;
    });
    const repository = repositoryRef.current;
    if (repository) {
      setSyncStatus("syncing");
      void repository.remove(key, id).then(async () => {
        await refreshTravelAfterMutation(key);
        setSyncError("");
        setSyncStatus("idle");
      }).catch((reason: unknown) => {
        if (removed) setData((current) => {
          const restored = [...current[key]] as EntityFor<K>[];
          restored.splice(Math.max(index, 0), 0, removed as EntityFor<K>);
          return { ...current, [key]: restored } as AppData;
        });
        reportError(reason);
      });
    }
  }, [refreshTravelAfterMutation, reportError]);

  const importArchive = useCallback(async (incoming: AppData, checksum: string) => {
    // Ordre de vÃ©rification volontaire : on distingue "pas configurÃ©" (A) de
    // "configurÃ© mais pas encore prÃªt" (B) â€” voir lib/data/migration-state.ts.
    if (localMode) {
      throw new Error(
        "L’import distant nécessite Neon. Ce compte fonctionne en mode local : l’import restera sur cet appareil.",
      );
    }
    const repository = repositoryRef.current;
    if (!repository) {
      throw new Error(
        ready
          ? "Import impossible : vous devez être connecté à Neon. Reconnectez-vous puis réessayez."
          : "Import impossible : connexion à Neon en cours, réessayez dans un instant.",
      );
    }
    setSyncStatus("syncing");
    try {
      const result = await repository.importArchive(incoming, checksum);
      await reload();
      return result;
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [localMode, ready, reload, reportError]);

  const inferredModules = useMemo(() => modulesForHistoricalData(data), [data]);
  const modules = useMemo(
    () => data.userModules.length > 0 ? enabledModuleKeys(data.userModules) : inferredModules,
    [data.userModules, inferredModules],
  );
  const modulesConfigured = data.userModules.length > 0 || inferredModules.length > 0;

  const setModules = useCallback(async (keys: ModuleKey[]) => {
    const now = new Date().toISOString();
    const orderedKeys = [...keys, ...MODULE_KEYS.filter((key) => !keys.includes(key))];
    const rows = orderedKeys.map((moduleKey, index) => {
      const existing = data.userModules.find((item) => item.moduleKey === moduleKey);
      return {
        id: existing?.id ?? `${userId}-${moduleKey}-${index}`,
        userId,
        moduleKey,
        enabled: keys.includes(moduleKey),
        sortOrder: index,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    });
    setData((current) => ({ ...current, userModules: rows } as AppData));
    const repository = repositoryRef.current;
    if (!repository) return;
    setSyncStatus("syncing");
    try {
      await repository.setModules(userId, keys);
      setProfile((current) => (current ? { ...current, modulesConfiguredAt: now } : current));
      setSyncError("");
      setSyncStatus("idle");
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [data.userModules, reportError, userId]);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      await repository.updateProfile(userId, patch);
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [reportError, userId]);

  const inviteToTrip = useCallback(async (
    tripId: string,
    options: { handle?: string; email?: string; role?: "editor" | "viewer" },
  ) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les invitations nécessitent le mode Neon.");
    const result = await repository.inviteToTrip(tripId, options);
    // Refresh cible : une invitation ne modifie que les donnees Voyages, pas
    // besoin d'un reload() complet de toute la base.
    await refreshTravelNow();
    return result;
  }, [refreshTravelNow]);

  const respondInvitation = useCallback(async (invitationId: string, accept: boolean) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les invitations nécessitent le mode Neon.");
    // Optimiste : la notification correspondante disparait des actions en
    // attente immediatement (meme mecanisme que markNotificationRead), avant
    // meme la confirmation reseau. Restauree si l'appel echoue.
    const previousNotifications = dataRef.current.notifications;
    const respondedAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        typeof item.payload?.invitation_id === "string" && item.payload.invitation_id === invitationId && !item.readAt
          ? { ...item, readAt: respondedAt }
          : item,
      ),
    }));
    try {
      await repository.respondInvitation(invitationId, accept);
      await refreshTravelNow();
    } catch (reason) {
      setData((current) => ({ ...current, notifications: previousNotifications }));
      reportError(reason);
      throw reason;
    }
  }, [refreshTravelNow, reportError]);

  const sendTravelFriendRequest = useCallback(async (handle: string, optimisticProfile?: DirectoryProfile) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les amis de voyage nécessitent le mode Neon.");
    // Optimiste seulement si l'appelant a deja resolu le profil cible (recherche
    // effectuee avant l'envoi) : on connait alors un vrai userId, pas seulement
    // un pseudo tape, donc la ligne temporaire est fiable.
    let optimisticId: string | undefined;
    if (optimisticProfile) {
      optimisticId = `optimistic-${crypto.randomUUID()}`;
      const createdAt = new Date().toISOString();
      const pendingRequest = { id: optimisticId, senderId: userId, recipientId: optimisticProfile.userId, status: "pending" as const, createdAt };
      setData((current) => ({ ...current, travelFriendRequests: [...current.travelFriendRequests, pendingRequest] }));
    }
    try {
      const result = await repository.sendTravelFriendRequest(handle);
      await refreshTravelNow();
      return result;
    } catch (reason) {
      if (optimisticId) {
        const idToRemove = optimisticId;
        setData((current) => ({ ...current, travelFriendRequests: current.travelFriendRequests.filter((item) => item.id !== idToRemove) }));
      }
      reportError(reason);
      throw reason;
    }
  }, [refreshTravelNow, reportError, userId]);

  const respondTravelFriendRequest = useCallback(async (requestId: string, accept: boolean) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les amis de voyage nécessitent le mode Neon.");
    const previousRequests = dataRef.current.travelFriendRequests;
    const previousFriends = dataRef.current.travelFriends;
    const previousNotifications = dataRef.current.notifications;
    const request = previousRequests.find((item) => item.id === requestId);
    const respondedAt = new Date().toISOString();
    let optimisticFriendId: string | undefined;
    setData((current) => {
      let nextFriends = current.travelFriends;
      if (accept && request) {
        optimisticFriendId = `optimistic-${crypto.randomUUID()}`;
        nextFriends = [...nextFriends, { id: optimisticFriendId, userA: request.senderId, userB: request.recipientId, createdAt: respondedAt }];
      }
      return {
        ...current,
        travelFriendRequests: current.travelFriendRequests.map((item) =>
          item.id === requestId ? { ...item, status: accept ? ("accepted" as const) : ("declined" as const), respondedAt } : item,
        ),
        travelFriends: nextFriends,
        notifications: current.notifications.map((item) =>
          typeof item.payload?.friend_request_id === "string" && item.payload.friend_request_id === requestId && !item.readAt
            ? { ...item, readAt: respondedAt }
            : item,
        ),
      };
    });
    try {
      await repository.respondTravelFriendRequest(requestId, accept);
      await refreshTravelNow();
    } catch (reason) {
      setData((current) => ({
        ...current,
        travelFriendRequests: previousRequests,
        travelFriends: previousFriends,
        notifications: previousNotifications,
      }));
      reportError(reason);
      throw reason;
    }
  }, [refreshTravelNow, reportError]);

  const removeTravelFriend = useCallback(async (friendId: string) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les amis de voyage nécessitent le mode Neon.");
    const previousFriends = dataRef.current.travelFriends;
    setData((current) => ({ ...current, travelFriends: current.travelFriends.filter((item) => item.id !== friendId) }));
    try {
      await repository.removeTravelFriend(friendId);
      await refreshTravelNow();
    } catch (reason) {
      setData((current) => ({ ...current, travelFriends: previousFriends }));
      reportError(reason);
      throw reason;
    }
  }, [refreshTravelNow, reportError]);

  const searchTravelProfiles = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const repository = repositoryRef.current;
    if (!repository) {
      return directory.filter((candidate) => candidate.username.toLocaleLowerCase("fr-FR").startsWith(normalized.toLocaleLowerCase("fr-FR"))).slice(0, 6);
    }
    return repository.searchTravelProfiles(normalized, 6);
  }, [directory]);

  const searchAirportDirectory = useCallback(async (query: string) => {
    if (query.trim().length < 2) return [];
    return repositoryRef.current?.searchAirports(query).catch(() => []) ?? [];
  }, []);

  const loadAirportCountries = useCallback(async () => {
    if (airportCountriesRef.current) return airportCountriesRef.current;
    const repository = repositoryRef.current;
    const countries = repository
      ? await repository.listAirportCountries().catch(() => allAirportCountries)
      : allAirportCountries;
    airportCountriesRef.current = countries;
    return countries;
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const markNotificationRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => item.id === id ? { ...item, readAt } : item),
    } as AppData));
    await repositoryRef.current?.markNotificationRead(id).catch(reportError);
  }, [reportError]);

  const displayName = useCallback((target: string) => {
    if (target === userId) return profile?.username ?? "Moi";
    return directory.find((item) => item.userId === target)?.username ?? "Participant";
  }, [directory, profile?.username, userId]);

  const avatarUrl = useCallback((target: string) => {
    if (target === userId) return profile?.avatarUrl ?? "";
    return directory.find((item) => item.userId === target)?.avatarUrl ?? "";
  }, [directory, profile?.avatarUrl, userId]);

  const refreshBusinessNow = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("La gestion transactionnelle Business nécessite Neon.");
    const partial = await repository.loadBusiness();
    setData((current) => ({ ...current, ...partial }));
  }, []);

  const saveBusinessTransaction = useCallback(async (input: BusinessTransactionInput) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("La gestion transactionnelle Business nécessite Neon.");
    setSyncStatus("syncing");
    try {
      const id = await repository.saveBusinessTransaction(input);
      await refreshBusinessNow();
      setSyncError(""); setSyncStatus("idle");
      return id;
    } catch (reason) { reportError(reason); throw reason; }
  }, [refreshBusinessNow, reportError]);

  const cancelBusinessTransaction = useCallback(async (transactionId: string) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("La gestion transactionnelle Business nécessite Neon.");
    setSyncStatus("syncing");
    try {
      await repository.cancelBusinessTransaction(transactionId);
      await refreshBusinessNow();
      setSyncError(""); setSyncStatus("idle");
    } catch (reason) { reportError(reason); throw reason; }
  }, [refreshBusinessNow, reportError]);

  const recordBusinessPayment = useCallback(async (input: BusinessPaymentInput) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("La gestion transactionnelle Business nécessite Neon.");
    setSyncStatus("syncing");
    try {
      const id = await repository.recordBusinessPayment(input);
      await refreshBusinessNow();
      setSyncError(""); setSyncStatus("idle");
      return id;
    } catch (reason) { reportError(reason); throw reason; }
  }, [refreshBusinessNow, reportError]);

  const adjustBusinessStock = useCallback(async (input: BusinessStockAdjustmentInput) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("La gestion transactionnelle Business nécessite Neon.");
    setSyncStatus("syncing");
    try {
      await pendingInsertsRef.current.get(input.itemId);
      await repository.adjustBusinessStock(input);
      await refreshBusinessNow();
      setSyncError(""); setSyncStatus("idle");
    } catch (reason) { reportError(reason); throw reason; }
  }, [refreshBusinessNow, reportError]);

  const value = useMemo<DataContextValue>(() => ({
    data, ready, localMode, userId, syncStatus, syncError, create, update, updateAndWait, updateTripCoverAndWait, remove,
    replaceAll: setData,
    importArchive,
    resetDemo: () => setData(cloneDemo()),
    reload,
    modules,
    isModuleOn: (key: ModuleKey) => modules.includes(key),
    modulesConfigured,
    setModules,
    profile,
    directory,
    displayName,
    avatarUrl,
    saveProfile,
    inviteToTrip,
    respondInvitation,
    sendTravelFriendRequest,
    respondTravelFriendRequest,
    removeTravelFriend,
    searchTravelProfiles,
    searchAirportDirectory,
    loadAirportCountries,
    markNotificationRead,
    saveBusinessTransaction,
    cancelBusinessTransaction,
    recordBusinessPayment,
    adjustBusinessStock,
    neonConfigured,
    repositoryReady,
    registerFastPolling,
  }), [
    avatarUrl, create, data, directory, displayName, importArchive, inviteToTrip, localMode, markNotificationRead,
    modules, modulesConfigured, profile, ready, reload, remove, repositoryReady, registerFastPolling, respondInvitation, saveProfile,
    saveBusinessTransaction, cancelBusinessTransaction, recordBusinessPayment, adjustBusinessStock,
    respondTravelFriendRequest, removeTravelFriend, searchAirportDirectory, loadAirportCountries, searchTravelProfiles, sendTravelFriendRequest,
    setModules, neonConfigured, syncError, syncStatus, update, updateAndWait, updateTripCoverAndWait, userId,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useBudgyData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useBudgyData must be used inside DataProvider");
  return context;
}

