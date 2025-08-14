from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import tempfile
import zipfile
from starlette.background import BackgroundTask

from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Video
from ..services.ffmpeg import clip_video, FFmpegError
from ..services.vimeo import resolve_vimeo_stream


router = APIRouter()


class ClipRequest(BaseModel):
    start_seconds: float = Field(..., ge=0)
    duration_seconds: Optional[float] = Field(None, gt=0)
    end_seconds: Optional[float] = Field(None, gt=0)
    source_url: Optional[str] = None


class ClipItem(BaseModel):
    start_seconds: float = Field(..., ge=0)
    duration_seconds: float = Field(..., gt=0)
    label: Optional[str] = None


class ClipsZipRequest(BaseModel):
    items: List[ClipItem]
    source_url: Optional[str] = None


def _looks_like_vimeo(url: str) -> bool:
    return "vimeo.com" in url


async def _resolve_source_url(video: Video, override: Optional[str]) -> tuple[str, dict]:
    if override:
        # If an explicit Vimeo URL is provided, resolve it
        if _looks_like_vimeo(override):
            stream = resolve_vimeo_stream(override)
            if stream:
                return stream
        return override, {}
    # Prefer a direct video_url if present
    if video.video_url and video.video_url.startswith(("http://", "https://", "/")):
        # If it's a Vimeo page/embed URL, resolve a stream instead of returning page URL
        if _looks_like_vimeo(video.video_url):
            stream = resolve_vimeo_stream(video.video_url)
            if stream:
                return stream
        return video.video_url, {}
    # Try well-known local locations by filename
    for base in ("/data/uploads", "/data/processed", "/data"):
        candidate = os.path.join(base, video.filename)
        if os.path.exists(candidate):
            return candidate, {}
    # Attempt Vimeo stream resolution if available
    if video.vimeo_video_id:
        stream = resolve_vimeo_stream(video.vimeo_video_id)
        if stream:
            return stream
    if video.vimeo_embed_url:
        stream = resolve_vimeo_stream(video.vimeo_embed_url)
        if stream:
            return stream

    raise HTTPException(status_code=400, detail="Unable to resolve a downloadable video source (file or Vimeo stream) for this video.")


@router.post("/{video_id}/clip")
async def create_clip(video_id: int, req: ClipRequest, db: AsyncSession = Depends(get_db)):
    # Load video
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Determine duration
    if req.duration_seconds is not None:
        duration = req.duration_seconds
    elif req.end_seconds is not None:
        duration = float(req.end_seconds) - float(req.start_seconds)
    else:
        raise HTTPException(status_code=422, detail="Either duration_seconds or end_seconds is required")
    if duration <= 0:
        raise HTTPException(status_code=422, detail="Duration must be positive")

    # Resolve source URL or path
    source_url, headers = await _resolve_source_url(video, req.source_url)

    # Generate clip
    try:
        out_path = clip_video(source_url, req.start_seconds, duration, http_headers=headers)
    except FFmpegError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Serve file and cleanup
    filename = f"video_{video_id}_{int(req.start_seconds)}_{int(req.start_seconds + duration)}.mp4"
    return FileResponse(
        out_path,
        media_type="video/mp4",
        filename=filename,
        background=BackgroundTask(lambda: os.remove(out_path) if os.path.exists(out_path) else None),
    )


@router.post("/{video_id}/clips.zip")
async def create_clips_zip(video_id: int, req: ClipsZipRequest, db: AsyncSession = Depends(get_db)):
    if not req.items:
        raise HTTPException(status_code=422, detail="No items provided")

    # Load video
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    source_url, headers = await _resolve_source_url(video, req.source_url)

    tmp_dir = tempfile.mkdtemp(prefix="clips_")
    clip_paths: List[str] = []
    try:
        for idx, item in enumerate(req.items, start=1):
            try:
                clip_path = clip_video(source_url, item.start_seconds, item.duration_seconds, output_dir=tmp_dir, http_headers=headers)
                clip_paths.append(clip_path)
            except FFmpegError as e:
                # Skip failed items but continue others
                continue

        if not clip_paths:
            raise HTTPException(status_code=500, detail="Failed to generate any clips")

        zip_path = os.path.join(tmp_dir, f"video_{video_id}_clips.zip")
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for i, clip_path in enumerate(clip_paths, start=1):
                label = req.items[i - 1].label or f"clip_{i}"
                safe_label = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in label)[:80]
                arcname = f"{safe_label or f'clip_{i}'}.mp4"
                zf.write(clip_path, arcname=arcname)

        # Serve zip with cleanup
        def _cleanup():
            try:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                for p in clip_paths:
                    if os.path.exists(p):
                        os.remove(p)
                if os.path.isdir(tmp_dir):
                    os.rmdir(tmp_dir)
            except Exception:
                pass

        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"video_{video_id}_clips.zip",
            background=BackgroundTask(_cleanup),
        )
    except Exception:
        # Cleanup on error
        for p in clip_paths:
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
        try:
            if os.path.isdir(tmp_dir):
                os.rmdir(tmp_dir)
        except Exception:
            pass
        raise
