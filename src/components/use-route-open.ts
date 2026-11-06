"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

/** Open/closed state that resets on navigation: it is "open" only for the path it was opened on. */
export function useRouteOpen(): [boolean, (v: boolean | ((open: boolean) => boolean)) => void] {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const setOpen = useCallback(
    (v: boolean | ((open: boolean) => boolean)) =>
      setOpenAt((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null)),
    [pathname],
  );
  return [openAt === pathname, setOpen];
}
