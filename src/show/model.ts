import raw from "./program.json";

export type Lang = "es" | "en";
export type Speaker = "luna" | "ambar";
export type Widget =
  | "beads"
  | "rods"
  | "colors"
  | "breathe"
  | "clap"
  | "count"
  | "letters"
  | "pour"
  | "bell"
  | "walk"
  | "none";

export type LessonLine = {
  speaker: Speaker;
  art: string;
  widget: Widget;
  es: string;
  en: string;
};

export type PracticeBeat = {
  art: string;
  widget: Widget;
  es: string;
  en: string;
  actEs: string;
  actEn: string;
  n?: number;
};

export type Chapter = {
  id: string;
  start: number;
  end: number;
  titleEs: string;
  titleEn: string;
  lesson: LessonLine[];
  practice: PracticeBeat[];
};

export const SHOW_SECONDS = raw.showSeconds;
export const TITLE: Record<Lang, string> = { es: raw.titleEs, en: raw.titleEn };
export const chapters = raw.chapters as Chapter[];

export type Durations = Record<string, number>;
export type DurationBook = Record<Lang, Durations>;

export type ShowView = {
  chapter: Chapter;
  chapterIndex: number;
  mode: "lesson" | "practice";
  art: string;
  widget: Widget;
  caption: string;
  action: string;
  speaker: Speaker | null;
  n: number;
  lineIndex: number;
  lineCount: number;
};

const FALLBACK_LESSON_SHARE = 0.42;

export function chapterAt(time: number): { chapter: Chapter; index: number } {
  const t = Math.min(Math.max(0, time), SHOW_SECONDS);
  const index = Math.max(
    0,
    chapters.findIndex((c, i) => t >= c.start && (t < c.end || i === chapters.length - 1)),
  );
  return { chapter: chapters[index] ?? chapters[0], index };
}

export function lessonWindow(chapter: Chapter, durations?: Durations): number {
  const slot = chapter.end - chapter.start;
  const measured = durations?.[chapter.id];
  if (measured && measured > 1) return Math.min(measured, slot - 20);
  return slot * FALLBACK_LESSON_SHARE;
}

export function viewAt(time: number, lang: Lang, durations?: Durations): ShowView {
  const { chapter, index } = chapterAt(time);
  const offset = Math.max(0, time - chapter.start);
  const lessonFor = lessonWindow(chapter, durations);
  if (chapter.lesson.length && offset < lessonFor) {
    const i = Math.min(
      chapter.lesson.length - 1,
      Math.floor((offset / Math.max(lessonFor, 0.01)) * chapter.lesson.length),
    );
    const line = chapter.lesson[i];
    return {
      chapter,
      chapterIndex: index,
      mode: "lesson",
      art: line.art,
      widget: line.widget,
      caption: line[lang],
      action: "",
      speaker: line.speaker,
      n: 8,
      lineIndex: i,
      lineCount: chapter.lesson.length,
    };
  }
  const practiceFor = Math.max(1, chapter.end - chapter.start - lessonFor);
  const pOffset = Math.max(0, offset - lessonFor);
  const list = chapter.practice.length ? chapter.practice : [];
  const i = list.length
    ? Math.min(list.length - 1, Math.floor((pOffset / practiceFor) * list.length))
    : 0;
  const beat = list[i];
  return {
    chapter,
    chapterIndex: index,
    mode: "practice",
    art: beat?.art ?? chapter.lesson.at(-1)?.art ?? "classroom",
    widget: beat?.widget ?? "none",
    caption: beat ? beat[lang] : "",
    action: beat ? (lang === "es" ? beat.actEs : beat.actEn) : "",
    speaker: null,
    n: beat?.n ?? 6,
    lineIndex: i,
    lineCount: list.length,
  };
}

export function formatClock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function youtubeStamp(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function chapterTitle(chapter: Chapter, lang: Lang): string {
  return lang === "es" ? chapter.titleEs : chapter.titleEn;
}
