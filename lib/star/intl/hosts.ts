/**
 * WHO HOSTS — real hosts where they are decided, a made-up but fixed choice
 * where they are not.
 *
 * Known (read 12 Oct 2026): World Cup 2030 Morocco, Portugal, Spain (+ the
 * centenary games in Argentina, Paraguay, Uruguay, all six qualify
 * automatically); World Cup 2034 Saudi Arabia; Euro 2028 England, Scotland,
 * Wales, Republic of Ireland; Euro 2032 Italy and Turkey; Africa Cup of
 * Nations 2027 Kenya, Uganda, Tanzania. Asian Cup 2027: Saudi Arabia lost it
 * on 11 Oct 2026 and no new host is named, so it is played as neutral.
 *
 * Not decided (Copa América 2028 and later, every later Euro, World Cup and
 * Africa Cup of Nations, Asian Cup 2031 on, OFC Nations Cup, Gold Cup): one
 * host is picked from that confederation's 12 best-ranked nations by the
 * edition's own seed. World Cups after 2034 rotate UEFA → CONCACAF → CAF →
 * CONMEBOL → AFC. The Gold Cup is always hosted by the United States (as
 * every edition so far, sometimes with a co-host).
 */
import { NATIONS, type Confederation } from "./nations";
import { rngFor } from "./engine";
import { EURO_HOSTS, WORLD_CUP_HOSTS, AFCON_2027_HOSTS } from "./realData";

function pick(conf: Confederation, edition: string, exclude: string[] = []): string {
  const top = NATIONS.filter((n) => n.confederation === conf && !n.suspended && !exclude.includes(n.name))
    .sort((a, b) => a.rank - b.rank).slice(0, 12);
  const r = rngFor(`host|${edition}`)();
  return top[Math.floor(r * top.length)].name;
}

const WC_ROTATION: Confederation[] = ["UEFA", "CONCACAF", "CAF", "CONMEBOL", "AFC"];

export function worldCupHosts(year: number): string[] {
  if (WORLD_CUP_HOSTS[year]) return WORLD_CUP_HOSTS[year];
  const conf = WC_ROTATION[Math.max(0, (year - 2038) / 4) % WC_ROTATION.length];
  return [pick(conf, `WC-${year}`)];
}

export function euroHosts(year: number): string[] {
  return EURO_HOSTS[year] ?? [pick("UEFA", `EURO-${year}`, ["England", "Scotland", "Wales", "Republic of Ireland", "Italy", "Turkey"])];
}

export function afconHosts(year: number): string[] {
  if (year === 2027) return AFCON_2027_HOSTS;
  return [pick("CAF", `AFCON-${year}`)];
}

export function asianCupHosts(year: number): string[] {
  if (year === 2027) return [];
  return [pick("AFC", `AC-${year}`)];
}

export function copaHosts(year: number): string[] {
  return [pick("CONMEBOL", `COPA-${year}`)];
}

export function ofcHosts(year: number): string[] {
  return [pick("OFC", `OFCNC-${year}`)];
}

export const GOLD_CUP_HOSTS = ["United States"];
