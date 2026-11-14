"use client";

import { useEffect, useRef, useState } from "react";
import { useBudgyData } from "@/lib/data/data-provider";

const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 520;
const EXIT_MS = 260;

export function AppLoadingGate({ children }: { children: React.ReactNode }) {
  const { ready } = useBudgyData();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (!ready) {
      const timer = window.setTimeout(() => {
        shownAt.current = performance.now();
        setLeaving(false);
        setVisible(true);
      }, SHOW_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    if (!visible) return undefined;
    const remaining = Math.max(MIN_VISIBLE_MS - (performance.now() - shownAt.current), 0);
    const leaveTimer = window.setTimeout(() => setLeaving(true), remaining);
    const hideTimer = window.setTimeout(() => setVisible(false), remaining + EXIT_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [ready, visible]);

  return (
    <>
      {children}
      {visible ? (
        <div
          className={`app-loading-screen ${leaving ? "is-leaving" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Chargement de Budgy"
        >
          <div className="app-loading-brand" aria-hidden="true">
            <span className="app-loading-mark">B</span>
            <strong>Budgy</strong>
            <i><b /></i>
          </div>
          <span className="sr-only">Chargement de vos données…</span>
        </div>
      ) : null}
    </>
  );
}

export const appLoadingTiming = {
  showDelay: SHOW_DELAY_MS,
  minimumVisible: MIN_VISIBLE_MS,
  exitDuration: EXIT_MS,
};
