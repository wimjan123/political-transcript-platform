"""
Meilisearch-backed search endpoint for lexical, hybrid, and semantic modes
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..schemas import SearchFilters, SearchResponse, TranscriptSegmentResponse, VideoResponse


router = APIRouter()


def _format_place_from_hit(hit: Dict[str, Any]) -> Optional[str]:
    """Format place from Meilisearch hit, handling both dict and string formats."""
    place = hit.get("place")
    if not place:
        return None
    if isinstance(place, dict):
        # Handle dict format from Meilisearch: {"city": "...", "state": "...", "country": "..."}
        parts = []
        if place.get("city"):
            parts.append(place["city"])
        if place.get("state"):
            parts.append(place["state"])
        if place.get("country"):
            parts.append(place["country"])
        return ", ".join(parts) if parts else None
    else:
        # Handle string format
        return str(place)


def _build_meili_filter(params: Dict[str, Any]) -> Optional[str]:
    """Map query params to a Meilisearch filter string.

    Supports: date, format, source, candidate, place, record_type,
    moderation flags and thresholds, stresslens, document metrics.
    """
    filters: List[str] = []

    # Date range
    if params.get("date_from"):
        filters.append(f"date >= {json.dumps(params['date_from'])}")
    if params.get("date_to"):
        filters.append(f"date <= {json.dumps(params['date_to'])}")

    # Simple equality/in filters
    for key in [
        "format",
        "source",
        "candidate",
        "record_type",
    ]:
        val = params.get(key)
        if val:
            filters.append(f"{key} = {json.dumps(val)}")

    # Place: map to nested fields if provided as CSV "city, state, country"
    place = params.get("place")
    if place:
        parts = [p.strip() for p in str(place).split(",")]
        if len(parts) > 0 and parts[0]:
            filters.append(f"place.city = {json.dumps(parts[0])}")
        if len(parts) > 1 and parts[1]:
            filters.append(f"place.state = {json.dumps(parts[1])}")
        if len(parts) > 2 and parts[2]:
            filters.append(f"place.country = {json.dumps(parts[2])}")

    # Topics filters
    if params.get("topic"):
        filters.append(f"topics.topic = {json.dumps(params['topic'])}")
    if params.get("min_topic_score"):
        filters.append(f"topics.score >= {float(params['min_topic_score'])}")

    # Moderation flags and min scores
    cat_map = [
        ("harassment", "has_harassment", "min_harassment_score"),
        ("hate", "has_hate", "min_hate_score"),
        ("violence", "has_violence", "min_violence_score"),
        ("sexual", "has_sexual", "min_sexual_score"),
        ("selfharm", "has_selfharm", "min_selfharm_score"),
    ]
    for cat, flag_key, min_key in cat_map:
        if params.get(flag_key) is True:
            filters.append(f"moderation.{cat}.flag = true")
        if params.get(min_key) is not None:
            try:
                filters.append(
                    f"moderation.{cat}.score >= {float(params[min_key])}"
                )
            except Exception:
                pass

    # Stresslens
    if params.get("min_stresslens") is not None:
        filters.append(f"stresslens.score >= {float(params['min_stresslens'])}")
    if params.get("max_stresslens") is not None:
        filters.append(f"stresslens.score <= {float(params['max_stresslens'])}")
    if params.get("stresslens_rank") is not None:
        filters.append(f"stresslens.rank = {int(params['stresslens_rank'])}")

    # Document metrics
    doc_map = [
        ("document.speaking_time_s", "min_speaking_time_s", ">="),
        ("document.sentence_count", "min_sentence_count", ">="),
        ("document.word_count", "min_word_count", ">="),
        ("document.duration_s", "min_duration_s", ">="),
        ("document.speaking_time_s", "max_speaking_time_s", "<="),
        ("document.sentence_count", "max_sentence_count", "<="),
        ("document.word_count", "max_word_count", "<="),
        ("document.duration_s", "max_duration_s", "<="),
    ]
    for field, key, op in doc_map:
        if params.get(key) is not None:
            try:
                filters.append(f"{field} {op} {float(params[key])}")
            except Exception:
                pass

    # Document sentiment thresholds
    for sent in ["lmd", "harvard", "vader"]:
        min_key = f"min_sentiment_{sent}"
        max_key = f"max_sentiment_{sent}"
        if params.get(min_key) is not None:
            filters.append(
                f"document.sentiment.{sent} >= {float(params[min_key])}"
            )
        if params.get(max_key) is not None:
            filters.append(
                f"document.sentiment.{sent} <= {float(params[max_key])}"
            )

    if not filters:
        return None
    return " AND ".join(filters)


async def _meili_search(
    index: str,
    q: str,
    page: int,
    page_size: int,
    mode: str,
    filter_str: Optional[str],
    locales: Optional[List[str]] = None,
) -> Dict[str, Any]:
    url = f"{settings.MEILI_HOST.rstrip('/')}/indexes/{index}/search"
    offset = (page - 1) * page_size

    payload: Dict[str, Any] = {
        "q": q,
        "offset": offset,
        "limit": page_size,
    }
    if filter_str:
        payload["filter"] = filter_str
    if locales and len(locales) > 0:
        payload["locales"] = locales

    if mode == "semantic":
        payload["hybrid"] = {"semanticRatio": 1}
    elif mode == "hybrid":
        payload["hybrid"] = {"semanticRatio": 0.6}

    headers = {"Authorization": f"Bearer {settings.MEILI_MASTER_KEY}"} if settings.MEILI_MASTER_KEY else {}

    timeout = httpx.Timeout(settings.MEILI_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Meilisearch error: {r.text}")
        return r.json()


def _map_hit_to_segment(hit: Dict[str, Any]) -> TranscriptSegmentResponse:
    """Map a Meili hit (segment or event) to TranscriptSegmentResponse."""
    # If it's an event document, synthesize a segment-like shape
    is_event = hit.get("doc_type") == "event" or ("text" not in hit and "transcript_text" not in hit)

    # Common video/event fields
    video_resp = VideoResponse(
        id=int(hit.get("video_id") or hit.get("id") or 0),
        title=hit.get("record_title") or hit.get("title") or "",
        filename=hit.get("filename") or "",
        date=hit.get("date"),
        duration=hit.get("document", {}).get("duration_s") or hit.get("duration"),
        source=hit.get("source"),
        channel=hit.get("channel"),
        description=hit.get("description"),
        url=hit.get("url"),
        video_thumbnail_url=hit.get("video_thumbnail_url"),
        video_url=hit.get("video_url"),
        vimeo_video_id=hit.get("vimeo_video_id"),
        vimeo_embed_url=hit.get("vimeo_embed_url"),
        format=hit.get("format"),
        candidate=hit.get("candidate"),
        place=_format_place_from_hit(hit),
        record_type=hit.get("record_type"),
        total_words=hit.get("document", {}).get("word_count"),
        total_characters=None,
        total_segments=None,
        created_at=hit.get("created_at") or hit.get("date") or None,  # fallback
    )

    text = hit.get("text") or hit.get("transcript_text") or (hit.get("summary") if is_event else "") or ""

    # Derive timestamps
    start_seconds = hit.get("start_seconds")
    if start_seconds is None:
        # Fallback: use video_seconds if present
        start_seconds = hit.get("video_seconds")
    end_seconds = hit.get("end_seconds")
    if end_seconds is None and start_seconds is not None and hit.get("duration_s"):
        end_seconds = start_seconds + int(hit["duration_s"])  # type: ignore

    # Moderation aggregate if present
    mod = hit.get("moderation", {}) or {}
    overall = None
    try:
        overall = max(
            float(mod.get("harassment", {}).get("score") or 0),
            float(mod.get("hate", {}).get("score") or 0),
            float(mod.get("violence", {}).get("score") or 0),
            float(mod.get("sexual", {}).get("score") or 0),
            float(mod.get("selfharm", {}).get("score") or 0),
        )
    except Exception:
        overall = None

    return TranscriptSegmentResponse(
        id=int(hit.get("id") or hit.get("segment_id") or hit.get("video_id") or 0),
        segment_id=str(hit.get("segment_id") or hit.get("id") or "meili"),
        speaker_name=hit.get("speaker") or hit.get("speaker_name") or hit.get("candidate") or "",
        transcript_text=text,
        video_seconds=start_seconds,
        timestamp_start=hit.get("timestamp_start"),
        timestamp_end=hit.get("timestamp_end"),
        duration_seconds=hit.get("duration_s") or hit.get("duration_seconds"),
        word_count=int(hit.get("word_count") or hit.get("document", {}).get("word_count") or 0),
        char_count=int(hit.get("char_count") or 0),
        sentiment_loughran_score=(hit.get("document", {}).get("sentiment", {}) or {}).get("lmd"),
        sentiment_loughran_label=None,
        sentiment_harvard_score=(hit.get("document", {}).get("sentiment", {}) or {}).get("harvard"),
        sentiment_harvard_label=None,
        sentiment_vader_score=(hit.get("document", {}).get("sentiment", {}) or {}).get("vader"),
        sentiment_vader_label=None,
        moderation_harassment=mod.get("harassment", {}).get("score"),
        moderation_hate=mod.get("hate", {}).get("score"),
        moderation_self_harm=mod.get("selfharm", {}).get("score"),
        moderation_sexual=mod.get("sexual", {}).get("score"),
        moderation_violence=mod.get("violence", {}).get("score"),
        moderation_overall_score=overall,
        flesch_kincaid_grade=None,
        gunning_fog_index=None,
        coleman_liau_index=None,
        automated_readability_index=None,
        smog_index=None,
        flesch_reading_ease=None,
        stresslens_score=(hit.get("stresslens", {}) or {}).get("score"),
        stresslens_rank=(hit.get("stresslens", {}) or {}).get("rank"),
        moderation_harassment_flag=(mod.get("harassment", {}) or {}).get("flag"),
        moderation_hate_flag=(mod.get("hate", {}) or {}).get("flag"),
        moderation_violence_flag=(mod.get("violence", {}) or {}).get("flag"),
        moderation_sexual_flag=(mod.get("sexual", {}) or {}).get("flag"),
        moderation_selfharm_flag=(mod.get("selfharm", {}) or {}).get("flag"),
        created_at=video_resp.created_at,
        video=video_resp,
        speaker=None,
        segment_topics=[],
    )


@router.get("/meili", response_model=SearchResponse)
async def meili_search(
    q: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    mode: str = Query("lexical", pattern="^(lexical|semantic|hybrid)$"),
    index: str = Query("segments", pattern="^(segments|events)$"),
    locales: Optional[str] = Query(None, description="Comma-separated list of ISO-639 locale codes (e.g., 'eng,spa')"),
    # Common filters (keep names aligned with existing UI when possible)
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    format: Optional[str] = None,
    source: Optional[str] = None,
    candidate: Optional[str] = None,
    place: Optional[str] = None,
    record_type: Optional[str] = None,
    topic: Optional[str] = None,
    min_topic_score: Optional[float] = None,
    # Moderation
    has_harassment: Optional[bool] = None,
    has_hate: Optional[bool] = None,
    has_violence: Optional[bool] = None,
    has_sexual: Optional[bool] = None,
    has_selfharm: Optional[bool] = None,
    min_harassment_score: Optional[float] = None,
    min_hate_score: Optional[float] = None,
    min_violence_score: Optional[float] = None,
    min_sexual_score: Optional[float] = None,
    min_selfharm_score: Optional[float] = None,
    # Stresslens
    min_stresslens: Optional[float] = None,
    max_stresslens: Optional[float] = None,
    stresslens_rank: Optional[int] = None,
    # Document metrics
    min_speaking_time_s: Optional[float] = None,
    max_speaking_time_s: Optional[float] = None,
    min_sentence_count: Optional[float] = None,
    max_sentence_count: Optional[float] = None,
    min_word_count: Optional[float] = None,
    max_word_count: Optional[float] = None,
    min_duration_s: Optional[float] = None,
    max_duration_s: Optional[float] = None,
    min_sentiment_lmd: Optional[float] = None,
    max_sentiment_lmd: Optional[float] = None,
    min_sentiment_harvard: Optional[float] = None,
    max_sentiment_harvard: Optional[float] = None,
    min_sentiment_vader: Optional[float] = None,
    max_sentiment_vader: Optional[float] = None,
):
    try:
        params = {k: v for k, v in locals().items() if k not in {"q", "page", "page_size", "mode", "index", "locales"}}
        filter_str = _build_meili_filter(params)
        
        # Parse locales parameter if provided
        parsed_locales = None
        if locales:
            parsed_locales = [locale.strip() for locale in locales.split(",") if locale.strip()]

        meili = await _meili_search(
            index=index, 
            q=q, 
            page=page, 
            page_size=page_size, 
            mode=mode, 
            filter_str=filter_str,
            locales=parsed_locales
        )

        hits = meili.get("hits", [])
        total = int(meili.get("estimatedTotalHits") or meili.get("totalHits") or 0)

        results = [_map_hit_to_segment(h) for h in hits]

        return SearchResponse(
            results=results,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size if page_size else 0,
            query=q,
            filters=SearchFilters(
                date_from=date_from, date_to=date_to,
                format=format, source=source, candidate=candidate, place=place, record_type=record_type,
                min_stresslens=min_stresslens, max_stresslens=max_stresslens, stresslens_rank=stresslens_rank,
                has_harassment=has_harassment, has_hate=has_hate, has_violence=has_violence, has_sexual=has_sexual, has_selfharm=has_selfharm,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Meilisearch query failed: {str(e)}")


@router.get("/similar_segments/{segment_id}", response_model=SearchResponse)
async def find_similar_segments(
    segment_id: int,
    limit: int = Query(10, ge=1, le=50),
    index: str = Query("segments", pattern="^(segments|events)$"),
):
    """Find segments similar to the given segment using Meilisearch's similar documents feature."""
    try:
        # First, get the document from Meilisearch to use as reference
        doc_url = f"{settings.MEILI_HOST.rstrip('/')}/indexes/{index}/documents/{segment_id}"
        headers = {"Authorization": f"Bearer {settings.MEILI_MASTER_KEY}"} if settings.MEILI_MASTER_KEY else {}
        
        timeout = httpx.Timeout(settings.MEILI_TIMEOUT)
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Get the source document
            doc_response = await client.get(doc_url, headers=headers)
            if doc_response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found in Meilisearch")
            elif doc_response.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Meilisearch error getting document: {doc_response.text}")
            
            source_doc = doc_response.json()
            
            # Use Meilisearch's similar documents endpoint
            similar_url = f"{settings.MEILI_HOST.rstrip('/')}/indexes/{index}/similar"
            payload = {
                "id": str(segment_id),
                "limit": limit,
                "retrieveVectors": False,
                "showRankingScore": True,
            }
            
            similar_response = await client.post(similar_url, headers=headers, json=payload)
            if similar_response.status_code >= 400:
                # Fallback to semantic search using the document's text
                text_content = source_doc.get("text") or source_doc.get("transcript_text") or ""
                if not text_content:
                    raise HTTPException(status_code=400, detail="Source document has no text content for similarity search")
                
                # Use hybrid search as fallback
                search_url = f"{settings.MEILI_HOST.rstrip('/')}/indexes/{index}/search"
                fallback_payload = {
                    "q": text_content[:500],  # Limit query length
                    "limit": limit + 1,  # +1 to exclude the original
                    "hybrid": {"semanticRatio": 0.8},
                    "showRankingScore": True,
                }
                
                search_response = await client.post(search_url, headers=headers, json=fallback_payload)
                if search_response.status_code >= 400:
                    raise HTTPException(status_code=502, detail=f"Meilisearch similar search failed: {search_response.text}")
                
                search_results = search_response.json()
                # Filter out the original document
                hits = [h for h in search_results.get("hits", []) if str(h.get("id")) != str(segment_id)][:limit]
            else:
                similar_results = similar_response.json()
                hits = similar_results.get("hits", [])
        
        # Convert hits to TranscriptSegmentResponse format
        results = [_map_hit_to_segment(hit) for hit in hits]
        
        return SearchResponse(
            results=results,
            total=len(results),
            page=1,
            page_size=limit,
            total_pages=1,
            query=f"Similar to segment {segment_id}",
            filters=SearchFilters(),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Similar segments search failed: {str(e)}")

