#!/usr/bin/env python3
"""Rebuild the one-hour mix so practice narration is in the film, then swap the audio track."""

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path("/workspace/scripts")))
from render_hour import BUILD, ROOT, SHOW, build_voice, cues_for, write_music

NAMES = {
    "es": "una-hora-divertida-casa-de-ninos-montessori",
    "en": "a-fun-hour-montessori-childrens-house",
}


def mix_quiet(voice: Path, music: Path, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-i", str(voice), "-i", str(music),
            "-filter_complex",
            "[0]volume=1.35[v];[1]volume=0.16[m];[v][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]",
            "-map", "[out]", "-t", str(SHOW),
            "-c:a", "libmp3lame", "-q:a", "4",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def remux(video: Path, audio: Path) -> None:
    tmp = video.with_suffix(".narrated.mp4")
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-i", str(video), "-i", str(audio),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart",
            str(tmp),
        ]
    )
    tmp.replace(video)


def main() -> None:
    music = BUILD / "music.wav"
    write_music(music)
    for lang in ("es", "en"):
        folder = ROOT / "exports" / lang
        _cues, _images, clips = cues_for(lang)
        voice = BUILD / f"voice-{lang}.wav"
        audio = folder / "audio.mp3"
        print("voice bed", lang, flush=True)
        build_voice(lang, clips, voice)
        print("mixing", lang, flush=True)
        mix_quiet(voice, music, audio)
        video = folder / f"{NAMES[lang]}.mp4"
        print("remux", lang, flush=True)
        remux(video, audio)
        print("done", video, video.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
