import * as cheerio from "cheerio";

const BASE_URL = "https://sofifa.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchPage(url: string, retries = 5): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });
      if (res.ok) return await res.text();
      if (res.status === 429 || res.status === 403) {
        const wait = Math.pow(2, i + 1) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return null;
    } catch {
      const wait = Math.pow(2, i + 1) * 1000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return null;
}

export interface FifaVersionInfo {
  label: string;
  code: string;
}

export interface ColumnInfo {
  name: string;
  value: string;
}

export interface SofifaPlayer {
  sofifa_id: string;
  name: string;
  positions: string;
  nationality: string;
  club: string;
  league: string;
  image_url: string | null;
  overall: number | null;
  potential: number | null;
  age: number | null;
  attributes: Record<string, string | number | null>;
}

export async function getVersionsAndColumns(): Promise<{
  versions: FifaVersionInfo[];
  columns: ColumnInfo[];
} | null> {
  const html = await fetchPage(BASE_URL);
  if (!html) return null;

  const $ = cheerio.load(html);

  const versions: FifaVersionInfo[] = [];
  $('select[name="version"] option').each((_, el) => {
    const val = $(el).attr("value") ?? "";
    const codeMatch = val.match(/r=(\d+)/);
    if (codeMatch) {
      versions.push({
        label: $(el).text().trim(),
        code: codeMatch[1],
      });
    }
  });

  const columns: ColumnInfo[] = [];
  $('select[name="showCol[]"] option').each((_, el) => {
    const value = $(el).attr("value");
    const name = $(el).text().trim();
    if (value && name) {
      columns.push({ name, value });
    }
  });

  return { versions, columns };
}

function buildUrl(
  versionCode: string,
  columns: ColumnInfo[],
  offset: number
): string {
  let url = `${BASE_URL}/players?r=${versionCode}&set=true`;
  for (const col of columns) {
    url += `&showCol[]=${col.value}`;
  }
  url += `&offset=${offset}`;
  return url;
}

function toSnakeCase(s: string): string {
  return s
    .replace(/[^0-9a-zA-Z\s]+/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join("_");
}

export async function scrapePage(
  versionCode: string,
  columns: ColumnInfo[],
  offset: number
): Promise<{ players: SofifaPlayer[]; nextOffset: number | null }> {
  const url = buildUrl(versionCode, columns, offset);
  const html = await fetchPage(url);
  if (!html) return { players: [], nextOffset: null };

  const $ = cheerio.load(html);
  const players: SofifaPlayer[] = [];

  $("table > tbody > tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length < 2) return;

    const tdName = $(tds[1]);
    const nameLink = tdName.find("a").first();
    const href = nameLink.attr("href") ?? "";
    const sofifaIdMatch = href.match(/\/player\/(\d+)\//);
    if (!sofifaIdMatch) return;

    const name =
      nameLink.attr("data-tippy-content") ?? nameLink.text().trim();
    const positions = tdName
      .find("span.pos")
      .map((_, el) => $(el).text().trim())
      .get()
      .join(",");
    const nationality = tdName.find("div img").attr("title") ?? "";
    const image =
      $(tds[0]).find("img").attr("data-src") ??
      $(tds[0]).find("img").attr("src") ??
      null;

    const attrs: Record<string, string | number | null> = {};
    let club = "";
    let league = "";
    let overall: number | null = null;
    let potential: number | null = null;
    let age: number | null = null;

    for (const col of columns) {
      const key = toSnakeCase(col.name);
      const cell = $(row).find(`td[data-col="${col.value}"]`);
      const raw = cell.text().trim();

      if (!raw) {
        attrs[key] = null;
        continue;
      }

      const num = parseInt(raw, 10);
      const val = !isNaN(num) && String(num) === raw ? num : raw;

      if (key === "overall" || key === "ova") overall = typeof val === "number" ? val : null;
      else if (key === "potential" || key === "pot") potential = typeof val === "number" ? val : null;
      else if (key === "age") age = typeof val === "number" ? val : null;
      else if (key === "club") club = typeof val === "string" ? val : String(val);
      else if (key === "league") league = typeof val === "string" ? val : String(val);

      attrs[key] = val;
    }

    players.push({
      sofifa_id: sofifaIdMatch[1],
      name,
      positions,
      nationality,
      club,
      league,
      image_url: image,
      overall,
      potential,
      age,
      attributes: attrs,
    });
  });

  let nextOffset: number | null = null;
  $("div.pagination a").each((_, el) => {
    if ($(el).text().trim() === "Next") {
      const href = $(el).attr("href") ?? "";
      const offsetMatch = href.match(/offset=(\d+)/);
      if (offsetMatch) nextOffset = parseInt(offsetMatch[1], 10);
    }
  });

  return { players, nextOffset };
}

export function getVersionCodeForYear(
  versions: FifaVersionInfo[],
  year: number
): string | null {
  const yy = String(year % 100).padStart(2, "0");
  const label = year >= 2024 ? `FC ${yy}` : `FIFA ${yy}`;
  const match = versions.find((v) => v.label.startsWith(label));
  return match?.code ?? null;
}
