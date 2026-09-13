"use client";

import { RefreshCcw } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";

const THRESHOLD = 72;
const MAX_PULL = 110;

/**
 * Pull-to-refresh générique et réutilisable (V2.6 §4). Enveloppe n'importe
 * quel contenu de page : tant que la page est déjà tout en haut, tirer vers
 * le bas fait apparaître un indicateur qui suit le doigt avec une résistance
 * progressive, puis déclenche `onRefresh` au relâchement si le seuil est
 * dépassé. Le scroll normal n'est jamais intercepté ailleurs qu'en haut de
 * page pendant un tirage actif (`preventDefault` n'est appelé que dans ce
 * cas précis).
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const isAtTop = () => (typeof window === "undefined" ? false : window.scrollY <= 0);

  const onTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (refreshingRef.current || !isAtTop()) { startY.current = null; return; }
    startY.current = event.touches[0]?.clientY ?? null;
    setDragging(startY.current !== null);
  }, []);

  const onTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (startY.current === null || refreshingRef.current) return;
    const currentY = event.touches[0]?.clientY ?? startY.current;
    const delta = currentY - startY.current;
    if (delta <= 0 || !isAtTop()) {
      startY.current = null;
      setDragging(false);
      setPullDistance(0);
      return;
    }
    // Empêche seulement le rebond natif pendant un tirage actif depuis le
    // haut : le scroll normal ailleurs n'est jamais affecté.
    event.preventDefault();
    const resisted = Math.min(MAX_PULL, Math.sqrt(delta) * 6);
    setPullDistance(resisted);
  }, []);

  const finishPull = useCallback(() => {
    const wasDragging = startY.current !== null;
    startY.current = null;
    setDragging(false);
    if (!wasDragging) return;
    setPullDistance((current) => {
      if (current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        void Promise.resolve()
          .then(() => onRefresh())
          .catch(() => undefined)
          .finally(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPullDistance(0);
          });
        return THRESHOLD;
      }
      return 0;
    });
  }, [onRefresh]);

  return (
    <div
      className="pull-to-refresh"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={finishPull}
      onTouchCancel={finishPull}
    >
      <div
        className={`pull-to-refresh-indicator${refreshing ? " is-refreshing" : ""}`}
        style={{ height: pullDistance }}
        aria-hidden="true"
      >
        <RefreshCcw
          size={18}
          className={refreshing ? "spin" : ""}
          style={refreshing ? undefined : { transform: `rotate(${Math.min(pullDistance / THRESHOLD, 1) * 180}deg)`, opacity: Math.min(pullDistance / THRESHOLD, 1) }}
        />
      </div>
      <div
        className="pull-to-refresh-content"
        style={{
          transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
          transition: dragging ? undefined : "transform .25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
