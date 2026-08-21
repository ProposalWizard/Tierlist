"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Anton } from "next/font/google";

const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap" });

/**
 * THE FRONT PAGE.
 *
 * A real front page, not a generated one — the newspaper art is a supplied
 * asset (public/star/fa-youth-cup-newspaper.png) with its headline band left
 * blank on purpose. Everything this file does is put four lines of type into
 * that blank band: the player's surname, WINS, the club, THE FA YOUTH CUP! —
 * the same shape as any real back-page splash, where the words that matter
 * are set as big as the page allows rather than at one fixed size.
 *
 * `BOX` below is not a guess — it is the actual blank band's position,
 * measured directly off the template's own pixels (1132×1390): the gap
 * between the double rule near the top and the photograph beneath it, inset
 * to the photograph's own left and right edges so the type block lines up
 * with the picture it sits above rather than the page's outer margin.
 */
const NEWSPAPER_SRC = "/star/fa-youth-cup-newspaper.png";
const BOX = { top: 6.1, bottom: 46.4, left: 4.9, right: 4.9 }; // % of the image

/**
 * One line of type, scaled to fill its row exactly — a headline's actual
 * behaviour: WINS, alone on its line, is not printed at the same size as
 * MANCHESTER UNITED, it is printed as big as that same width allows, which is
 * a great deal bigger. Font-size can't do this on its own — the pixel width a
 * string renders at depends on the string, not just a chosen size — so this
 * measures the line at its natural size and scales it, via CSS transform,
 * until it exactly fills the row: by width normally, or by height first if
 * the text is short enough that width-fitting would blow through the row's
 * own ceiling.
 *
 * `visibility: hidden` until the first measurement lands, the same guard
 * TrialReward's own signature animation needed for the same reason — one
 * frame of unscaled text flashed at its raw, oversized default is exactly
 * the kind of thing that reads as broken even though it self-corrects
 * immediately after.
 */
function FitLine({ text }: { text: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current, el = textRef.current;
    if (!wrap || !el) return;
    const measure = () => {
      el.style.transform = "scale(1)";
      const wrapRect = wrap.getBoundingClientRect();
      const textRect = el.getBoundingClientRect();
      if (textRect.width === 0 || textRect.height === 0) return;
      setScale(Math.min(wrapRect.width / textRect.width, wrapRect.height / textRect.height));
      setReady(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      <span
        ref={textRef}
        className={`${anton.className} whitespace-nowrap uppercase leading-none text-black`}
        style={{ fontSize: 64, transform: `scale(${scale})`, transformOrigin: "center", visibility: ready ? "visible" : "hidden" }}
      >
        {text}
      </span>
    </div>
  );
}

export default function NewspaperHeadline({ surname, club }: { surname: string; club: string }) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={NEWSPAPER_SRC} alt="" className="block w-full" />
      <div
        className="absolute flex flex-col gap-[1.2%]"
        style={{
          top: `${BOX.top}%`, bottom: `${100 - BOX.bottom}%`,
          left: `${BOX.left}%`, right: `${BOX.right}%`,
        }}
      >
        <FitLine text={surname} />
        <FitLine text="Wins" />
        <FitLine text={club} />
        <FitLine text="The FA Youth Cup!" />
      </div>
    </div>
  );
}
