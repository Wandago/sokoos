"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Detail views and creation flows are addressed with query params rather than
 * route segments, which keeps the whole app statically exportable — every
 * screen is one precacheable HTML file.
 */
export function useQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  /**
   * Two consecutive `set` calls in one tick would both read the same params and
   * the second would undo the first — which quietly left two sheets open at
   * once, with one backdrop swallowing the other's buttons. Anything that
   * changes more than one key must change them together.
   */
  const setMany = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null) next.delete(key);
        else next.set(key, value);
      });
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { get: (key: string) => params.get(key), set, setMany };
}
