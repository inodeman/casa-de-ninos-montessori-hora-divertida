#!/usr/bin/env python3
"""Fill every practice beat with spoken coaching so the hour is narrated, not read."""

import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path("/workspace")
PROGRAM = json.loads((ROOT / "src/show/program.json").read_text())
BOOK = json.loads((ROOT / "public/audio/durations.json").read_text())
PHRASES = ROOT / "exports" / "build" / "phrases"
PUBLIC = ROOT / "public" / "audio"

VOICES = {
    "es": {
        "luna": ("es-MX-DaliaNeural", "-12%", "+0Hz"),
        "ambar": ("es-MX-DaliaNeural", "+6%", "+26Hz"),
    },
    "en": {
        "luna": ("en-US-JennyNeural", "-8%", "+0Hz"),
        "ambar": ("en-US-AnaNeural", "-2%", "+6Hz"),
    },
}

COACH = {
    "es": {
        "breathe": "Respira conmigo. Huele la flor. Sopla la vela. Huele. Sopla.",
        "walk": "Talón, punta. Talón, punta. Los brazos van quietos.",
        "clap": "Palmas suaves. Una, dos, y un silencio chiquito.",
        "pour": "Inclina. Espera. Endereza. Otra vez, sin apurarte.",
        "colors": "Mira el color. Di su nombre. Busca otro, caminando.",
        "beads": "Toca una sola cuenta. Luego la siguiente. Despacio.",
        "rods": "La más grande abajo. La más chica arriba.",
        "letters": "Estira el sonido. Escríbelo en el aire, de izquierda a derecha.",
        "bell": "Escucha el cuarto. Deja pasar el ruido. Quédate en el silencio.",
        "none": "Hazlo con las manos tranquilas. Yo estoy aquí contigo.",
        "count": "",
    },
    "en": {
        "breathe": "Breathe with me. Smell the flower. Blow the candle. Smell. Blow.",
        "walk": "Heel, toe. Heel, toe. Arms stay quiet.",
        "clap": "Soft claps. One, two, and a tiny silence.",
        "pour": "Tilt. Wait. Straighten up. Once more, unhurried.",
        "colors": "Look at the color. Say its name. Find another, walking.",
        "beads": "Touch one bead. Then the next one. Slowly.",
        "rods": "The biggest one at the bottom. The smallest on top.",
        "letters": "Stretch the sound. Write it in the air, left to right.",
        "bell": "Listen to the room. Let the noise pass. Stay in the quiet.",
        "none": "Do it with quiet hands. I am right here with you.",
        "count": "",
    },
}

SOFT = {
    "es": {
        "breathe": "Sigue el aire. Entra. Sale. Tú puedes.",
        "walk": "Un paso elegante. Luego otro. Así se camina en la casa.",
        "clap": "Ahora más suave. Casi un secreto.",
        "pour": "La jarra sube. El vaso espera. Tú mandas.",
        "colors": "Tus ojos presentan los colores. Rojo con rojo. Azul con azul.",
        "beads": "Cada cuenta es un uno. Juntas hacen más.",
        "rods": "Compara con la mano, sin prisa.",
        "letters": "La primera letra es una puerta. Tócala otra vez.",
        "bell": "La campana puede quedarse callada. Eso es control.",
        "none": "Termina lo que empezaste. El estante espera con calma.",
        "count": "Si te pierdes, vuelve a uno. Eso también es saber contar.",
    },
    "en": {
        "breathe": "Follow the air. In. Out. You can do it.",
        "walk": "One elegant step. Then another. That is how we walk in the house.",
        "clap": "Now even softer. Almost a secret.",
        "pour": "The pitcher rises. The glass waits. You are in charge.",
        "colors": "Your eyes introduce the colors. Red with red. Blue with blue.",
        "beads": "Each bead is a one. Together they make more.",
        "rods": "Compare with your hand, not in a hurry.",
        "letters": "The first letter is a door. Trace it once more.",
        "bell": "The bell can stay quiet. That is control.",
        "none": "Finish what you started. The shelf waits calmly.",
        "count": "If you get lost, go back to one. That is counting too.",
    },
}

NUM_ES = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"]
NUM_EN = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]


def lesson_window(chapter: dict, measured: float) -> float:
    slot = chapter["end"] - chapter["start"]
    if measured and measured > 1:
        return min(measured, slot - 20)
    return slot * 0.42


def count_line(lang: str, n: int | None) -> str:
    count = max(1, min(10, int(n or 5)))
    if lang == "es":
        seq = ", ".join(NUM_ES[:count])
        return f"Cuenta conmigo, muy lento: {seq}."
    seq = ", ".join(NUM_EN[:count])
    return f"Count with me, very slowly: {seq}."


def cycle_for(beat: dict, lang: str) -> list[tuple[str, str]]:
    title = str(beat[lang]).strip().rstrip(".")
    act = str(beat["actEs"] if lang == "es" else beat["actEn"]).strip().rstrip(".")
    widget = str(beat.get("widget") or "none")
    coach = COACH[lang].get(widget) or COACH[lang]["none"]
    soft = SOFT[lang].get(widget) or SOFT[lang]["none"]
    if widget == "count" or beat.get("n"):
        coach = count_line(lang, beat.get("n"))
    if lang == "es":
        praise = "Vas muy bien. Otra vez, despacito. No hay prisa."
        again = "Vamos otra vez, con calma."
    else:
        praise = "You are doing well. Once more, slowly. There is no rush."
        again = "Let's do it once more, calmly."
    return [
        ("luna", f"{title}. {act}."),
        ("ambar", coach),
        ("luna", f"{again} {act}."),
        ("ambar", praise),
        ("luna", f"{act}."),
        ("ambar", soft),
    ]


