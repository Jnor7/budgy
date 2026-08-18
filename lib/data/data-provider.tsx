"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasInvalidSupabaseMode, usesSupabase } from "@/lib/supabase/config";
import { SupabaseRepository, type RemoteImportResult } from "@/lib/data/supabase-repository";
import type { AppData, AppDataKey, AppEntity } from "@/types/domain";
import { demoData, emptyData, LOCAL_USER_ID } from "@/lib/data/seed";

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
  create: <K extends AppDataKey>(key: K, payload: Omit<EntityFor<K>, "id" | "userId">) => EntityFor<K>;
  update: <K extends AppDataKey>(key: K, id: string, patch: Partial<EntityFor<K>>) => void;
  remove: <K extends AppDataKey>(key: K, id: string) => void;
  replaceAll: (data: AppData) => void;
  importArchive: (data: AppData, checksum: string) => Promise<RemoteImportResult>;
  resetDemo: () => void;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);
const cloneDemo = () => structuredClone(demoData);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState(LOCAL_USER_ID);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const repositoryRef = useRef<SupabaseRepository | null>(null);
  const localMode = !usesSupabase;

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
      setSyncError("");
      setSyncStatus("idle");
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [reportError]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      if (localMode) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        try { setData(raw ? JSON.parse(raw) as AppData : cloneDemo()); }
        catch { setData(cloneDemo()); }
        setSyncError(hasInvalidSupabaseMode ? "Le mode Supabase est demandé mais les variables .env sont absentes." : "");
        setSyncStatus(hasInvalidSupabaseMode ? "error" : "idle");
        setReady(true);
        return;
      }

      const client = getSupabaseBrowserClient();
      if (!client) {
        reportError(new Error("Supabase n’est pas configuré."));
        setReady(true);
        return;
      }
      const { data: authData, error } = await client.auth.getUser();
      if (cancelled) return;
      if (error || !authData.user) {
        reportError(error ?? new Error("Session Supabase absente."));
        setReady(true);
        return;
      }
      setUserId(authData.user.id);
      repositoryRef.current = new SupabaseRepository(client);
      try {
        setData(await repositoryRef.current.loadAll());
        setSyncStatus("idle");
      } catch (reason) {
        reportError(reason);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [localMode, reportError]);

  useEffect(() => {
    if (ready && localMode) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, localMode, ready]);

  const create = useCallback(<K extends AppDataKey>(key: K, payload: Omit<EntityFor<K>, "id" | "userId">) => {
    const entity = { ...payload, id: crypto.randomUUID(), userId } as EntityFor<K>;
    setData((current) => ({ ...current, [key]: [...current[key], entity] } as AppData));
    const repository = repositoryRef.current;
    if (repository) {
      setSyncStatus("syncing");
      void repository.insert(key, entity as AppEntity).then(() => {
        setSyncError("");
        setSyncStatus("idle");
      }).catch((reason: unknown) => {
        setData((current) => ({ ...current, [key]: current[key].filter((item) => item.id !== entity.id) } as AppData));
        reportError(reason);
      });
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
      void repository.update(key, id, patch as Partial<AppEntity>).then(() => {
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
    const repository = repositoryRef.current;
    if (!repository) throw new Error("L’import distant nécessite le mode Supabase.");
    setSyncStatus("syncing");
    try {
      const result = await repository.importArchive(incoming, checksum);
      await reload();
      return result;
    } catch (reason) {
      reportError(reason);
      throw reason;
    }
  }, [reload, reportError]);

  const value = useMemo<DataContextValue>(() => ({
    data, ready, localMode, userId, syncStatus, syncError, create, update, remove,
    replaceAll: setData,
    importArchive,
    resetDemo: () => setData(cloneDemo()),
    reload,
  }), [create, data, importArchive, localMode, ready, reload, remove, syncError, syncStatus, update, userId]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useBudgyData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useBudgyData must be used inside DataProvider");
  return context;
}
