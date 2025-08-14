from typing import Optional, Tuple, Dict

def is_vimeo_identifier(value: str) -> bool:
    return value.isdigit()


def build_vimeo_url(video_id_or_url: str) -> str:
    if video_id_or_url.startswith("http"):
        return video_id_or_url
    return f"https://vimeo.com/{video_id_or_url}"


def resolve_vimeo_stream(video_id_or_url: str) -> Optional[Tuple[str, Dict[str, str]]]:
    """Resolve a direct stream URL for a Vimeo video using yt-dlp.

    Returns a tuple of (stream_url, http_headers) suitable for ffmpeg (often an HLS .m3u8).
    Returns None on failure.
    """
    try:
        from yt_dlp import YoutubeDL
    except Exception:
        return None

    url = build_vimeo_url(video_id_or_url)
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "format": "bv*+ba/best",
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            # If adaptive formats are present, prefer the final merged URL when available
            if info is None:
                return None
            headers = info.get("http_headers") or {}
            # Try direct url first
            stream_url = info.get("url")
            if stream_url:
                return stream_url, headers
            # Fall back to formats list: prefer HLS/DASH master or highest bitrate mp4
            fmts = info.get("formats") or []
            hls = [f for f in fmts if (f.get("protocol") or "").lower().find("m3u8") >= 0 or (f.get("ext") == "m3u8")]
            if hls:
                # choose the highest tbr if available
                best = sorted(hls, key=lambda f: f.get("tbr") or 0, reverse=True)[0]
                u = best.get("url")
                if u:
                    return u, headers
            mp4s = [f for f in fmts if (f.get("ext") == "mp4") and f.get("url")]
            if mp4s:
                best = sorted(mp4s, key=lambda f: f.get("tbr") or 0, reverse=True)[0]
                return best.get("url"), headers
            return None
    except Exception:
        return None
