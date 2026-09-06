"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { createAdminDatabase, ADMIN_DB_VERSION } from "./seed";
import { adminSignOut as adminApiSignOut, getAdminToken, setAdminToken } from "./api";
import type { AdminDatabase, MerchantStatus, Plan, ReportStatus, TicketStatus } from "./types";

const STORAGE_KEY = "sokoos.admin.v1";

/* Same external-store pattern as the seller app, for the same reason: the
 * prerendered markup and the hydrated client must agree. */

const serverSnapshot: AdminDatabase = createAdminDatabase();
let clientSnapshot: AdminDatabase | null = null;
const listeners = new Set<() => void>();

function load(): AdminDatabase {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createAdminDatabase();
    const parsed = JSON.parse(raw) as AdminDatabase;
    if (parsed.version !== ADMIN_DB_VERSION) return createAdminDatabase();
    return parsed;
  } catch {
    return createAdminDatabase();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AdminDatabase {
  if (clientSnapshot === null) clientSnapshot = load();
  return clientSnapshot;
}

function getServerSnapshot(): AdminDatabase {
  return serverSnapshot;
}

function setDb(update: (previous: AdminDatabase) => AdminDatabase) {
  const previous = getSnapshot();
  const next = update(previous);
  if (next === previous) return;
  clientSnapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the console still works for this session.
  }
  listeners.forEach((listener) => listener());
}

const alwaysTrue = () => true;
const alwaysFalse = () => false;

interface AdminStoreValue {
  db: AdminDatabase;
  ready: boolean;
  setMerchantStatus: (id: string, status: MerchantStatus, reason?: string) => void;
  setMerchantPlan: (id: string, plan: Plan) => void;
  setReportStatus: (id: string, status: ReportStatus) => void;
  setTicketStatus: (id: string, status: TicketStatus) => void;
  assignTicket: (id: string, assignee: string) => void;
  setFlag: (key: string, patch: { enabled?: boolean; rollout?: number }) => void;
  resetAdminData: () => void;
}

const AdminContext = createContext<AdminStoreValue | null>(null);

export function AdminStoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  const setMerchantStatus = useCallback<AdminStoreValue["setMerchantStatus"]>(
    (id, status, reason) => {
      setDb((prev) => ({
        ...prev,
        merchants: prev.merchants.map((m) =>
          m.id === id
            ? {
                ...m,
                status,
                suspendedReason: status === "suspended" ? (reason ?? m.suspendedReason) : undefined,
                mrr: status === "suspended" || status === "churned" ? 0 : m.mrr,
              }
            : m,
        ),
      }));
    },
    [],
  );

  const setMerchantPlan = useCallback<AdminStoreValue["setMerchantPlan"]>((id, plan) => {
    setDb((prev) => ({
      ...prev,
      merchants: prev.merchants.map((m) => (m.id === id ? { ...m, plan } : m)),
    }));
  }, []);

  const setReportStatus = useCallback<AdminStoreValue["setReportStatus"]>((id, status) => {
    setDb((prev) => ({
      ...prev,
      reports: prev.reports.map((r) => (r.id === id ? { ...r, status } : r)),
    }));
  }, []);

  const setTicketStatus = useCallback<AdminStoreValue["setTicketStatus"]>((id, status) => {
    setDb((prev) => ({
      ...prev,
      tickets: prev.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  }, []);

  const assignTicket = useCallback<AdminStoreValue["assignTicket"]>((id, assignee) => {
    setDb((prev) => ({
      ...prev,
      tickets: prev.tickets.map((t) =>
        t.id === id ? { ...t, assignee, status: t.status === "open" ? "pending" : t.status } : t,
      ),
    }));
  }, []);

  const setFlag = useCallback<AdminStoreValue["setFlag"]>((key, patch) => {
    setDb((prev) => ({
      ...prev,
      flags: prev.flags.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    }));
  }, []);

  const resetAdminData = useCallback(() => {
    setDb(() => createAdminDatabase());
  }, []);

  const value = useMemo<AdminStoreValue>(
    () => ({
      db,
      ready,
      setMerchantStatus,
      setMerchantPlan,
      setReportStatus,
      setTicketStatus,
      assignTicket,
      setFlag,
      resetAdminData,
    }),
    [
      db,
      ready,
      setMerchantStatus,
      setMerchantPlan,
      setReportStatus,
      setTicketStatus,
      assignTicket,
      setFlag,
      resetAdminData,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

/* ---- Console session ---------------------------------------------------
 *
 * A real bearer token, issued by POST /admin/login and checked on the server
 * for every /admin/* request from here on — see server/src/lib/admin-auth.ts.
 * What lives in localStorage is the token itself, not a flag saying whether
 * to trust the tab: the server is what decides that now.
 */

const sessionListeners = new Set<() => void>();

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/** Called once POST /admin/login succeeds, so every useAdminSession() re-renders. */
export function completeAdminLogin(token: string) {
  setAdminToken(token);
  sessionListeners.forEach((listener) => listener());
}

export function signOutAdmin() {
  // Best-effort: the token that authorises this call is read before it is
  // cleared below, so the server sees the sign-out even though the request
  // itself resolves after this function has already returned.
  void adminApiSignOut();
  setAdminToken(null);
  sessionListeners.forEach((listener) => listener());
}

/** True once hydrated and a token is present. False during prerender. */
export function useAdminSession() {
  return useSyncExternalStore(subscribeSession, () => getAdminToken() !== null, alwaysFalse);
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminStoreProvider>");
  return ctx;
}
