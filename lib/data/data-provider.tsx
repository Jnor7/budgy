"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasInvalidSupabaseMode, usesSupabase } from "@/lib/supabase/config";
import { SupabaseRepository, type RemoteImportResult } from "@/lib/data/supabase-repository";
import { enabledModuleKeys, MODULE_KEYS } from "@/lib/modules/registry";
import type { AppData, AppDataKey, AppEntity, DirectoryProfile, ModuleKey, Profile } from "@/types/domain";
import { demoData, emptyData, LOCAL_USER_ID } from "@/lib/data/seed";
import type { Airport } from "@/lib/airports/airports";

const STORAGE_KEY = "budgy.local-data.v1";

type EntityFor<K extends AppDataKey> = AppData[K][number];
type SyncStatus = "idle" | "loading" | "syncing" | "error";

interface DataContextValue {
  data: AppData;
  ready: boolean;
  localMode: boolean;
  userId: string;
  syncStatus: SyncStatus;
  syncError: string;
  /** `options.userId` permet d'attribuer une ligne à un autre participant (parts de dépense partagée). */
  create: <K extends AppDataKey>(key: K, payload: Omit<EntityFor<K>, "id" | "userId">, options?: { userId?: string }) => EntityFor<K>;
  update: <K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => void;
  remove: <K extends AppDataKey>(key: K, id: string) => void;
  replaceAll: (data: AppData) => void;
  importArchive: (data: AppData, checksum: string) => Promise<RemoteImportResult>;
  resetDemo: () => void;
  reload: () => Promise<void>;
  // --- V2 ---
  /** Modules réellement activés, dans l'ordre choisi par l'utilisateur. */
  modules: ModuleKey[];
  isModuleOn: (key: ModuleKey) => boolean;
  /** Aucune ligne user_modules : le compte n'a jamais choisi sa configuration. */
  modulesConfigured: boolean;
  setModules: (keys: ModuleKey[]) => Promise<void>;
  profile: Profile | null;
  directory: DirectoryProfile[];
  displayName: (userId: string) => string;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  inviteToTrip: (tripId: string, options: { handle?: string; email?: string; role?: "editor" | "viewer" }) => Promise<Record<string, unknown>>;
  respondInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  sendTravelFriendRequest: (handle: string) => Promise<Record<string, unknown>>;
  respondTravelFriendRequest: (requestId: string, accept: boolean) => Promise<void>;
  removeTravelFriend: (friendId: string) => Promise<void>;
  searchAirportDirectory: (query: string) => Promise<Airport[]>;
  markNotificationRead: (id: string) => Promise<void>;
  /** Alias explicite de `!localMode`, pour ne jamais confondre "configuré" et "prêt". */
  supabaseConfigured: boolean;
  /**
   * Un `SupabaseRepository` authentifié existe réellement. Contrairement à `ready`,
   * qui ne fait que constater la fin du premier essai (succès ou échec), ce booléen
   * est la seule source de vérité fiable pour savoir si les opérations distantes
   * (dont `importArchive`) peuvent être appelées sans échouer immédiatement.
   */
  repositoryReady: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);