def slug(text: str) -> str:
    keep = []
    for ch in text.lower():
        if ch.isalnum():
            keep.append(ch)
        elif keep and keep[-1] != "-":
            keep.append("-")
    return "".join(keep).strip("-")[:80]


def duration_of(path: Path) -> float:
    proc = subprocess.run(
        ["ffmpeg", "-i", str(path), "-f", "null", "-"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        errors="replace",
    )
    for line in proc.stderr.splitlines():
        if "Duration:" in line:
            stamp = line.split("Duration:", 1)[1].split(",")[0].strip()
            h, m, s = stamp.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f"no duration for {path}")


def plan(phrases: list[tuple[str, str]], lengths: dict[tuple[str, str], float], target: float):
    gap = 1.15
    seq: list[tuple[str, object]] = []
    t = 0.0
    i = 0
    while i < 48:
        key = phrases[i % len(phrases)]
        spoken = lengths[key]
        if seq and t + spoken > target - 0.35:
            break
        seq.append(("speech", key))
        t += spoken
        i += 1
        room = target - t
        nxt = lengths[phrases[i % len(phrases)]]
        if room < nxt + 0.5:
            break
        use = min(gap, max(0.45, room - nxt - 0.2))
        if use < 0.35:
            break
        seq.append(("gap", use))
        t += use
    extra = target - t - 0.35
    gaps = [k for k, item in enumerate(seq) if item[0] == "gap"]
    if extra > 0.4 and gaps:
        share = min(extra / len(gaps), 1.3)
        for k in gaps:
            kind, value = seq[k]
            seq[k] = (kind, float(value) + share)
            t += share
    return seq


async def synthesize(key: tuple[str, str, str], dest: Path, sem: asyncio.Semaphore) -> None:
    lang, speaker, text = key
    voice, rate, pitch = VOICES[lang][speaker]
    if dest.exists() and dest.stat().st_size > 700:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    last = "tts failed"
    for attempt in range(5):
        try:
            async with sem:
                comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
                await comm.save(str(dest))
            if dest.stat().st_size > 700:
                return
            last = "file too small"
        except Exception as exc:  # network blip
            last = str(exc)
        await asyncio.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"{last}: {text[:80]}")


def to_wav(src: Path, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        return
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "22050", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def silence(dest: Path, seconds: float) -> None:
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono",
            "-t", f"{seconds:.3f}", "-c:a", "pcm_s16le", str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def render_beat(seq, wavs: dict, target: float, dest: Path, work: Path) -> None:
    work.mkdir(parents=True, exist_ok=True)
    lines = []
    for i, item in enumerate(seq):
        kind, value = item
        if kind == "speech":
            lines.append(f"file '{wavs[value]}'")
        else:
            gap = work / f"gap-{i}.wav"
            silence(gap, float(value))
            lines.append(f"file '{gap}'")
    listing = work / "list.txt"
    listing.write_text("\n".join(lines) + "\n")
    dest.parent.mkdir(parents=True, exist_ok=True)
    fade_at = max(0.0, target - 0.25)
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
            "-af", f"apad=whole_dur={target:.3f},afade=t=out:st={fade_at:.3f}:d=0.22",
            "-t", f"{target:.3f}",
            "-c:a", "libmp3lame", "-q:a", "4",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


async def main() -> None:
    sem = asyncio.Semaphore(4)
    jobs: dict[tuple[str, str, str], Path] = {}
    beats = []
    for lang in ("es", "en"):
        for chapter in PROGRAM["chapters"]:
            measured = float(BOOK[lang][chapter["id"]])
            slot = chapter["end"] - chapter["start"]
            practice_for = slot - lesson_window(chapter, measured)
            each = practice_for / max(1, len(chapter["practice"]))
            for index, beat in enumerate(chapter["practice"]):
                phrases = cycle_for(beat, lang)
                beats.append((lang, chapter["id"], index, each, phrases))
                for speaker, text in phrases:
                    key = (lang, speaker, text)
                    jobs[key] = PHRASES / lang / speaker / f"{slug(text)}.mp3"

    print(f"synthesizing {len(jobs)} phrases", flush=True)
    await asyncio.gather(*(synthesize(key, path, sem) for key, path in jobs.items()))

    lengths: dict[tuple[str, str], float] = {}
    wavs: dict[tuple[str, str], Path] = {}
    for (lang, speaker, text), mp3 in jobs.items():
        wav = mp3.with_suffix(".wav")
        to_wav(mp3, wav)
        lengths[(speaker, text)] = duration_of(wav)
        wavs[(lang, speaker, text)] = wav

    report = {}
    for lang, cid, index, each, phrases in beats:
        local_wavs = {(speaker, text): wavs[(lang, speaker, text)] for speaker, text in phrases}
        local_lengths = {(speaker, text): lengths[(speaker, text)] for speaker, text in phrases}
        seq = plan(phrases, local_lengths, each)
        work = ROOT / "exports" / "build" / "practice-work" / lang / cid / f"{index:02d}"
        public = PUBLIC / lang / f"{cid}-p{index}.mp3"
        build = ROOT / "exports" / "build" / lang / cid / f"p{index:02d}.mp3"
        render_beat(seq, local_wavs, each, public, work)
        build.write_bytes(public.read_bytes())
        got = duration_of(public)
        report[f"{lang}/{cid}-p{index}"] = {"target": round(each, 2), "got": round(got, 2)}
        print(f"OK {lang} {cid} p{index} target={each:.1f}s got={got:.1f}s", flush=True)

    (PUBLIC / "practice-narration.json").write_text(json.dumps(report, indent=2) + "\n")
    print("done", len(report), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
