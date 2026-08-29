"use client";

import { useStore } from "@/lib/store";
import { ListSkeleton, Skeleton } from "./state";

/**
 * Business data lives in localStorage, which only exists on the client. Gate
 * anything that reads it so the first paint never disagrees with the markup.
 */
export function Hydrated({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { ready } = useStore();
  if (!ready) {
    return (
      <>
        {fallback ?? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-card" />
            <ListSkeleton rows={4} />
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
