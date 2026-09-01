import { applyRemote } from "../store";
import { getSession, syncConfigured, syncOnce, syncState, type SyncStatus } from "./client";

/**
 * The thing that actually turns the handle.
 *
 * The sync engine was written before anything ran it, which meant the outbox
 * filled up and nothing ever came down — a payment landing at a seller's till
 * would have reached the server and stopped there. This module is the loop.
 *
 * It is deliberately dumb. No websockets, no push, no reconnection backoff
 * cleverness: a sync when the app opens, a sync when the seller comes back to
 * it, a sync when the network returns, and a slow tick in between. On a phone
 * that spends its day locked in a pocket on a bad network, the moments that
 * matter are exactly those first three, and a socket would only be another
 * thing to keep alive.
 *
 * Runs are serialised. Two overlapping pushes of the same outbox would be
 * harmless — the ops are idempotent upserts — but they would double the data a
 * seller pays for, and bundles are not free here.
 */

const INTERVAL = 60_000;

type Listener = (state: RunnerState) => void;

export interface RunnerState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt?: string;
  lastError?: string;
}

let running = false;
let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let status: SyncStatus = "idle";
const listeners = new Set<Listener>();

function snapshot(): RunnerState {
  const state = syncState();
  return {
    status: !state.configured || !state.signedIn ? "off" : status,
    pending: state.pending,
    lastSyncedAt: state.lastSyncedAt,
    lastError: state.lastError,
  };
}

function announce() {
  const state = snapshot();
  listeners.forEach((listener) => listener(state));
}

export function subscribeToSync(listener: Listener) {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function syncNow(getDb: () => Parameters<typeof syncOnce>[0]) {
  return run(getDb);
}

async function run(getDb: () => Parameters<typeof syncOnce>[0]) {
  if (running || !syncConfigured() || !getSession()) return;
  running = true;
  status = "syncing";
  announce();
  try {
    /* The database is read at the last moment rather than captured when the
     * run was scheduled. A sync that started while the seller was typing an
     * order should send the order they finished, not the one they had begun. */
    const outcome = await syncOnce(getDb(), applyRemote);
    status = outcome.status;
  } catch {
    // syncOnce already records the reason; the loop only needs to keep going.
    status = "error";
  } finally {
    running = false;
    announce();
  }
}

/**
 * Starts the loop. Safe to call more than once — the second call is a no-op,
 * so a remount does not end up with two timers racing each other.
 */
export function startSync(getDb: () => Parameters<typeof syncOnce>[0]) {
  if (started || typeof window === "undefined" || !syncConfigured()) return () => {};
  started = true;

  const go = () => void run(getDb);

  go();
  timer = setInterval(go, INTERVAL);

  // Coming back to the app is the moment a seller most wants it to be true.
  const onVisible = () => document.visibilityState === "visible" && go();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", go);
  window.addEventListener("online", go);

  return () => {
    started = false;
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", go);
    window.removeEventListener("online", go);
  };
}
