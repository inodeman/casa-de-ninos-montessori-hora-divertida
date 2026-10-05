#!/usr/bin/env python3
"""Chapter narration in es-MX and en-US, two voices, saved under public/audio."""

import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path("/workspace")
PROGRAM = json.loads((ROOT / "src/show/program.json").read_text())
VOICES = {
    "es": {"luna": ("es-MX-DaliaNeural", "-8%", "+0Hz"), "ambar": ("es-MX-DaliaNeural", "+14%", "+28Hz")},
    "en": {"luna": ("en-US-JennyNeural", "-6%", "+0Hz"), "ambar": ("en-US-AnaNeural", "+6%", "+8Hz")},
}


async def save_line(text: str, voice: str, rate: str, pitch: str, dest: Path) -> None:
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await comm.save(str(dest))


async def chapter(lang: str, chapter: dict, sem: asyncio.Semaphore) -> float:
    out_dir = ROOT / "public" / "audio" / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    work = ROOT / "exports" / "build" / lang / chapter["id"]
    work.mkdir(parents=True, exist_ok=True)
    pieces = []
    for i, line in enumerate(chapter["lesson"]):
        voice, rate, pitch = VOICES[lang][line["speaker"]]
        dest = work / f"{i:02d}.mp3"
        if not dest.exists() or dest.stat().st_size < 800:
            async with sem:
                await save_line(line[lang], voice, rate, pitch, dest)
        pieces.append(dest)
    voice, rate, pitch = VOICES[lang]["luna"]
    for i, beat in enumerate(chapter["practice"]):
        dest = work / f"p{i:02d}.mp3"
        text = beat[lang] + ". " + (beat["actEs"] if lang == "es" else beat["actEn"])
        if not dest.exists() or dest.stat().st_size < 800:
            async with sem:
                await save_line(text, voice, rate, pitch, dest)
        print(f"  practice {lang} {chapter['id']} {i}", flush=True)
        public_copy = out_dir / f"{chapter['id']}-p{i}.mp3"
        if not public_copy.exists() or public_copy.stat().st_size < 800:
            public_copy.write_bytes(dest.read_bytes())
    concat = work / "list.txt"
    lines = []
    for piece in pieces:
        lines.append(f"file '{piece}'")
    concat.write_text("\n".join(lines) + "\n")
    out = out_dir / f"{chapter['id']}.mp3"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
            "-c:a", "libmp3lame", "-q:a", "4", str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    proc = subprocess.run(
        ["ffmpeg", "-i", str(out), "-f", "null", "-"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    dur = 0.0
    for line in proc.stderr.splitlines():
        if "Duration:" in line:
            stamp = line.split("Duration:", 1)[1].split(",")[0].strip()
            h, m, s = stamp.split(":")
            dur = int(h) * 3600 + int(m) * 60 + float(s)
            break
    if dur <= 0:
        raise RuntimeError(f"no duration for {out}")
    print(f"OK {lang} {chapter['id']} {dur:.1f}s", flush=True)
    return dur


async def main() -> None:
    sem = asyncio.Semaphore(5)
    book = {"es": {}, "en": {}}
    tasks = []
    meta = []
    for lang in ("es", "en"):
        for chapter_data in PROGRAM["chapters"]:
            meta.append((lang, chapter_data["id"]))
            tasks.append(chapter(lang, chapter_data, sem))
    durations = await asyncio.gather(*tasks)
    for (lang, cid), dur in zip(meta, durations):
        book[lang][cid] = round(dur, 3)
    dest = ROOT / "public" / "audio" / "durations.json"
    dest.write_text(json.dumps(book, indent=2) + "\n")
    print(json.dumps(book, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
