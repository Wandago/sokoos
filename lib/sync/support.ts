import { call, getSession, syncConfigured } from "./client";

/**
 * A seller reaching a human at SokoOS.
 *
 * Filed against the seller's own tenant, the same way a till connection is —
 * one call, no local record, because a ticket is something SokoOS's staff act
 * on rather than something that belongs in this seller's own books or on their
 * other devices.
 */

export function supportAvailable() {
  return syncConfigured() && Boolean(getSession());
}

export async function fileTicket(input: {
  subject: string;
  message: string;
  priority?: "urgent" | "high" | "normal" | "low";
}): Promise<{ id: string }> {
  const session = getSession();
  if (!session) throw new Error("Sign in first.");
  return call<{ id: string }>(
    `/tenants/${session.tenantId}/support`,
    { method: "POST", body: JSON.stringify(input) },
    session.token,
  );
}
