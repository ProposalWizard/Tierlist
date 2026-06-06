"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

let _html2canvas: typeof import("html2canvas").default | null = null;
async function getHtml2Canvas() {
  if (!_html2canvas) _html2canvas = (await import("html2canvas")).default;
  return _html2canvas;
}

/* ─── Types ─── */

interface DBPlayer {
  id: string;
  name: string;
  nationality: string;
  position: string;
  image: string | null;
}

interface PlayerSlot {
  idx: number;
  x: number;
  y: number;
  label: string;
  customName: string;
  dbPlayer: DBPlayer | null;
}

interface FormationPos {
  x: number;
  y: number;
  label: string;
}

/* ─── Country → flag emoji ─── */

const ISO: Record<string, string> = {
  Afghanistan:"AF",Albania:"AL",Algeria:"DZ",Andorra:"AD",Angola:"AO",
  "Antigua and Barbuda":"AG",Argentina:"AR",Armenia:"AM",Australia:"AU",
  Austria:"AT",Azerbaijan:"AZ",Bahrain:"BH",Bangladesh:"BD",Barbados:"BB",
  Belarus:"BY",Belgium:"BE",Benin:"BJ",Bolivia:"BO",
  "Bosnia and Herzegovina":"BA",Botswana:"BW",Brazil:"BR",Bulgaria:"BG",
  "Burkina Faso":"BF",Burundi:"BI","Cabo Verde":"CV",Cameroon:"CM",
  Canada:"CA","Central African Republic":"CF",Chad:"TD",Chile:"CL",
  China:"CN",Colombia:"CO",Comoros:"KM",
  "Democratic Republic of the Congo":"CD","Republic of the Congo":"CG",
  Congo:"CG","Costa Rica":"CR",Croatia:"HR",Cuba:"CU",Curaçao:"CW",
  Cyprus:"CY","Czech Republic":"CZ",Czechia:"CZ",Denmark:"DK",
  "Dominican Republic":"DO",Ecuador:"EC",Egypt:"EG","El Salvador":"SV",
  England:"GB-ENG",
  "Equatorial Guinea":"GQ",Eritrea:"ER",Estonia:"EE",Ethiopia:"ET",
  "Faroe Islands":"FO",Fiji:"FJ",Finland:"FI",France:"FR",Gabon:"GA",
  Gambia:"GM",Georgia:"GE",Germany:"DE",Ghana:"GH",Greece:"GR",
  Grenada:"GD",Guatemala:"GT",Guinea:"GN","Guinea-Bissau":"GW",
  Guyana:"GY",Haiti:"HT",Honduras:"HN",Hungary:"HU",Iceland:"IS",
  India:"IN",Indonesia:"ID",Iran:"IR",Iraq:"IQ",Ireland:"IE",
  Israel:"IL",Italy:"IT",Jamaica:"JM",Japan:"JP",Jordan:"JO",
  Kazakhstan:"KZ",Kenya:"KE",Kosovo:"XK","South Korea":"KR",
  Korea:"KR",Kuwait:"KW",Kyrgyzstan:"KG",Latvia:"LV",Lebanon:"LB",
  Liberia:"LR",Libya:"LY",Liechtenstein:"LI",Lithuania:"LT",
  Luxembourg:"LU",Madagascar:"MG",Malawi:"MW",Malaysia:"MY",
  Maldives:"MV",Mali:"ML",Malta:"MT",Mauritania:"MR",Mauritius:"MU",
  Mexico:"MX",Moldova:"MD",Monaco:"MC",Mongolia:"MN",Montenegro:"ME",
  Morocco:"MA",Mozambique:"MZ",Myanmar:"MM",Namibia:"NA",Nepal:"NP",
  Netherlands:"NL","New Zealand":"NZ",Nicaragua:"NI",Niger:"NE",
  Nigeria:"NG","North Macedonia":"MK",Norway:"NO",Oman:"OM",
  Pakistan:"PK",Palestine:"PS",Panama:"PA",Paraguay:"PY",Peru:"PE",
  Philippines:"PH",Poland:"PL",Portugal:"PT",Qatar:"QA",Romania:"RO",
  Russia:"RU",Rwanda:"RW","Saudi Arabia":"SA",Scotland:"GB-SCT",
  Senegal:"SN",Serbia:"SR",
  "Sierra Leone":"SL",Singapore:"SG",Slovakia:"SK",Slovenia:"SI",
  Somalia:"SO","South Africa":"ZA","South Sudan":"SS",Spain:"ES",
  "Sri Lanka":"LK",Sudan:"SD",Suriname:"SR",Sweden:"SE",
  Switzerland:"CH",Syria:"SY",Taiwan:"TW",Tajikistan:"TJ",Tanzania:"TZ",
  Thailand:"TH",Togo:"TG","Trinidad and Tobago":"TT",Tunisia:"TN",
  Turkey:"TR",Turkmenistan:"TM",Uganda:"UG",Ukraine:"UA",
  "United Arab Emirates":"AE","United Kingdom":"GB",
  "United States of America":"US","United States":"US",Uruguay:"UY",
  Uzbekistan:"UZ",Venezuela:"VE",Vietnam:"VN",Wales:"GB-WLS",
  Yemen:"YE",Zambia:"ZM",Zimbabwe:"ZW",
  "Ivory Coast":"CI","Côte d'Ivoire":"CI","Cape Verde":"CV",
  "North Korea":"KP","DR Congo":"CD",
};

