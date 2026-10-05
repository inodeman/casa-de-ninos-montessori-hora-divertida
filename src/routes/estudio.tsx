import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TITLE, chapters, chapterTitle, youtubeStamp, type Lang } from "@/show/model";

export const Route = createFileRoute("/estudio")({ component: Studio });

function Studio() {
  const [lang, setLang] = useState<Lang>("es");
  const es = lang === "es";
  const description = buildDescription(lang);

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-lg font-semibold text-paper">
          ← {es ? "Ver la hora" : "Watch the hour"}
        </Link>
        <div className="flex rounded-full bg-paper/10 p-1">
          {(["es", "en"] as Lang[]).map((code) => (
            <button key={code} type="button" onClick={() => setLang(code)} className={`rounded-full px-3 py-2 text-sm font-extrabold ${lang === code ? "bg-gold text-ink" : "text-cream"}`}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <p className="text-xs font-extrabold tracking-[0.16em] text-gold uppercase">{es ? "Paquete para YouTube" : "YouTube package"}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight font-semibold text-paper">{TITLE[lang]}</h1>
        <p className="mt-3 text-base leading-relaxed text-cream/80">
          {es
            ? "Formato horizontal 16:9, una hora real. Ocho capítulos de refuerzo para Casa de Niños: vida práctica, sensorial, lenguaje, matemáticas, cultura y gracia y cortesía. Pensado para verse con un adulto cerca."
            : "Horizontal 16:9, a real hour. Eight reinforcement chapters for the Children's House: practical life, sensorial, language, mathematics, culture, and grace and courtesy. Meant to be watched with an adult nearby."}
        </p>

        <section className="mt-8 rounded-card bg-paper p-5 text-ink">
          <h2 className="font-display text-2xl font-semibold">{es ? "Título" : "Title"}</h2>
          <p className="mt-2 text-sm leading-relaxed">{TITLE[lang]}</p>
          <h2 className="mt-5 font-display text-2xl font-semibold">{es ? "Descripción y capítulos" : "Description and chapters"}</h2>
          <textarea readOnly value={description} className="mt-2 h-72 w-full resize-none rounded-xl bg-cream p-3 text-sm leading-relaxed text-ink" />
        </section>

        <section className="mt-6">
          <h2 className="font-display text-2xl font-semibold text-paper">{es ? "Audio por capítulo" : "Audio by chapter"}</h2>
          <ul className="mt-3 grid gap-2">
            {chapters.map((chapter) => (
              <li key={chapter.id} className="flex items-center justify-between gap-3 rounded-2xl bg-paper/10 px-3 py-2">
                <span>
                  <span className="mr-2 text-xs font-bold text-gold">{youtubeStamp(chapter.start)}</span>
                  {chapterTitle(chapter, lang)}
                </span>
                <a className="text-sm font-extrabold text-gold" href={`/audio/${lang}/${chapter.id}.mp3`}>
                  MP3
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-cream/70">
            {es
              ? "La mezcla de una hora, con música, está en el repositorio: exports/es y exports/en."
              : "The one-hour mix, with music, lives in the repository: exports/es and exports/en."}
          </p>
        </section>

        <section className="mt-8 text-sm leading-relaxed text-cream/75">
          <p>
            {es
              ? "Material independiente de refuerzo. No está afiliado a AMI ni a ninguna escuela Montessori. Montessori es el nombre del método fundado por Maria Montessori."
              : "Independent reinforcement material. Not affiliated with AMI or any Montessori school. Montessori is the name of the method founded by Maria Montessori."}
          </p>
        </section>
      </main>
    </div>
  );
}

function buildDescription(lang: Lang): string {
  const lines = [
    TITLE[lang],
    "",
    lang === "es"
      ? "Una hora completa para reforzar, con calma y con juego, lo que se vive en la Casa de Niños. Luna y Ámbar guían manos, sentidos, palabras, números, mundo y cortesía."
      : "A full hour to reinforce, calmly and playfully, what children live in the Children's House. Luna and Amber guide hands, senses, words, numbers, the world, and courtesy.",
    "",
    lang === "es" ? "Capítulos" : "Chapters",
  ];
  for (const chapter of chapters) {
    lines.push(`${youtubeStamp(chapter.start)} ${chapterTitle(chapter, lang)}`);
  }
  lines.push(
    "",
    lang === "es"
      ? "Para niñas y niños de aproximadamente 3 a 6 años, con un adulto cerca. El agua de verdad y los objetos pequeños siempre con supervisión. Esto no sustituye el trabajo de una guía preparada."
      : "For children about 3 to 6, with an adult nearby. Real water and small objects always with supervision. This does not replace the work of a prepared guide.",
    "",
    "#Montessori #CasaDeNiños #EducaciónInfantil",
  );
  return lines.join("\n");
}
