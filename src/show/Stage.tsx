import { useEffect, useState } from "react";
import type { Lang, ShowView } from "./model";
import { chapterTitle } from "./model";

const RODS = [18, 28, 38, 48, 58, 70, 82, 94, 106, 120];

export function Stage({
  view,
  lang,
  live,
}: {
  view: ShowView;
  lang: Lang;
  live: boolean;
}) {
  const [shown, setShown] = useState(view.art);
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    if (view.art === shown) return;
    setPrev(shown);
    setShown(view.art);
    const t = window.setTimeout(() => setPrev(null), 700);
    return () => window.clearTimeout(t);
  }, [view.art, shown]);

  const speaker =
    view.speaker === "luna" ? "Luna" : view.speaker === "ambar" ? (lang === "es" ? "Ámbar" : "Amber") : lang === "es" ? "Tu turno" : "Your turn";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-card bg-ink">
      {prev ? (
        <img src={`/art/${prev}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700" />
      ) : null}
      <img
        key={shown + view.lineIndex}
        src={`/art/${shown}.jpg`}
        alt={lang === "es" ? "Escena de la Casa de Niños" : "Children's House scene"}
        className="ken-img absolute inset-0 h-full w-full object-cover"
        style={{ animation: "ken 32s ease-in-out alternate infinite" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-ink/25" />
      {view.chapter.id === "apertura" && view.mode === "lesson" ? <Burst /> : null}
      <div className="absolute top-3 left-3 flex max-w-[70%] items-center gap-2 sm:top-4 sm:left-4">
        <span className="rounded-full bg-paper/95 px-3 py-1 text-xs font-extrabold tracking-wide text-ink uppercase">
          {String(view.chapterIndex + 1).padStart(2, "0")}
        </span>
        <span className="truncate rounded-full bg-ink/55 px-3 py-1 text-xs font-bold text-cream backdrop-blur-sm sm:text-sm">
          {chapterTitle(view.chapter, lang)}
        </span>
      </div>
      <Widget view={view} live={live} />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
        <p className="mb-1 text-xs font-extrabold tracking-[0.16em] text-gold uppercase">{speaker}</p>
        <p
          key={view.caption}
          className="max-w-3xl font-display text-lg leading-snug font-medium text-paper sm:text-2xl"
          style={{ animation: "rise-in 420ms ease both" }}
        >
          {view.caption}
        </p>
        {view.action ? (
          <p key={view.action} className="mt-2 max-w-2xl text-sm leading-snug text-cream/90 sm:text-base" style={{ animation: "rise-in 520ms ease both" }}>
            {view.action}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Burst() {
  const dots = [
    "left-[8%] top-[18%] bg-gold",
    "left-[18%] top-[30%] bg-terra",
    "left-[78%] top-[16%] bg-sage",
    "left-[86%] top-[34%] bg-gold",
    "left-[70%] top-[22%] bg-paper",
  ];
  return (
    <>
      {dots.map((c) => (
        <span key={c} className={`pop-in absolute size-3 rounded-full ${c} sm:size-4`} style={{ animation: "pop 700ms ease both, pulse-soft 2.8s ease-in-out infinite" }} />
      ))}
    </>
  );
}

function Widget({ view, live }: { view: ShowView; live: boolean }) {
  if (view.widget === "none") return null;
  return (
    <div className="absolute top-14 right-3 sm:top-16 sm:right-5">
      <div className="rounded-2xl bg-paper/92 px-3 py-2 text-ink shadow-lg backdrop-blur-sm">
        {view.widget === "beads" ? <Beads n={view.n} /> : null}
        {view.widget === "rods" ? <Rods /> : null}
        {view.widget === "colors" ? <Colors /> : null}
        {view.widget === "breathe" ? <Breathe live={live} /> : null}
        {view.widget === "clap" ? <Clap live={live} /> : null}
        {view.widget === "count" ? <Count n={view.n} live={live} /> : null}
        {view.widget === "letters" ? <Letters /> : null}
        {view.widget === "pour" ? <Pour live={live} /> : null}
        {view.widget === "bell" ? <Bell live={live} /> : null}
        {view.widget === "walk" ? <Walk live={live} /> : null}
      </div>
    </div>
  );
}

function Beads({ n }: { n: number }) {
  const count = Math.min(10, Math.max(5, n));
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="pop-in size-3 rounded-full bg-gold sm:size-3.5" style={{ animation: `pop 500ms ease ${i * 70}ms both` }} />
      ))}
    </div>
  );
}

function Rods() {
  return (
    <div className="flex items-end gap-0.5">
      {RODS.map((h, i) => (
        <span key={h} className={`w-1.5 rounded-sm sm:w-2 ${i % 2 ? "bg-ink" : "bg-terra"}`} style={{ height: h / 3 }} />
      ))}
    </div>
  );
}

function Colors() {
  const tones = ["bg-terra", "bg-gold", "bg-sage", "bg-ink", "bg-gold", "bg-terra"];
  return (
    <div className="flex gap-1">
      {tones.map((c, i) => (
        <span key={c + i} className={`h-8 w-3 rounded-sm ${c}`} />
      ))}
    </div>
  );
}

function Breathe({ live }: { live: boolean }) {
  return (
    <div className="grid size-14 place-items-center">
      <span className="size-10 rounded-full bg-sage/80" style={{ animation: live ? "pulse-soft 3.6s ease-in-out infinite" : undefined }} />
    </div>
  );
}

function Clap({ live }: { live: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="size-6 rounded-full bg-terra" style={{ animation: live ? "pulse-soft 0.8s ease-in-out infinite" : undefined }} />
      <span className="size-6 rounded-full bg-gold" style={{ animation: live ? "pulse-soft 0.8s ease-in-out 0.2s infinite" : undefined }} />
    </div>
  );
}

function Count({ n, live }: { n: number; live: boolean }) {
  const [value, setValue] = useState(1);
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setValue((v) => (v % Math.max(1, n)) + 1), 900);
    return () => window.clearInterval(id);
  }, [live, n]);
  return <p className="font-display text-3xl leading-none font-semibold tabular-nums">{value}</p>;
}

function Letters() {
  const tiles = ["a", "m", "o"];
  return (
    <div className="flex gap-1">
      {tiles.map((ch) => (
        <span key={ch} className="grid size-8 place-items-center rounded-md bg-cream font-display text-lg text-ink">
          {ch}
        </span>
      ))}
    </div>
  );
}

function Pour({ live }: { live: boolean }) {
  return (
    <div className="relative h-12 w-8 overflow-hidden rounded-b-md border-2 border-ink/30 bg-paper">
      <span
        className="fill-up absolute inset-x-0 bottom-0 origin-bottom bg-sage/70"
        style={{ animation: live ? "fill-up 3.5s ease-in-out infinite alternate" : undefined, height: "100%" }}
      />
    </div>
  );
}

function Bell({ live }: { live: boolean }) {
  return (
    <span className="grid size-10 place-items-center rounded-full bg-gold font-display text-lg text-ink" style={{ animation: live ? "pulse-soft 1.6s ease-in-out infinite" : undefined }}>
      ●
    </span>
  );
}

function Walk({ live }: { live: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="size-2.5 rounded-full bg-ink" style={{ animation: live ? `pop 900ms ease ${i * 180}ms infinite` : undefined }} />
      ))}
    </div>
  );
}
