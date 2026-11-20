/**
 * FULL SCREEN, like the packed app (mobile/.../MainActivity.java hideTopBar):
 * the phone's status bar (time, battery) and its navigation bar (back, home)
 * are hidden. A swipe from the edge shows them for a moment; they hide again
 * a few seconds later and whenever the app comes back to the front.
 * Mikey, 20 Nov 2026: "on the packed app version, you hid those, but on this
 * one, they're not hidden."
 */
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";

function hideBars() {
  if (Platform.OS !== "android") return;
  NavigationBar.setVisibilityAsync("hidden").catch(() => {});
}

export function Immersive() {
  useEffect(() => {
    hideBars();
    const app = AppState.addEventListener("change", (s) => { if (s === "active") hideBars(); });
    let t: ReturnType<typeof setTimeout> | undefined;
    const vis = Platform.OS === "android"
      ? NavigationBar.addVisibilityListener(({ visibility }) => {
          if (visibility === "visible") { if (t) clearTimeout(t); t = setTimeout(hideBars, 2500); }
        })
      : null;
    return () => { app.remove(); vis?.remove(); if (t) clearTimeout(t); };
  }, []);
  return <StatusBar hidden style="light" />;
}