function countryFlag(name: string): string {
  const code = ISO[name];
  if (!code) return "";
  const base = code.replace(/-.*/, "");
  return String.fromCodePoint(
    ...base.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/* ─── Formations ─── */

const FORMATIONS: Record<string, FormationPos[]> = {
  "4-4-2": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 15, y: 48, label: "LM" },
    { x: 38, y: 50, label: "CM" },
    { x: 62, y: 50, label: "CM" },
    { x: 85, y: 48, label: "RM" },
    { x: 38, y: 22, label: "ST" },
    { x: 62, y: 22, label: "ST" },
  ],
  "4-3-3": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 25, y: 48, label: "CM" },
    { x: 50, y: 45, label: "CM" },
    { x: 75, y: 48, label: "CM" },
    { x: 18, y: 22, label: "LW" },
    { x: 50, y: 17, label: "ST" },
    { x: 82, y: 22, label: "RW" },
  ],
  "4-2-3-1": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 35, y: 55, label: "CDM" },
    { x: 65, y: 55, label: "CDM" },
    { x: 18, y: 35, label: "LAM" },
    { x: 50, y: 32, label: "CAM" },
    { x: 82, y: 35, label: "RAM" },
    { x: 50, y: 15, label: "ST" },
  ],
  "4-1-4-1": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 50, y: 58, label: "CDM" },
    { x: 12, y: 40, label: "LM" },
    { x: 37, y: 42, label: "CM" },
    { x: 63, y: 42, label: "CM" },
    { x: 88, y: 40, label: "RM" },
    { x: 50, y: 17, label: "ST" },
  ],
  "4-5-1": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 10, y: 45, label: "LM" },
    { x: 30, y: 48, label: "CM" },
    { x: 50, y: 45, label: "CM" },
    { x: 70, y: 48, label: "CM" },
    { x: 90, y: 45, label: "RM" },
    { x: 50, y: 17, label: "ST" },
  ],
  "4-4-1-1": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 15, y: 50, label: "LM" },
    { x: 38, y: 52, label: "CM" },
    { x: 62, y: 52, label: "CM" },
    { x: 85, y: 50, label: "RM" },
    { x: 50, y: 32, label: "CAM" },
    { x: 50, y: 16, label: "ST" },
  ],
  "3-5-2": [
    { x: 50, y: 90, label: "GK" },
    { x: 20, y: 75, label: "CB" },
    { x: 50, y: 75, label: "CB" },
    { x: 80, y: 75, label: "CB" },
    { x: 8, y: 48, label: "LWB" },
    { x: 30, y: 50, label: "CM" },
    { x: 50, y: 47, label: "CM" },
    { x: 70, y: 50, label: "CM" },
    { x: 92, y: 48, label: "RWB" },
    { x: 35, y: 22, label: "ST" },
    { x: 65, y: 22, label: "ST" },
  ],
  "3-4-3": [
    { x: 50, y: 90, label: "GK" },
    { x: 20, y: 75, label: "CB" },
    { x: 50, y: 75, label: "CB" },
    { x: 80, y: 75, label: "CB" },
    { x: 12, y: 48, label: "LM" },
    { x: 37, y: 50, label: "CM" },
    { x: 63, y: 50, label: "CM" },
    { x: 88, y: 48, label: "RM" },
    { x: 18, y: 22, label: "LW" },
    { x: 50, y: 17, label: "ST" },
    { x: 82, y: 22, label: "RW" },
  ],
  "3-4-2-1": [
    { x: 50, y: 90, label: "GK" },
    { x: 20, y: 75, label: "CB" },
    { x: 50, y: 75, label: "CB" },
    { x: 80, y: 75, label: "CB" },
    { x: 12, y: 50, label: "LM" },
    { x: 37, y: 52, label: "CM" },
    { x: 63, y: 52, label: "CM" },
    { x: 88, y: 50, label: "RM" },
    { x: 32, y: 32, label: "AM" },
    { x: 68, y: 32, label: "AM" },
    { x: 50, y: 15, label: "ST" },
  ],
  "5-3-2": [
    { x: 50, y: 90, label: "GK" },
    { x: 8, y: 68, label: "LWB" },
    { x: 27, y: 75, label: "CB" },
    { x: 50, y: 75, label: "CB" },
    { x: 73, y: 75, label: "CB" },
    { x: 92, y: 68, label: "RWB" },
    { x: 25, y: 48, label: "CM" },
    { x: 50, y: 45, label: "CM" },
    { x: 75, y: 48, label: "CM" },
    { x: 35, y: 22, label: "ST" },
    { x: 65, y: 22, label: "ST" },
  ],
  "5-4-1": [
    { x: 50, y: 90, label: "GK" },
    { x: 8, y: 68, label: "LWB" },
    { x: 27, y: 75, label: "CB" },
    { x: 50, y: 75, label: "CB" },
    { x: 73, y: 75, label: "CB" },
    { x: 92, y: 68, label: "RWB" },
    { x: 12, y: 45, label: "LM" },
    { x: 37, y: 48, label: "CM" },
    { x: 63, y: 48, label: "CM" },
    { x: 88, y: 45, label: "RM" },
    { x: 50, y: 17, label: "ST" },
  ],
  "4-1-2-1-2": [
    { x: 50, y: 90, label: "GK" },
    { x: 15, y: 72, label: "LB" },
    { x: 38, y: 75, label: "CB" },
    { x: 62, y: 75, label: "CB" },
    { x: 85, y: 72, label: "RB" },
    { x: 50, y: 58, label: "CDM" },
    { x: 25, y: 45, label: "CM" },
    { x: 75, y: 45, label: "CM" },
    { x: 50, y: 32, label: "CAM" },
    { x: 35, y: 18, label: "ST" },
    { x: 65, y: 18, label: "ST" },
  ],
};

