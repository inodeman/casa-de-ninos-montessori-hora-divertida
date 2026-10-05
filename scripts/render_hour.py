#!/usr/bin/env python3
"""Build a 60-minute 16:9 master (video, audio, captions) in Spanish and English."""

import json
import math
import struct
import subprocess
import wave
from pathlib import Path

ROOT = Path("/workspace")
PROGRAM = json.loads((ROOT / "src/show/program.json").read_text())
BOOK = json.loads((ROOT / "public/audio/durations.json").read_text())
ART = ROOT / "public" / "art"
BUILD = ROOT / "exports" / "build"
SHOW = 3600


def probe(path: Path) -> float:
    out = subprocess.check_output(
        ["ffmpeg", "-i", str(path), "-f", "null", "-"],
        stderr=subprocess.STDOUT,
        text=True,
        errors="replace",
    )
    for line in out.splitlines():
        if "Duration:" in line:
            stamp = line.split("Duration:", 1)[1].split(",")[0].strip()
            h, m, s = stamp.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f"no duration for {path}")


def write_music(dest: Path) -> None:
    loop = dest.with_name("music-loop.wav")
    if not loop.exists() or loop.stat().st_size < 1000:
        sr = 22050
        seconds = 32
        n = sr * seconds
        notes = [196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63]
        frames = bytearray()
        for i in range(n):
            t = i / sr
            step = int(t / 4) % len(notes)
            local = t % 4
            env = math.exp(-local * 1.15)
            tone = math.sin(2 * math.pi * notes[step] * t) * env * 0.22
            tone += math.sin(2 * math.pi * notes[step] * 2 * t) * env * 0.05
            pad = (
                math.sin(2 * math.pi * 196 * t) * 0.04
                + math.sin(2 * math.pi * 246.94 * t) * 0.03
                + math.sin(2 * math.pi * 392 * t) * 0.02
            )
            sample = max(-1.0, min(1.0, tone + pad))
            frames += struct.pack("<h", int(sample * 28000))
        loop.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(loop), "w") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(sr)
            handle.writeframes(frames)
    if dest.exists() and dest.stat().st_size > 1_000_000:
        return
    subprocess.check_call(
        ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(loop), "-t", str(SHOW), "-c:a", "pcm_s16le", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def srt_time(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def timeline(lang: str):
    cues = []
    images = []
    cursor = 0.0
    for chapter in PROGRAM["chapters"]:
        slot = chapter["end"] - chapter["start"]
        spoken = float(BOOK[lang][chapter["id"]])
        lesson_for = min(spoken, slot - 12)
        practice_for = slot - lesson_for
        lesson = chapter["lesson"]
        practice = chapter["practice"]
        for i, line in enumerate(lesson):
            dur = lesson_for / len(lesson)
            text = line[lang]
            cues.append((cursor, cursor + dur - 0.05, text))
            images.append((line["art"], dur))
            cursor += dur
        for beat in practice:
            dur = practice_for / len(practice)
            text = beat[lang] + "\n" + (beat["actEs"] if lang == "es" else beat["actEn"])
            cues.append((cursor, cursor + dur - 0.05, text))
            images.append((beat["art"], dur))
            cursor += dur
    # Numerical drift from rounding — pin the last image.
    drift = SHOW - cursor
    if images and abs(drift) > 0.01:
        art, dur = images[-1]
        images[-1] = (art, dur + drift)
        start, end, text = cues[-1]
        cues[-1] = (start, end + drift, text)
    return cues, images


def write_srt(cues, dest: Path) -> None:
    blocks = []
    for i, (start, end, text) in enumerate(cues, start=1):
        blocks.append(f"{i}\n{srt_time(start)} --> {srt_time(max(end, start + 0.4))}\n{text}\n")
    dest.write_text("\n".join(blocks), encoding="utf-8")


def write_concat(images, dest: Path) -> None:
    lines = []
    for art, dur in images:
        lines.append(f"file '{ART / (art + '.jpg')}'")
        lines.append(f"duration {dur:.3f}")
    # concat demuxer requires the last file repeated
    lines.append(f"file '{ART / (images[-1][0] + '.jpg')}'")
    dest.write_text("\n".join(lines) + "\n")


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


def cues_for(lang: str):
    """Visual cues whose lesson length follows the real spoken lines."""
    cues = []
    images = []
    clips = []
    for chapter in PROGRAM["chapters"]:
        slot_end = float(chapter["end"])
        cursor = float(chapter["start"])
        lesson = chapter["lesson"]
        practice = chapter["practice"]
        spoken = []
        for i, _line in enumerate(lesson):
            spoken.append(duration_of(BUILD / lang / chapter["id"] / f"{i:02d}.mp3"))
        lesson_total = sum(spoken)
        room = slot_end - cursor
        if lesson_total > room - 8:
            scale = (room - 8) / lesson_total
            spoken = [d * scale for d in spoken]
            lesson_total = sum(spoken)
        for i, line in enumerate(lesson):
            dur = spoken[i]
            cues.append((cursor, cursor + max(0.4, dur - 0.05), line[lang]))
            images.append((line["art"], dur))
            clips.append((BUILD / lang / chapter["id"] / f"{i:02d}.mp3", dur))
            cursor += dur
        practice_for = max(0.5, slot_end - cursor)
        each = practice_for / max(1, len(practice))
        for i, beat in enumerate(practice):
            dur = each
            text = beat[lang] + "\n" + (beat["actEs"] if lang == "es" else beat["actEn"])
            cues.append((cursor, cursor + dur - 0.05, text))
            images.append((beat["art"], dur))
            clips.append((BUILD / lang / chapter["id"] / f"p{i:02d}.mp3", dur))
            cursor += dur
    return cues, images, clips


def build_voice(lang: str, clips, dest: Path) -> None:
    seg_dir = BUILD / f"segs-{lang}"
    seg_dir.mkdir(parents=True, exist_ok=True)
    listing = []
    for i, (src, dur) in enumerate(clips):
        seg = seg_dir / f"{i:04d}.wav"
        subprocess.check_call(
            [
                "ffmpeg", "-y", "-i", str(src),
                "-af", f"apad=whole_dur={dur:.3f}",
                "-t", f"{dur:.3f}",
                "-ac", "1", "-ar", "22050",
                str(seg),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        listing.append(f"file '{seg}'")
    list_path = seg_dir / "list.txt"
    list_path.write_text("\n".join(listing) + "\n")
    subprocess.check_call(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_path), "-c:a", "pcm_s16le", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def mix_audio(voice: Path, music: Path, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-i", str(voice), "-i", str(music),
            "-filter_complex", "[0]volume=1.2[v];[1]volume=0.45[m];[v][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]",
            "-map", "[out]", "-t", str(SHOW),
            "-c:a", "libmp3lame", "-q:a", "5",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def render_video(lang: str, audio: Path, srt: Path, concat: Path, dest: Path) -> None:
    # 1280x720 keeps a one-hour file inside a GitHub-friendly size while staying 16:9.
    style = "FontName=DejaVu Sans,FontSize=16,PrimaryColour=&H00FAF3FF,OutlineColour=&H001C212A,BorderStyle=3,BackColour=&H801C212A,Outline=1,Shadow=0,Alignment=2,MarginV=36"
    srt_esc = str(srt).replace("\\", "\\\\").replace(":", "\\:").replace("'", r"\'")
    vf = (
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=8,format=yuv420p,"
        f"subtitles='{srt_esc}':force_style='{style}'"
    )
    subprocess.check_call(
        [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-i", str(audio),
            "-vf", vf,
            "-map", "0:v:0", "-map", "1:a:0",
            "-t", str(SHOW),
            "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "30",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(dest),
        ]
    )


def main() -> None:
    music = BUILD / "music.wav"
    write_music(music)
    names = {
        "es": "una-hora-divertida-casa-de-ninos-montessori",
        "en": "a-fun-hour-montessori-childrens-house",
    }
    for lang in ("es", "en"):
        folder = ROOT / "exports" / lang
        folder.mkdir(parents=True, exist_ok=True)
        cues, images, clips = cues_for(lang)
        srt = folder / "captions.srt"
        concat = BUILD / f"concat-{lang}.txt"
        write_srt(cues, srt)
        write_concat(images, concat)
        voice = BUILD / f"voice-{lang}.wav"
        audio = folder / "audio.mp3"
        print("voice bed", lang, flush=True)
        build_voice(lang, clips, voice)
        print("mixing", lang, flush=True)
        mix_audio(voice, music, audio)
        video = folder / f"{names[lang]}.mp4"
        print("encoding", lang, flush=True)
        render_video(lang, audio, srt, concat, video)
        print("done", video, video.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
