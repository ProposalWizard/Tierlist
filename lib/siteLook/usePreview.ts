"use client";
/**
 * lib/siteLook/usePreview.ts — is the New look preview on, for a component that
 * shows something new only to the tester (Leo, 27 Nov 2026). New features ride
 * the same switch as the look until Leo says go. False on the server and for
 * everyone without the cookie.
 */
import { useEffect, useState } from "react";
import { lookFromCookie } from "./look";

export const LOOK_EVENT = "kib-look-change";

export function usePreview(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(lookFromCookie(document.cookie).on);
    read();
    window.addEventListener(LOOK_EVENT, read);
    return () => window.removeEventListener(LOOK_EVENT, read);
  }, []);
  return on;
}