const FORMATION_NAMES = Object.keys(FORMATIONS);

/* ─── Helpers ─── */

function buildSlots(f: string): PlayerSlot[] {
  return (FORMATIONS[f] ?? FORMATIONS["4-4-2"]).map((pos, i) => ({
    idx: i,
    x: pos.x,
    y: pos.y,
    label: pos.label,
    customName: "",
    dbPlayer: null,
  }));
}

function displayName(p: PlayerSlot): string {
  if (p.dbPlayer) return p.dbPlayer.name;
  if (p.customName) return p.customName;
  return p.label;
}

/* ─── Component ─── */

export default function SquadBuilder() {
  const [formation, setFormation] = useState("4-4-2");
  const [players, setPlayers] = useState<PlayerSlot[]>(() => buildSlots("4-4-2"));
  const [title, setTitle] = useState("MY SQUAD");
  const [subtitle, setSubtitle] = useState("");
  const [mainColor, setMainColor] = useState("#10b981");
  const [selected, setSelected] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const [searchResults, setSearchResults] = useState<DBPlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [allTime, setAllTime] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragInfo = useRef<{
    idx: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  /* ─── Formation change ─── */

  const changeFormation = (f: string) => {
    setFormation(f);
    const positions = FORMATIONS[f] ?? FORMATIONS["4-4-2"];
    setPlayers((prev) =>
      prev.map((p, i) => ({
        ...p,
        x: positions[i]?.x ?? p.x,
        y: positions[i]?.y ?? p.y,
        label: positions[i]?.label ?? p.label,
      }))
    );
    setSelected(null);
  };

  const resetPositions = () => {
    const positions = FORMATIONS[formation] ?? FORMATIONS["4-4-2"];
    setPlayers((prev) =>
      prev.map((p, i) => ({
        ...p,
        x: positions[i]?.x ?? p.x,
        y: positions[i]?.y ?? p.y,
      }))
    );
  };

  const clearAll = () => {
    setPlayers(buildSlots(formation));
    setSelected(null);
    setTitle("MY SQUAD");
    setSubtitle("");
  };

  /* ─── Drag handling (mouse + touch, via useEffect) ─── */

  const [isDragging, setIsDragging] = useState(false);

  const startDrag = (idx: number, clientX: number, clientY: number) => {
    dragInfo.current = {
      idx,
      startX: clientX,
      startY: clientY,
      origX: players[idx].x,
      origY: players[idx].y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (cx: number, cy: number) => {
      if (!dragInfo.current || !pitchRef.current) return;
      const { idx, startX, startY, origX, origY } = dragInfo.current;
      const rect = pitchRef.current.getBoundingClientRect();
      const dx = ((cx - startX) / rect.width) * 100;
      const dy = ((cy - startY) / rect.height) * 100;
      const newX = Math.max(4, Math.min(96, origX + dx));
      const newY = Math.max(4, Math.min(96, origY + dy));
      setPlayers((prev) =>
        prev.map((p) => (p.idx === idx ? { ...p, x: newX, y: newY } : p))
      );
    };

    const onEnd = (cx: number, cy: number) => {
      if (!dragInfo.current) return;
      const dx = Math.abs(cx - dragInfo.current.startX);
      const dy = Math.abs(cy - dragInfo.current.startY);
      const clickedIdx = dragInfo.current.idx;
      dragInfo.current = null;
      setIsDragging(false);
      if (dx < 5 && dy < 5) {
        setSelected((prev) => (prev === clickedIdx ? null : clickedIdx));
      }
    };

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const handleMouseUp = (e: MouseEvent) => onEnd(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      onEnd(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  /* ─── Player editing / search ─── */

  useEffect(() => {
    if (selected !== null) {
      const p = players[selected];
      setEditInput(p.dbPlayer?.name ?? p.customName);
      setSearchResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const searchPlayers = async (q: string, includeAllTime?: boolean) => {
    if (q.length < 2) return;
    setSearchLoading(true);
    try {
      const active = (includeAllTime ?? allTime) ? "" : "&active=1";
      const res = await fetch(
        `/api/football/search?q=${encodeURIComponent(q)}${active}`
      );
      const json = await res.json();
      setSearchResults(json.players ?? []);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const onEditInputChange = (value: string) => {
    setEditInput(value);
    if (selected !== null) {
      setPlayers((prev) =>
        prev.map((p, i) =>
          i === selected ? { ...p, customName: value, dbPlayer: null } : p
        )
      );
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length >= 2) {
      searchTimer.current = setTimeout(() => searchPlayers(value.trim()), 300);
    } else {
      setSearchResults([]);
    }
  };

  const selectDbPlayer = (player: DBPlayer) => {
    if (selected === null) return;
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === selected
          ? { ...p, dbPlayer: player, customName: player.name }
          : p
      )
    );
    setEditInput(player.name);
    setSearchResults([]);
  };

  const clearSlot = () => {
    if (selected === null) return;
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === selected ? { ...p, dbPlayer: null, customName: "" } : p
      )
    );
    setEditInput("");
  };

  /* ─── Download ─── */

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    try {
      const html2canvas = await getHtml2Canvas();
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: "#0f1923",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      const link = document.createElement("a");
      link.download = "squad.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    await handleDownload();
    const url = window.location.href;
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      "_blank"
    );
  };

  /* ─── Deselect on pitch background click ─── */
  const handlePitchClick = () => {
    setSelected(null);
  };

  const selectedPlayer = selected !== null ? players[selected] : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* ─── Controls ─── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={formation}
            onChange={(e) => changeFormation(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
          >
            {FORMATION_NAMES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Color</label>
            <input
              type="color"
              value={mainColor}
              onChange={(e) => setMainColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-gray-700 bg-transparent"
            />
          </div>

          <button
            onClick={resetPositions}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            Reset Positions
          </button>

          <button
            onClick={clearAll}
            className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
          >
            Clear All
          </button>

          <div className="ml-auto flex gap-2">
            <button
              onClick={handleDownload}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
            >
              Download
            </button>
            <button
              onClick={handleShare}
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-gray-300 hover:text-white transition-colors"
            >
              Share on X
            </button>
          </div>
        </div>

        {/* ─── Canvas area (captured for download) ─── */}
        <div
          ref={canvasRef}
          className="rounded-2xl p-4 sm:p-6"
          style={{ backgroundColor: "#0f1923" }}
        >
          {/* Title */}
          <div className="mb-3 text-center">
            {editingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                autoFocus
                className="w-full bg-transparent text-center text-2xl font-black uppercase text-white outline-none border-b border-gray-600"
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="cursor-pointer text-2xl font-black uppercase tracking-wide text-white hover:text-gray-300 transition-colors"
              >
                {title || "Click to add title"}
              </h2>
            )}
            {editingSubtitle ? (
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                onBlur={() => setEditingSubtitle(false)}
                onKeyDown={(e) =>
                  e.key === "Enter" && setEditingSubtitle(false)
                }
                autoFocus
                className="mt-1 w-full bg-transparent text-center text-sm text-gray-400 outline-none border-b border-gray-700"
                placeholder="Subtitle..."
              />
            ) : (
              <p
                onClick={() => setEditingSubtitle(true)}
                className="mt-1 cursor-pointer text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                {subtitle || "Click to add subtitle"}
              </p>
            )}
            <p
              className="mt-1 text-xs font-bold tracking-widest"
              style={{ color: mainColor }}
            >
              {formation}
            </p>
          </div>

          {/* Pitch */}
          <div
            ref={pitchRef}
            className="relative mx-auto overflow-hidden rounded-xl border-2 select-none"
            style={{
              aspectRatio: "2 / 3",
              borderColor: "rgba(255,255,255,0.15)",
              background: `repeating-linear-gradient(
                to bottom,
                #15532c 0%,
                #15532c 8.33%,
                #196435 8.33%,
                #196435 16.66%
              )`,
              touchAction: "none",
            }}
            onClick={handlePitchClick}
          >
            {/* ─── Field markings ─── */}

            {/* Halfway line */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />

            {/* Center circle */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20"
              style={{ width: "28%", aspectRatio: "1" }}
            />

            {/* Center spot */}
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />

            {/* Top penalty area */}
            <div className="absolute left-[18%] right-[18%] top-0 border-b border-l border-r border-white/20" style={{ height: "17%" }} />

            {/* Top goal area */}
            <div className="absolute left-[32%] right-[32%] top-0 border-b border-l border-r border-white/20" style={{ height: "6%" }} />

            {/* Top penalty spot */}
            <div className="absolute left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-white/25" style={{ top: "12%" }} />

            {/* Top penalty arc */}
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border border-white/20"
              style={{ top: "8%", width: "18%", height: "18%", clipPath: "inset(50% 0 0 0)" }}
            />

            {/* Bottom penalty area */}
            <div className="absolute bottom-0 left-[18%] right-[18%] border-l border-r border-t border-white/20" style={{ height: "17%" }} />

            {/* Bottom goal area */}
            <div className="absolute bottom-0 left-[32%] right-[32%] border-l border-r border-t border-white/20" style={{ height: "6%" }} />

            {/* Bottom penalty spot */}
            <div className="absolute left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-white/25" style={{ bottom: "12%" }} />

            {/* Bottom penalty arc */}
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border border-white/20"
              style={{ bottom: "8%", width: "18%", height: "18%", clipPath: "inset(0 0 50% 0)" }}
            />

            {/* ─── Player circles ─── */}
            {players.map((p) => (
              <div
                key={p.idx}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: selected === p.idx ? 20 : 10,
                  cursor: "grab",
                  touchAction: "none",
                  width: "16%",
                }}
                onMouseDown={(e) => { e.preventDefault(); startDrag(p.idx, e.clientX, e.clientY); }}
                onTouchStart={(e) => { e.preventDefault(); startDrag(p.idx, e.touches[0].clientX, e.touches[0].clientY); }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Circle / Player image */}
                <div
                  className="relative mx-auto flex items-center justify-center rounded-full overflow-hidden"
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    backgroundColor: p.dbPlayer?.image ? "#1a1a2e" : mainColor,
                    border: selected === p.idx
                      ? `3px solid #fff`
                      : `2px solid rgba(255,255,255,0.4)`,
                    boxShadow:
                      selected === p.idx
                        ? `0 0 16px ${mainColor}, 0 0 0 3px ${mainColor}`
                        : `0 2px 8px rgba(0,0,0,0.4)`,
                  }}
                >
                  {p.dbPlayer?.image ? (
                    <Image
                      src={p.dbPlayer.image}
                      alt={p.dbPlayer.name}
                      width={200}
                      height={200}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                      unoptimized
                    />
                  ) : (
                    <span className="text-sm font-black text-white select-none sm:text-base">
                      {p.customName
                        ? p.customName
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 3) || p.label
                        : p.label}
                    </span>
                  )}
                </div>

                {/* Name label */}
                <span
                  className="mt-1 w-full truncate text-center text-xs font-bold leading-tight text-white select-none sm:text-sm"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                >
                  {p.dbPlayer ? `${countryFlag(p.dbPlayer.nationality)} ` : ""}
                  {displayName(p)}
                </span>
              </div>
            ))}
          </div>

          {/* Watermark */}
          <p className="mt-2 text-right text-[10px] text-gray-600">
            knowitball.co.uk
          </p>
        </div>

        {/* ─── Edit Panel ─── */}
        {selectedPlayer && (
          <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white"
                  style={{ backgroundColor: mainColor }}
                >
                  {selectedPlayer.label}
                </span>
                <span className="text-sm font-bold text-gray-300">
                  Edit Player — {selectedPlayer.label}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-white transition-colors text-lg"
              >
                &times;
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => {
                  if (allTime) {
                    setAllTime(false);
                    if (editInput.trim().length >= 2) searchPlayers(editInput.trim(), false);
                  }
                }}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  !allTime
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Current
              </button>
              <button
                onClick={() => {
                  if (!allTime) {
                    setAllTime(true);
                    if (editInput.trim().length >= 2) searchPlayers(editInput.trim(), true);
                  }
                }}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  allTime
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                All-Time
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={editInput}
                onChange={(e) => onEditInputChange(e.target.value)}
                placeholder={allTime ? "Search all players..." : "Search current players..."}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  ...
                </div>
              )}

              {/* Autocomplete dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => selectDbPlayer(r)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-800 border-b border-gray-800/50 last:border-0"
                    >
                      {r.image ? (
                        <Image
                          src={r.image}
                          alt={r.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-700 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">
                          {countryFlag(r.nationality)}{" "}
                          {r.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {r.position}
                          {r.nationality ? ` · ${r.nationality}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current assignment info */}
            {selectedPlayer.dbPlayer && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                {selectedPlayer.dbPlayer.image ? (
                  <Image
                    src={selectedPlayer.dbPlayer.image}
                    alt={selectedPlayer.dbPlayer.name}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-700 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {selectedPlayer.dbPlayer.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedPlayer.dbPlayer.position}
                    {selectedPlayer.dbPlayer.nationality
                      ? ` · ${countryFlag(selectedPlayer.dbPlayer.nationality)} ${selectedPlayer.dbPlayer.nationality}`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={clearSlot}
                  className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {!selectedPlayer.dbPlayer && selectedPlayer.customName && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
                <span className="text-sm text-gray-300">
                  Custom name: <span className="font-bold text-white">{selectedPlayer.customName}</span>
                </span>
                <button
                  onClick={clearSlot}
                  className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Instructions ─── */}
        {!selectedPlayer && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Drag players to reposition them. Click a player to edit their name or assign from the database.
          </div>
        )}
      </div>
    </div>
  );
}
