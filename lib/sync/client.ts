import type { Database } from "../types";
import { applyPulled, diffOps, snapshotOps, type PulledRecord, type SyncOp } from "./records";

/**
 * The sync loop.
 *
 * Two rules shape all of this.
 *
 * The phone writes first. Every screen already saves to localStorage and
 * carries on; this queues the same change and delivers it when there is signal.
 * Nothing on screen ever waits for a network call, which is why the app works
 * on a matatu and why it must keep doing so.
 *
 * Nothing is lost when the network is bad. The outbox is durable — it survives
 * a reload, a crash and a flat battery — and batches carry an id so a retry
 * that the server already saw does not apply twice.
 *
 * With no API address configured, every function here is a no-op and the app
 * behaves exactly as it does today. Sync is an addition, not a replacement.
 */

const OUTBOX_KEY = "sokoos.sync.outbox";
const STATE_KEY = "sokoos.sync.state";
const SESSION_KEY = "sokoos.sync.session";
const DEVICE_KEY = "sokoos.sync.device";

export interface SyncSession {
  token: string;
  accountId: string;
  tenantId: string;
  tenantName: string;
  slug: string;
}

interface SyncState {
  cursor: number;
  /** Set once the first full push has happened, so it never runs twice. */
  seeded?: boolean;
  lastSyncedAt?: string;
  lastError?: string;
}

export type SyncStatus = "off" | "idle" | "syncing" | "offline" | "error";

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

/** True when this build has somewhere to sync to. */
export function syncConfigured() {
  return Boolean(apiBase);
}

/* ------------------------------------------------------------------ *
 * Durable bits
 * ------------------------------------------------------------------ */

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked store must not break the app; the ops stay in memory
    // for this session and are re-derived from the database on the next push.
  }
}

export function getSession(): SyncSession | null {
  return read<SyncSession | null>(SESSION_KEY, null);
}

export function setSession(session: SyncSession | null) {
  if (session) write(SESSION_KEY, session);
  else if (typeof window !== "undefined") {
    // Signing out clears the cursor too, or the next account would pull from
    // a position that means nothing to it.
    [SESSION_KEY, STATE_KEY, OUTBOX_KEY].forEach((k) => window.localStorage.removeItem(k));
  }
}

function getState(): SyncState {
  return read<SyncState>(STATE_KEY, { cursor: 0 });
}

function setState(patch: Partial<SyncState>) {
  write(STATE_KEY, { ...getState(), ...patch });
}

function newBatchId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function deviceId() {
  let id = read<string>(DEVICE_KEY, "");
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    write(DEVICE_KEY, id);
  }
  return id;
}

/* ------------------------------------------------------------------ *
 * The outbox
 * ------------------------------------------------------------------ */

/**
 * Pending ops, newest write per record winning. Editing one order five times
 * offline should send one op, not five — the intermediate states are of no
 * interest to anybody.
 */
export function enqueue(ops: SyncOp[]) {
  if (!ops.length || !syncConfigured()) return;
  const pending = read<SyncOp[]>(OUTBOX_KEY, []);
  const byKey = new Map(pending.map((op) => [`${op.kind}:${op.id}`, op]));
  for (const op of ops) byKey.set(`${op.kind}:${op.id}`, op);
  write(OUTBOX_KEY, [...byKey.values()]);
}

export function pendingCount() {
  return read<SyncOp[]>(OUTBOX_KEY, []).length;
}

/* ------------------------------------------------------------------ *
 * Talking to the server
 * ------------------------------------------------------------------ */

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

export async function requestCode(phone: string) {
  return call<{ phone: string; expiresAt: string; devCode?: string }>("/auth/code", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyCode(phone: string, code: string, name?: string) {
  return call<{
    token: string;
    accountId: string;
    tenants: { id: string; name: string; slug: string }[];
  }>("/auth/verify", { method: "POST", body: JSON.stringify({ phone, code, name }) });
}

export async function createTenant(token: string, name: string, industry?: string) {
  return call<{ id: string; slug: string; name: string }>(
    "/tenants",
    { method: "POST", body: JSON.stringify({ name, industry }) },
    token,
  );
}

/* ------------------------------------------------------------------ *
 * The loop
 * ------------------------------------------------------------------ */

export interface SyncOutcome {
  status: SyncStatus;
  pushed: number;
  pulled: number;
  cursor: number;
  error?: string;
}

/**
 * One round: send what is queued, then take what is new.
 *
 * Push before pull, so a record this device just changed is not immediately
 * overwritten by the server's older copy of it.
 */
export async function syncOnce(
  db: Database,
  applyToStore: (next: Database) => void,
): Promise<SyncOutcome> {
  const session = getSession();
  if (!syncConfigured() || !session) return { status: "off", pushed: 0, pulled: 0, cursor: 0 };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "offline", pushed: 0, pulled: 0, cursor: getState().cursor };
  }

  const state = getState();
  let pushed = 0;
  let pulled = 0;

  try {
    /* First sign-in on a device that has been used offline: everything already
     * in the browser goes up before anything comes down. Getting this backwards
     * would greet a seller with an empty shop and lose months of records. */
    if (!state.seeded) {
      enqueue(snapshotOps(db));
      setState({ seeded: true });
    }

    const outbox = read<SyncOp[]>(OUTBOX_KEY, []);
    if (outbox.length) {
      // Chunked, because a device that has been offline for weeks can hold more
      // than the server will accept in one request.
      for (let i = 0; i < outbox.length; i += 400) {
        const chunk = outbox.slice(i, i + 400);
        /* A fresh id per batch. Deriving it from position looked tidy and was
         * wrong: two different pushes from the same device could produce the
         * same id, and the second would be discarded as a replay of the first.
         * (The ops themselves are idempotent upserts, so a genuinely repeated
         * batch is harmless either way — this keeps the cursor honest.) */
        const batchId = newBatchId();
        await call<{ cursor: number; applied: number }>(
          `/tenants/${session.tenantId}/sync`,
          { method: "POST", body: JSON.stringify({ batchId, deviceId: deviceId(), ops: chunk }) },
          session.token,
        );
        pushed += chunk.length;
      }
      // Only cleared once the server has all of it.
      write(OUTBOX_KEY, []);
    }

    let cursor = getState().cursor;
    for (let page = 0; page < 50; page++) {
      const result = await call<{ cursor: number; records: PulledRecord[]; more: boolean }>(
        `/tenants/${session.tenantId}/sync?since=${cursor}`,
        {},
        session.token,
      );
      if (result.records.length) {
        applyToStore(applyPulled(db, result.records));
        pulled += result.records.length;
      }
      cursor = result.cursor;
      if (!result.more) break;
    }

    setState({ cursor, lastSyncedAt: new Date().toISOString(), lastError: undefined });
    return { status: "idle", pushed, pulled, cursor };
  } catch (error) {
    const message = (error as Error).message;
    setState({ lastError: message });
    // The outbox is deliberately untouched on failure: unsent work waits.
    return { status: "error", pushed, pulled, cursor: getState().cursor, error: message };
  }
}

/** What the store hands to the sync layer after every local write. */
export function recordChange(previous: Database, next: Database) {
  if (!syncConfigured() || !getSession()) return;
  enqueue(diffOps(previous, next));
}

export function syncState() {
  const state = getState();
  return {
    configured: syncConfigured(),
    signedIn: Boolean(getSession()),
    pending: pendingCount(),
    cursor: state.cursor,
    lastSyncedAt: state.lastSyncedAt,
    lastError: state.lastError,
  };
}
