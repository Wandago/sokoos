"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { startSync, subscribeToSync, syncNow, type RunnerState } from "@/lib/sync/runner";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Runs the sync loop, and shows what it is doing.
 *
 * Mounted once in the shell. Two jobs, kept together because separating them
 * would let the app run a loop nobody can see the state of — and on a network
 * that drops in and out, "is my morning's work actually saved anywhere" is a
 * question a seller is entitled to a straight answer to.
 *
 * When there is no API configured this renders nothing and starts nothing. The
 * app is local-first, and a device that has never signed in is not broken, it
 * is just alone.
 */
export function SyncStatus({
  tone = "surface",
  className,
}: {
  /** "panel" for the dark header, where the light pill would disappear. */
  tone?: "surface" | "panel";
  className?: string;
}) {
  const { db } = useStore();
  const [state, setState] = useState<RunnerState | null>(null);

  /* The loop reads the database through a ref rather than taking it as a
   * dependency. Depending on `db` would tear the loop down and start it again
   * on every keystroke that touches the store — and each restart fires an
   * immediate sync, which is a lot of somebody's bundle to spend on nothing. */
  const latest = useRef(db);
  useEffect(() => {
    latest.current = db;
  }, [db]);

  useEffect(() => subscribeToSync(setState), []);
  useEffect(() => startSync(() => latest.current), []);

  if (!state || state.status === "off") return null;

  const busy = state.status === "syncing";
  const offline = state.status === "offline";
  const failed = state.status === "error";

  const Icon = busy ? Loader2 : offline ? CloudOff : failed ? TriangleAlert : Check;

  const label = busy
    ? "Saving…"
    : offline
      ? state.pending
        ? `${state.pending} waiting for signal`
        : "Offline"
      : failed
        ? state.pending
          ? `${state.pending} still to send`
          : "Could not reach the server"
        : state.lastSyncedAt
          ? `Saved ${relativeTime(state.lastSyncedAt)}`
          : "Saved";

  return (
    <button
      onClick={() => syncNow(() => latest.current)}
      disabled={busy}
      title={state.lastError ?? undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
        tone === "panel"
          ? offline || failed
            ? "bg-pending/25 text-pending-soft"
            : "bg-white/10 text-panel-muted hover:bg-white/15"
          : offline || failed
            ? "bg-pending-soft text-pending-text"
            : "bg-surface-sunken text-text-secondary hover:bg-surface-hover",
        className,
      )}
    >
      <Icon className={cn("size-3", busy && "animate-spin")} />
      {label}
      {!busy && (offline || failed) && <RefreshCw className="size-3" />}
    </button>
  );
}
