import { call } from "@/lib/sync/client";

/**
 * The operator console's connection to the real API — separate from the
 * seller sync client's session, because an admin token and a seller token
 * must never be interchangeable. Same `call()` helper underneath: one place
 * that attaches a bearer token and turns a non-2xx response into an error.
 */

const TOKEN_KEY = "sokoos.admin.token";
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

/** True when this build has a real API to sign in to. Same signal the seller app uses. */
export function adminApiAvailable() {
  return Boolean(apiBase);
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the console still works for this tab's session.
  }
}

export interface AdminSession {
  token: string;
  adminId: string;
  name: string;
  email: string;
  expiresAt: string;
}

export async function adminLogin(email: string, password: string) {
  return call<AdminSession>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function adminSignOut() {
  const token = getAdminToken();
  if (!token) return;
  await call("/admin/sign-out", { method: "POST" }, token).catch(() => {
    // Signing out is best-effort: the token is discarded locally either way.
  });
}

export interface PlatformOverview {
  merchants: number;
  newThisWeek: number;
  newThisMonth: number;
  suspended: number;
  activeThisWeek: number;
  tillsConnected: number;
  tillsRegistered: number;
}

export async function fetchOverview() {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");
  return call<PlatformOverview>("/admin/overview", {}, token);
}

export interface AdminMerchant {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  createdAt: string;
  suspendedAt: string | null;
  owner: { name: string; phone: string; email: string | null } | null;
  till: { shortcode: string; kind: string; registeredAt: string | null } | null;
  lastActivityAt: string | null;
}

export async function fetchMerchants() {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");
  return call<AdminMerchant[]>("/admin/merchants", {}, token);
}

export interface MerchantDetail extends AdminMerchant {
  ownerJoinedAt: string | null;
  till: (AdminMerchant["till"] & { environment: string; lastEventAt: string | null }) | null;
  recordCounts: Record<string, number>;
}

export async function fetchMerchant(id: string) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");
  return call<MerchantDetail>(`/admin/merchants/${id}`, {}, token);
}

export async function suspendMerchant(id: string, reason?: string) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");
  return call<MerchantDetail>(
    `/admin/merchants/${id}/suspend`,
    { method: "POST", body: JSON.stringify({ reason }) },
    token,
  );
}

export async function reinstateMerchant(id: string) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");
  return call<MerchantDetail>(`/admin/merchants/${id}/reinstate`, { method: "POST" }, token);
}
