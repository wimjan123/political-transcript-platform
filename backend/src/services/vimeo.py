from typing import Optional

def is_vimeo_identifier(value: str) -> bool:
    return value.isdigit()


def build_vimeo_url(video_id_or_url: str) -> str:
    if video_id_or_url.startswith("http"):
        return video_id_or_url
    return f"https://vimeo.com/{video_id_or_url}"


def resolve_vimeo_stream(video_id_or_url: str) -> Optional[str]:
    """Resolve a direct stream URL for a Vimeo video using yt-dlp.

    Returns a URL suitable for ffmpeg (often an HLS .m3u8). Returns None on failure.
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
            # If requested_formats exist, try to pick bestvideo then get 'url' from formats
            if "requested_formats" in info and info["requested_formats"]:
                # Some extractors provide separate video/audio; ffmpeg can take m3u8 master in 'url'
                # Fall back to base 'url'
                pass
            # Primary direct URL
            stream_url = info.get("url")
            return stream_url
    except Exception:
        return None

