import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Stage } from "./Stage";
import {
  SHOW_SECONDS,
  TITLE,
  chapterTitle,
  chapters,
  formatClock,
  viewAt,
  type DurationBook,
  type Durations,
  type Lang,
} from "./model";

export function Player() {
  const [lang, setLang] = useState<Lang>("es");
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [book, setBook] = useState<DurationBook>({ es: {}, en: {} });
  const [muted, setMuted] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const playingRef = useRef(false);
  const mutedRef = useRef(false);
  const durations = book[lang];
  const durationsRef = useRef<Durations>({});
  durationsRef.current = durations;
  playingRef.current = playing;
  mutedRef.current = muted;
  const frameRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const practiceRef = useRef<HTMLAudioElement>(null);
  const timeRef = useRef(0);
  const tick = useRef(0);
  const musicRef = useRef<ReturnType<typeof createBed> | null>(null);

  const view = useMemo(() => viewAt(started ? time : 0, lang, durations), [started, time, lang, durations]);

  useEffect(() => {
    fetch("/audio/durations.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === "object" && "es" in data && "en" in data) {
          setBook(data as DurationBook);
          setHasAudio(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const n = Math.min(SHOW_SECONDS, timeRef.current + dt);
      timeRef.current = n;
      if (n >= SHOW_SECONDS) {
        setTime(n);
        setPlaying(false);
        return;
      }
      tick.current += dt;
      if (tick.current >= 0.25) {
        tick.current = 0;
        setTime(n);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio || !started) return;
    audio.src = `/audio/${lang}/${view.chapter.id}.mp3`;
    audio.load();
  }, [hasAudio, lang, started, view.chapter.id]);

  useEffect(() => {
    if (!hasAudio) return;
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const chapter = chapters.find((c) => timeRef.current >= c.start && timeRef.current < c.end) ?? chapters[chapters.length - 1];
      const offset = timeRef.current - chapter.start;
      const lesson = durationsRef.current[chapter.id] ?? 0;
      audio.muted = mutedRef.current;
      if (!playingRef.current || offset > lesson + 0.35) {
        if (!audio.paused) audio.pause();
        return;
      }
      if (audio.readyState >= 1 && Math.abs(audio.currentTime - offset) > 0.7) {
        audio.currentTime = offset;
      }
      if (audio.paused) void audio.play().catch(() => {});
    }, 500);
    return () => window.clearInterval(id);
  }, [hasAudio]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (hasAudio || !playing || !started) {
      window.speechSynthesis.cancel();
      return;
    }
    const utter = new SpeechSynthesisUtterance(view.caption + (view.action ? ". " + view.action : ""));
    utter.lang = lang === "es" ? "es-MX" : "en-US";
    utter.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [hasAudio, playing, started, view.caption, view.action, lang]);

  useEffect(() => {
    const bed = musicRef.current;
    if (!bed) return;
    bed.setLevel(!playing || muted ? 0 : view.mode === "lesson" && hasAudio ? 0.04 : 0.1);
  }, [muted, playing, view.mode, hasAudio]);

  function armAudio() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!musicRef.current && Ctx) {
      const ctx = new Ctx();
      void ctx.resume();
      musicRef.current = createBed(ctx);
    } else {
      void musicRef.current?.ctx.resume();
    }
  }

  function begin() {
    armAudio();
    setStarted(true);
    setPlaying(true);
    setTime(0);
    timeRef.current = 0;
  }

  function toggle() {
    if (!started) {
      begin();
      return;
    }
    armAudio();
    setPlaying((p) => !p);
  }

  function seek(next: number) {
    const t = Math.min(SHOW_SECONDS, Math.max(0, next));
    timeRef.current = t;
    setTime(t);
    setStarted(true);
  }

  function fullscreen() {
    const node = frameRef.current;
    if (!node) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void node.requestFullscreen().catch(() => {});
  }

  const done = started && time >= SHOW_SECONDS;
  const copy = lang === "es";

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight font-semibold text-paper sm:text-xl">Casa de Niños</p>
          <p className="truncate text-xs text-cream/70 sm:text-sm">{copy ? "Refuerzo Montessori · 60:00 · 16:9" : "Montessori reinforcement · 60:00 · 16:9"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-paper/10 p-1">
            {(["es", "en"] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`rounded-full px-3 py-2 text-sm font-extrabold ${lang === code ? "bg-gold text-ink" : "text-cream"}`}
              >
                {code === "es" ? "ES" : "EN"}
              </button>
            ))}
          </div>
          <Link
            to="/estudio"
            className="grid size-11 place-items-center rounded-full bg-paper/10 text-cream"
            aria-label={copy ? "Estudio y descargas" : "Studio and downloads"}
          >
            <BookOpen className="size-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div ref={frameRef} className="relative overflow-hidden rounded-card bg-ink">
          <Stage view={view} lang={lang} live={playing || !started} />
          {!started ? (
            <div className="absolute inset-0 grid place-items-center overflow-hidden bg-ink/40 p-2 sm:p-4">
              <div className="w-full max-w-xl rounded-2xl bg-paper px-4 py-3 text-ink sm:rounded-card sm:px-8 sm:py-6">
                <p className="text-[10px] font-extrabold tracking-[0.16em] text-terra uppercase sm:text-xs">YouTube · 16:9 · 60:00</p>
                <h1 className="mt-1 font-display text-2xl leading-none font-semibold sm:mt-2 sm:text-5xl sm:leading-[1.05]">{copy ? "Una hora divertida" : "A fun hour"}</h1>
                <p className="mt-1 text-xs leading-snug text-ink/80 sm:mt-2 sm:text-lg">
                  {copy
                    ? "Refuerzo para Casa de Niños Montessori. Luna y Ámbar, desde el primer segundo."
                    : "Reinforcement for the Montessori Children's House. Luna and Amber, from the first second."}
                </p>
                <button type="button" onClick={begin} className="mt-2 inline-flex items-center gap-2 rounded-full bg-terra px-4 py-2 text-sm font-extrabold text-paper sm:mt-5 sm:px-5 sm:py-3 sm:text-base">
                  <Play className="size-4 fill-current sm:size-5" />
                  {copy ? "Empezar la hora" : "Start the hour"}
                </button>
              </div>
            </div>
          ) : null}
          {done ? (
            <div className="absolute inset-0 grid place-items-center bg-ink/55 p-4">
              <div className="max-w-md rounded-card bg-paper px-6 py-6 text-center text-ink">
                <p className="font-display text-3xl font-semibold">{copy ? "La hora está completa" : "The hour is complete"}</p>
                <p className="mt-2 text-sm text-ink/75">{copy ? "Manos quietas, corazón contento." : "Quiet hands, happy heart."}</p>
                <button
                  type="button"
                  onClick={() => {
                    seek(0);
                    setPlaying(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-extrabold text-cream"
                >
                  <RotateCcw className="size-4" />
                  {copy ? "Otra vez" : "Play again"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <input
            aria-label={copy ? "Posición de la hora" : "Position in the hour"}
            type="range"
            min={0}
            max={SHOW_SECONDS}
            step={1}
            value={Math.min(SHOW_SECONDS, time)}
            onChange={(e) => seek(Number(e.target.value))}
            suppressHydrationWarning
            className="w-full accent-gold"
          />
          <div className="mt-1 flex justify-between font-sans text-xs font-bold tabular-nums text-cream/70">
            <span>{formatClock(time)}</span>
            <span>01:00:00</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => seek(time - 15)} className="grid size-11 place-items-center rounded-full bg-paper/10" aria-label={copy ? "Retroceder 15 segundos" : "Back 15 seconds"}>
            <SkipBack className="size-5" />
          </button>
          <button type="button" onClick={toggle} className="grid size-14 place-items-center rounded-full bg-gold text-ink" aria-label={playing ? (copy ? "Pausa" : "Pause") : copy ? "Reproducir" : "Play"}>
            {playing ? <Pause className="size-6" /> : <Play className="size-6 fill-current" />}
          </button>
          <button type="button" onClick={() => seek(time + 15)} className="grid size-11 place-items-center rounded-full bg-paper/10" aria-label={copy ? "Adelantar 15 segundos" : "Forward 15 seconds"}>
            <SkipForward className="size-5" />
          </button>
          <button type="button" onClick={() => setMuted((m) => !m)} className="grid size-11 place-items-center rounded-full bg-paper/10" aria-label={muted ? (copy ? "Activar sonido" : "Unmute") : copy ? "Silenciar" : "Mute"}>
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <button type="button" onClick={fullscreen} className="grid size-11 place-items-center rounded-full bg-paper/10" aria-label={copy ? "Pantalla completa" : "Fullscreen"}>
            <Maximize2 className="size-5" />
          </button>
          <p className="ml-auto hidden text-sm text-cream/75 sm:block">{TITLE[lang]}</p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-cream/60">
          {copy
            ? "Para niñas y niños de Casa de Niños, con un adulto cerca. No sustituye a la guía de tu escuela."
            : "For Children's House age, with an adult nearby. It does not replace your school's guide."}
        </p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {chapters.map((chapter) => {
            const on = view.chapter.id === chapter.id;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => seek(chapter.start)}
                className={`shrink-0 rounded-full px-3 py-2 text-left text-sm ${on ? "bg-paper text-ink" : "bg-paper/10 text-cream"}`}
              >
                <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-70">
                  {formatClock(chapter.start).slice(3)}
                </span>
                {chapterTitle(chapter, lang)}
              </button>
            );
          })}
        </div>
        <audio ref={audioRef} preload="auto" />
        <audio ref={practiceRef} preload="none" />
      </main>
    </div>
  );
}

function createBed(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const freqs = [196, 247, 294, 392, 494];
  const nodes = freqs.map((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? "triangle" : "sine";
    osc.frequency.value = f;
    gain.gain.value = i === 0 ? 0.22 : 0.08;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    return osc;
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain);
  lfoGain.connect(nodes[2].frequency);
  lfo.start();
  return {
    ctx,
    setLevel(v: number) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.35);
    },
  };
}
