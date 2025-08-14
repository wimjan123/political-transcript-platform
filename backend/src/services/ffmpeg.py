import os
import shlex
import subprocess
import uuid
from typing import Optional


class FFmpegError(RuntimeError):
    pass


def which(cmd: str) -> Optional[str]:
    for path in os.environ.get("PATH", "").split(":"):
        full = os.path.join(path, cmd)
        if os.path.isfile(full) and os.access(full, os.X_OK):
            return full
    return None


def clip_video(
    input_url: str,
    start_seconds: float,
    duration_seconds: float,
    output_dir: str = "/tmp",
) -> str:
    """Create a clipped MP4 using ffmpeg and return the output file path.

    Always re-encodes to ensure segment accuracy across sources/containers.
    """
    ffmpeg_bin = which("ffmpeg")
    if not ffmpeg_bin:
        raise FFmpegError("ffmpeg binary not found on PATH")

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"clip_{uuid.uuid4().hex}.mp4")

    # Build ffmpeg command
    # Place -ss after -i for HLS for better accuracy
    is_hls = ".m3u8" in input_url
    common = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-t",
        str(max(0.1, float(duration_seconds))),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        out_path,
    ]

    if is_hls:
        cmd = [ffmpeg_bin, "-hide_banner", "-loglevel", "error", "-i", input_url, "-ss", str(max(0.0, float(start_seconds)))] + common
    else:
        cmd = [ffmpeg_bin, "-hide_banner", "-loglevel", "error", "-ss", str(max(0.0, float(start_seconds))), "-i", input_url] + common

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0 or not os.path.exists(out_path):
        raise FFmpegError(
            f"ffmpeg failed (code {proc.returncode}): {proc.stderr.decode('utf-8', errors='ignore')}"
        )
    return out_path
