"use client";
import { useEffect, useState } from "react";
import { lookFromCookie, setLookCookie, setThemeCookie, type Theme } from "@/lib/siteLook/look";

/** Every public page, to check one by one in the new look. */
const PAGES: [string, string][] = [
  ["/", "Home"], ["/games", "All games"], ["/draft", "PL Draft"], ["/draft/history", "Draft history"], ["/draft/records", "Draft Hall of Fame"],
  ["/tic-tac-toe", "Tic Tac Toe"], ["/tenable", "Ten-A-Ball"], ["/tierlists", "Tierlists"], ["/objectives", "Objectives"],
  ["/profile", "Profile"], ["/auth", "Sign in"], ["/legal", "Privacy and terms"], ["/credits", "Credits"], ["/road-to-the-golden-ball", "Road to the Golden Ball"],
];

export default function NewLookSwitch() {
  const [look, setLook] = useState<{ on: boolean; theme: Theme }>({ on: false, theme: "light" });
  useEffect(() => setLook(lookFromCookie(document.cookie)), []);
  const set = (next: { on: boolean; theme: Theme }) => { setLookCookie(next.on); setThemeCookie(next.theme); setLook(next); };
  const btn = (active: boolean) => `rounded-xl px-4 py-3 text-base font-bold ${active ? "bg-emerald-600 text-white" : "bg-gray-800 text-white"}`;
  return (
    <div className="mx-auto max-w-xl text-white">
      <h1 className="text-2xl font-black">New look preview</h1>
      <p className="mt-2 text-sm text-gray-300">The new Knowitball look on the real site, for this device only. Everyone else still sees today&rsquo;s site. Game screens and admin pages don&rsquo;t change.</p>
      <div className="mt-5 flex gap-2">
        <button data-newlook-on onClick={() => set({ on: true, theme: look.theme })} className={btn(look.on)}>On</button>
        <button data-newlook-off onClick={() => set({ on: false, theme: look.theme })} className={btn(!look.on)}>Off</button>
      </div>
      <p className="mt-5 text-sm font-bold text-gray-300">Theme</p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => set({ on: look.on, theme: "light" })} className={btn(look.theme === "light")}>Light (cream)</button>
        <button onClick={() => set({ on: look.on, theme: "dark" })} className={btn(look.theme === "dark")}>Dark</button>
      </div>
      <p className="mt-6 text-sm text-gray-300">While it&rsquo;s on, a small &ldquo;● New look&rdquo; button sits bottom-left on every page: tap it to switch Light/Dark or turn it off.</p>
      <p className="mt-6 text-sm font-bold text-gray-300">Check every page</p>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {PAGES.map(([href, name]) => (
          <li key={href}><a href={href} className="block rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800">{name}</a></li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-gray-400">On a phone you can also use the link knowitball.co.uk/?look=v2 (and ?look=off) while signed in as an admin.</p>
    </div>
  );
}
