export type Versions = Record<string, string>;

export interface SyncEngineOptions {
  /** Lecture légère (get_sync_versions). Rejette si la fonction SQL est absente ou le réseau coupé. */
  fetchVersions: () => Promise<Versions>;
  /** Appelé avec les domaines modifiés (ou `null` = tout recharger en mode dégradé). Retourne `false` si rien n'a été appliqué (écriture locale en cours) : nouvel essai rapide. */
  onChange: (domains: string[] | null) => Promise<boolean | void>;
  /** Vrai si une écriture locale est en cours : on ne remplace alors rien (évite le clignotement). */
  isBusy: () => boolean;
  isVisible?: () => boolean;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Version SQL absente (migration non appliquée) : bascule en rafraîchissement complet périodique. */
  isMissingFunction?: (reason: unknown) => boolean;
}

export const POLL = {
  active: 2_000,      // < 1 min depuis la dernière activité ou le dernier changement
  warm: 5_000,        // < 5 min
  idle: 15_000,       // au-delà
  busyRetry: 400,
  degraded: 15_000,
  maxBackoff: 30_000,
} as const;

/**
 * Moteur de synchronisation par versions : un petit appel périodique remplace le rechargement
 * de toutes les tables. Le polling s'adapte à l'activité, s'arrête quand l'onglet est caché et
 * redémarre immédiatement au retour (focus, online, visibilitychange) via `kick()`.
 */
export class SyncEngine {
  private versions: Versions | null = null;
  private timer: unknown;
  private stopped = true;
  private running = false;
  private failures = 0;
  private degraded = false;
  private lastActivity: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly isVisible: () => boolean;

  constructor(private readonly options: SyncEngineOptions) {
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.isVisible = options.isVisible ?? (() => typeof document === "undefined" || document.visibilityState === "visible");
    this.lastActivity = this.now();
  }

  /** Établit la référence AVANT le chargement complet : un changement survenu pendant ce chargement sera repris au tick suivant. */
  async seed() {
    try {
      this.versions = await this.options.fetchVersions();
      this.degraded = false;
    } catch (reason) {
      this.versions = null;
      this.degraded = this.options.isMissingFunction?.(reason) ?? false;
    }
  }

  start() {
    this.stopped = false;
    this.schedule(this.nextDelay());
  }

  stop() {
    this.stopped = true;
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.timer = undefined;
  }

  /** Activité utilisateur/local : repasse en cadence rapide. */
  touch() { this.lastActivity = this.now(); }

  /** Vérification immédiate (retour au premier plan, reconnexion, après une écriture locale). */
  kick() {
    if (this.stopped) return;
    this.touch();
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.schedule(0);
  }

  get mode(): "versions" | "degraded" { return this.degraded ? "degraded" : "versions"; }

  private nextDelay() {
    if (this.failures > 0) return Math.min(POLL.maxBackoff, POLL.active * 2 ** Math.min(this.failures, 5));
    if (this.degraded) return POLL.degraded;
    const idleFor = this.now() - this.lastActivity;
    return idleFor < 60_000 ? POLL.active : idleFor < 300_000 ? POLL.warm : POLL.idle;
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    this.timer = this.setTimer(() => { void this.tick(); }, ms);
  }

  private async tick() {
    if (this.stopped || this.running) return;
    if (!this.isVisible()) { this.schedule(POLL.idle); return; }
    if (this.options.isBusy()) { this.schedule(POLL.busyRetry); return; }
    this.running = true;
    try {
      if (this.degraded) {
        if ((await this.options.onChange(null)) === false) { this.schedule(POLL.busyRetry); return; }
      } else {
        const next = await this.options.fetchVersions();
        const previous = this.versions;
        // Sans référence (le seed a échoué), on traite tout comme modifié.
        const changed = Object.keys(next).filter((domain) => !previous || previous[domain] !== next[domain]);
        // Domaines disparus (ligne de version supprimée) : rechargement par prudence.
        if (previous) for (const domain of Object.keys(previous)) if (!(domain in next)) changed.push(domain);
        if (changed.length > 0) {
          if (this.options.isBusy()) { this.schedule(POLL.busyRetry); return; }
          const applied = await this.options.onChange(changed);
          if (applied === false) { this.schedule(POLL.busyRetry); return; }
          this.touch();
        }
        this.versions = next;
      }
      this.failures = 0;
    } catch (reason) {
      if (!this.degraded && this.options.isMissingFunction?.(reason)) this.degraded = true;
      else this.failures += 1;
    } finally {
      this.running = false;
    }
    this.schedule(this.nextDelay());
  }
}

/** PostgREST renvoie PGRST202/404 quand la fonction n'existe pas (migration non appliquée). */
export function isMissingSyncFunction(reason: unknown) {
  const error = reason as { code?: string; status?: number; message?: string } | null;
  return Boolean(error && (error.code === "PGRST202" || error.status === 404 || /get_sync_versions/.test(error.message ?? "")));
}