const cloneDemo = () => structuredClone(demoData);
/** Ajoute les collections introduites après V1 sans demander de réimport local. */
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
   * Miroir réactif de `repositoryRef.current !== null`. Un `useRef` seul ne déclenche
   * jamais de re-rendu : sans cet état, aucun composant ne peut savoir si le repository
   * distant est réellement disponible, ce qui a permis au bug de l'écran Migration
   * (import bloqué avec un message trompeur) — voir docs/BUGFIX_MIGRATION_SUPABASE.md.
   */
  const [repositoryReady, setRepositoryReady] = useState(false);
  const repositoryRef = useRef<SupabaseRepository | null>(null);
  const pendingInsertsRef = useRef(new Map<string, Promise<void>>());
  const localMode = !usesSupabase;
  const supabaseConfigured = !localMode;

  const reportError = useCallback((reason: unknown) => {
    setSyncStatus("error");
    setSyncError(reason instanceof Error ? reason.message : "La synchronisation a échoué.");
  }, []);

  const reload = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    setSyncStatus("loading");
    try {
      setData(await repository.loadAll());
      setDirectory(await repository.loadDirectory().catch(() => []));
      setSyncError("");
      setSyncStatus("idle");
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [reportError]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeRealtime: (() => void) | undefined;
    let realtimeTimer: number | undefined;

    const queueTravelReload = () => {
      if (realtimeTimer) window.clearTimeout(realtimeTimer);
      realtimeTimer = window.setTimeout(() => { if (!cancelled) void reload(); }, 180);
    };

    /** Crée le repository, charge les données et bascule `repositoryReady` de façon réactive. */
    const attachRepository = async (client: ReturnType<typeof getSupabaseBrowserClient>, uid: string) => {
      if (!client || cancelled) return;
      const repository = new SupabaseRepository(client);
      repositoryRef.current = repository;
      setUserId(uid);
      setSyncStatus("loading");
      try {
        setData(await repository.loadAll());
        setProfile(await repository.loadProfile(uid).catch(() => null));
        setDirectory(await repository.loadDirectory().catch(() => []));
        setSyncError("");
        setSyncStatus("idle");
        if (!cancelled) setRepositoryReady(true);
        unsubscribeRealtime?.();
        if (typeof client.channel !== "function") return;
        const travelChannel = client.channel(`budgy-travel-${uid}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "flights" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "accommodations" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "trip_activities" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "trip_checklist_items" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "trip_members" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "trip_expenses" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "trip_expense_splits" }, queueTravelReload)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, queueTravelReload)
          .subscribe();
        unsubscribeRealtime = () => { void client.removeChannel(travelChannel); };
      } catch (reason) {
        repositoryRef.current = null;
        if (!cancelled) setRepositoryReady(false);
        reportError(reason);
      }
    };

    /** Session perdue (déconnexion) : on revient à un état "configuré mais non connecté". */
    const detachRepository = () => {
      repositoryRef.current = null;
      unsubscribeRealtime?.();
      unsubscribeRealtime = undefined;
      setRepositoryReady(false);
      setProfile(null);
      setDirectory([]);
    };

    const initialize = async () => {
      if (localMode) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        try { setData(raw ? parseStoredData(raw) : cloneDemo()); }
        catch { setData(cloneDemo()); }
        setSyncError(hasInvalidSupabaseMode ? "Le mode Supabase est demandé mais les variables .env sont absentes." : "");
        setSyncStatus(hasInvalidSupabaseMode ? "error" : "idle");
        setReady(true);
        return;
      }

      const client = getSupabaseBrowserClient();
      if (!client) {
        reportError(new Error("Supabase n'est pas configuré."));
        setReady(true);
        return;
      }

      // Rattrapage : si la vérification initiale (ci-dessous) est lente, échoue
      // transitoirement, ou si le token est rafraîchi/la session apparaît plus tard,
      // cet écouteur (re)construit le repository sans jamais laisser `repositoryReady`
      // bloqué à `false` alors qu'une session valide existe.
      const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (session?.user && !repositoryRef.current) {
          void attachRepository(client, session.user.id);
        } else if (!session?.user && repositoryRef.current) {
          detachRepository();
        }
        void event;
      });
      unsubscribe = () => subscription.subscription.unsubscribe();

      const { data: authData, error } = await client.auth.getUser();
      if (cancelled) return;
      if (error || !authData.user) {
        // Pas d'erreur définitive : l'écouteur ci-dessus peut encore rattraper la session
        // (ex. cookies pas tout à fait synchronisés au tout premier rendu).
        reportError(error ?? new Error("Session Supabase absente."));
        setReady(true);
        return;
      }

      await attachRepository(client, authData.user.id);
      if (!cancelled) setReady(true);
    };

    void initialize();
    return () => { cancelled = true; unsubscribe?.(); unsubscribeRealtime?.(); if (realtimeTimer) window.clearTimeout(realtimeTimer); };
  }, [localMode, reload, reportError]);

  useEffect(() => {
    if (ready && localMode) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, localMode, ready]);

  const create = useCallback(<K extends AppDataKey>(key: K, payload: Omit<EntityFor<K>, "id" | "userId">, options?: { userId?: string }) => {
    const entity = { ...payload, id: crypto.randomUUID(), userId: options?.userId ?? userId } as EntityFor<K>;
    setData((current) => ({ ...current, [key]: [...current[key], entity] } as AppData));
    const repository = repositoryRef.current;
    if (repository) {
      setSyncStatus("syncing");
      const insertion = repository.insert(key, entity as AppEntity).then(() => {
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
  }, [reportError, userId]);

  const update = useCallback(<K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => {
    let previous: EntityFor<K> | undefined;
    setData((current) => {
      previous = current[key].find((entity) => entity.id === id);
      return { ...current, [key]: current[key].map((entity) => entity.id === id ? { ...entity, ...patch } : entity) } as AppData;
    });
    const repository = repositoryRef.current;
    if (repository) {
      setSyncStatus("syncing");
      const pendingInsert = pendingInsertsRef.current.get(id);
      const persistence = pendingInsert
        ? pendingInsert.then(() => repository.update(key, id, patch as Partial<AppEntity>))
        : repository.update(key, id, patch as Partial<AppEntity>);
      void persistence.then(() => {
        setSyncError("");
        setSyncStatus("idle");
      }).catch((reason: unknown) => {
        if (previous) setData((current) => ({ ...current, [key]: current[key].map((item) => item.id === id ? previous : item) } as AppData));
        reportError(reason);
      });
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
      void repository.remove(key, id).then(() => {
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
  }, [reportError]);

  const importArchive = useCallback(async (incoming: AppData, checksum: string) => {
    // Ordre de vérification volontaire : on distingue "pas configuré" (A) de
    // "configuré mais pas encore prêt" (B) — voir lib/data/migration-state.ts.
    if (localMode) {
      throw new Error(
        "L’import distant nécessite Supabase. Ce compte fonctionne en mode local : l’import restera sur cet appareil.",
      );
    }
    const repository = repositoryRef.current;
    if (!repository) {
      throw new Error(
        ready
          ? "Import impossible : vous devez être connecté à Supabase. Reconnectez-vous puis réessayez."
          : "Import impossible : connexion à Supabase en cours, réessayez dans un instant.",
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

  const modules = useMemo(() => enabledModuleKeys(data.userModules), [data.userModules]);
  const modulesConfigured = data.userModules.length > 0;

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
    if (!repository) throw new Error("Les invitations nécessitent le mode Supabase.");
    const result = await repository.inviteToTrip(tripId, options);
    await reload();
    return result;
  }, [reload]);

  const respondInvitation = useCallback(async (invitationId: string, accept: boolean) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les invitations nécessitent le mode Supabase.");
    await repository.respondInvitation(invitationId, accept);
    await reload();
  }, [reload]);

  const sendTravelFriendRequest = useCallback(async (handle: string) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les amis de voyage nécessitent le mode Supabase.");
    const result = await repository.sendTravelFriendRequest(handle);
    await reload();
    return result;
  }, [reload]);

  const respondTravelFriendRequest = useCallback(async (requestId: string, accept: boolean) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les amis de voyage nécessitent le mode Supabase.");
    await repository.respondTravelFriendRequest(requestId, accept);
    await reload();
  }, [reload]);

  const removeTravelFriend = useCallback(async (friendId: string) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Les amis de voyage nécessitent le mode Supabase.");
    await repository.removeTravelFriend(friendId);
    await reload();
  }, [reload]);

  const searchAirportDirectory = useCallback(async (query: string) => {
    if (query.trim().length < 2) return [];
    return repositoryRef.current?.searchAirports(query).catch(() => []) ?? [];
  }, []);

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

  const value = useMemo<DataContextValue>(() => ({
    data, ready, localMode, userId, syncStatus, syncError, create, update, remove,
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
    saveProfile,
    inviteToTrip,
    respondInvitation,
    sendTravelFriendRequest,
    respondTravelFriendRequest,
    removeTravelFriend,
    searchAirportDirectory,
    markNotificationRead,
    supabaseConfigured,
    repositoryReady,
  }), [
    create, data, directory, displayName, importArchive, inviteToTrip, localMode, markNotificationRead,
    modules, modulesConfigured, profile, ready, reload, remove, repositoryReady, respondInvitation, saveProfile,
    respondTravelFriendRequest, removeTravelFriend, searchAirportDirectory, sendTravelFriendRequest,
    setModules, supabaseConfigured, syncError, syncStatus, update, userId,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useBudgyData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useBudgyData must be used inside DataProvider");
  return context;
}
