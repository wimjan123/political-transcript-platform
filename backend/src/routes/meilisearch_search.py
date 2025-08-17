"""
Meilisearch-powered search endpoints for advanced search features
"""
import asyncio
import logging
from datetime import date
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def meili_headers() -> Dict[str, str]:
    """Get headers for Meilisearch requests"""
    headers = {"Content-Type": "application/json"}
    if settings.MEILI_MASTER_KEY:
        headers["Authorization"] = f"Bearer {settings.MEILI_MASTER_KEY}"
    return headers


async def meili_request(
    method: str,
    path: str,
    json_body: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> httpx.Response:
    """Make a request to Meilisearch"""
    url = f"{settings.MEILI_HOST.rstrip('/')}{path}"
    timeout = httpx.Timeout(settings.MEILI_TIMEOUT)
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.request(
            method, url,
            headers=meili_headers(),
            json=json_body,
            params=params
        )
        return response


def build_filters(
    speaker: Optional[str] = None,
    topic: Optional[str] = None,
    language: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    source: Optional[str] = None,
    candidate: Optional[str] = None,
    record_type: Optional[str] = None,
    format: Optional[str] = None,
    **kwargs
) -> List[str]:
    """Build Meilisearch filter expressions"""
    filters = []
    
    if speaker:
        filters.append(f"speaker = '{speaker}'")
    
    if topic:
        filters.append(f"topic = '{topic}'")
    
    if language:
        filters.append(f"language = '{language}'")
    
    if source:
        filters.append(f"source = '{source}'")
        
    if candidate:
        filters.append(f"candidate = '{candidate}'")
        
    if record_type:
        filters.append(f"record_type = '{record_type}'")
        
    if format:
        filters.append(f"format = '{format}'")
    
    if date_from:
        filters.append(f"date >= '{date_from.isoformat()}'")
    
    if date_to:
        filters.append(f"date <= '{date_to.isoformat()}'")
    
    return filters


@router.get("/instant")
async def instant_search(
    q: str = Query(..., description="Search query for instant search"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    
    # Filter parameters
    speaker: Optional[str] = Query(None, description="Filter by speaker"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    language: Optional[str] = Query(None, description="Filter by language"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    source: Optional[str] = Query(None, description="Filter by source"),
    candidate: Optional[str] = Query(None, description="Filter by candidate"),
    record_type: Optional[str] = Query(None, description="Filter by record type"),
    format: Optional[str] = Query(None, description="Filter by format")
):
    """
    Instant search with prefix matching for search-as-you-type functionality.
    Optimized for low latency and fast response times.
    """
    try:
        # Build search request
        search_body = {
            "q": q,
            "limit": limit,
            "offset": (page - 1) * limit,
            "attributesToHighlight": ["text"],
            "attributesToCrop": ["text"],
            "cropLength": 30,
            "matchingStrategy": "frequency"  # Fast matching for instant search
        }
        
        # Add filters
        filters = build_filters(
            speaker=speaker, topic=topic, language=language,
            date_from=date_from, date_to=date_to, source=source,
            candidate=candidate, record_type=record_type, format=format
        )
        
        if filters:
            search_body["filter"] = " AND ".join(filters)
        
        # Execute search
        response = await meili_request(
            "POST",
            "/indexes/segments/search",
            json_body=search_body
        )
        
        if response.status_code >= 400:
            logger.error(f"Meilisearch instant search failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Search service error")
        
        search_result = response.json()
        
        # Transform results
        hits = []
        for hit in search_result.get("hits", []):
            transformed_hit = {
                "id": hit.get("id"),
                "text": hit.get("text", ""),
                "speaker": hit.get("speaker", ""),
                "topic": hit.get("topic", []),
                "language": hit.get("language", ""),
                "date": hit.get("date"),
                "video_id": hit.get("video_id"),
                "video_seconds": hit.get("video_seconds"),
                "segment_url": hit.get("segment_url", ""),
                "video_title": hit.get("video_title", ""),
                "sentiment": hit.get("sentiment", {}),
                "highlights": hit.get("_formatted", {}).get("text", hit.get("text", "")),
                "snippet": hit.get("_formatted", {}).get("text", hit.get("text", ""))[:200] + "..." if len(hit.get("text", "")) > 200 else hit.get("text", "")
            }
            hits.append(transformed_hit)
        
        return {
            "hits": hits,
            "total": search_result.get("estimatedTotalHits", 0),
            "page": page,
            "limit": limit,
            "query": q,
            "processing_time_ms": search_result.get("processingTimeMs", 0),
            "search_type": "instant"
        }
        
    except Exception as e:
        logger.error(f"Instant search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Instant search error: {str(e)}")


@router.get("/similar")
async def similar_segments(
    segment_id: str = Query(..., description="ID of the segment to find similar segments for"),
    limit: int = Query(10, ge=1, le=50, description="Number of similar segments to return"),
    
    # Optional filters to apply to similar results
    speaker: Optional[str] = Query(None, description="Filter similar segments by speaker"),
    language: Optional[str] = Query(None, description="Filter similar segments by language"),
    date_from: Optional[date] = Query(None, description="Filter similar segments from date"),
    date_to: Optional[date] = Query(None, description="Filter similar segments to date")
):
    """
    Find similar segments using Meilisearch's semantic similarity.
    Requires that embedders are configured for the segments index.
    """
    try:
        # Build similar search request
        similar_body = {
            "id": segment_id,
            "limit": limit
        }
        
        # Add filters if provided
        filters = build_filters(
            speaker=speaker, language=language,
            date_from=date_from, date_to=date_to
        )
        
        if filters:
            similar_body["filter"] = " AND ".join(filters)
        
        # Execute similar search
        response = await meili_request(
            "POST",
            "/indexes/segments/similar",
            json_body=similar_body
        )
        
        if response.status_code >= 400:
            logger.error(f"Meilisearch similar search failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Similar search service error")
        
        similar_result = response.json()
        
        # Transform results
        similar_segments = []
        for hit in similar_result.get("hits", []):
            transformed_hit = {
                "id": hit.get("id"),
                "text": hit.get("text", ""),
                "speaker": hit.get("speaker", ""),
                "topic": hit.get("topic", []),
                "language": hit.get("language", ""),
                "date": hit.get("date"),
                "video_id": hit.get("video_id"),
                "video_seconds": hit.get("video_seconds"),
                "segment_url": hit.get("segment_url", ""),
                "video_title": hit.get("video_title", ""),
                "sentiment": hit.get("sentiment", {}),
                "similarity_score": hit.get("_semanticScore", 0.0)
            }
            similar_segments.append(transformed_hit)
        
        return {
            "similar_segments": similar_segments,
            "source_segment_id": segment_id,
            "total": len(similar_segments),
            "limit": limit,
            "processing_time_ms": similar_result.get("processingTimeMs", 0),
            "search_type": "similar"
        }
        
    except Exception as e:
        logger.error(f"Similar segments error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Similar segments error: {str(e)}")


@router.get("/hybrid")
async def hybrid_search(
    q: str = Query(..., description="Search query for hybrid search"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    
    # Filter parameters
    speaker: Optional[str] = Query(None, description="Filter by speaker"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    language: Optional[str] = Query(None, description="Filter by language"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    source: Optional[str] = Query(None, description="Filter by source"),
    candidate: Optional[str] = Query(None, description="Filter by candidate"),
    record_type: Optional[str] = Query(None, description="Filter by record type"),
    format: Optional[str] = Query(None, description="Filter by format"),
    
    # Hybrid search specific parameters
    semantic_ratio: float = Query(0.5, ge=0.0, le=1.0, description="Ratio of semantic vs keyword search (0.0 = pure keyword, 1.0 = pure semantic)")
):
    """
    Hybrid search combining keyword (BM25) and semantic (vector) search.
    Provides the best of both worlds for comprehensive search results.
    """
    try:
        # Build hybrid search request
        search_body = {
            "q": q,
            "limit": limit,
            "offset": (page - 1) * limit,
            "attributesToHighlight": ["text"],
            "attributesToCrop": ["text"],
            "cropLength": 50,
            "showRankingScore": True,
            "hybrid": {
                "semanticRatio": semantic_ratio,
                "embedder": "default"
            }
        }
        
        # Add filters
        filters = build_filters(
            speaker=speaker, topic=topic, language=language,
            date_from=date_from, date_to=date_to, source=source,
            candidate=candidate, record_type=record_type, format=format
        )
        
        if filters:
            search_body["filter"] = " AND ".join(filters)
        
        # Execute search
        response = await meili_request(
            "POST",
            "/indexes/segments/search",
            json_body=search_body
        )
        
        if response.status_code >= 400:
            logger.error(f"Meilisearch hybrid search failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Hybrid search service error")
        
        search_result = response.json()
        
        # Transform results
        hits = []
        for hit in search_result.get("hits", []):
            transformed_hit = {
                "id": hit.get("id"),
                "text": hit.get("text", ""),
                "speaker": hit.get("speaker", ""),
                "topic": hit.get("topic", []),
                "language": hit.get("language", ""),
                "date": hit.get("date"),
                "video_id": hit.get("video_id"),
                "video_seconds": hit.get("video_seconds"),
                "segment_url": hit.get("segment_url", ""),
                "video_title": hit.get("video_title", ""),
                "sentiment": hit.get("sentiment", {}),
                "moderation": hit.get("moderation", {}),
                "readability": hit.get("readability", {}),
                "ranking_score": hit.get("_rankingScore", 0.0),
                "highlights": hit.get("_formatted", {}).get("text", hit.get("text", "")),
                "snippet": hit.get("_formatted", {}).get("text", hit.get("text", ""))[:200] + "..." if len(hit.get("text", "")) > 200 else hit.get("text", "")
            }
            hits.append(transformed_hit)
        
        return {
            "hits": hits,
            "total": search_result.get("estimatedTotalHits", 0),
            "page": page,
            "limit": limit,
            "query": q,
            "semantic_ratio": semantic_ratio,
            "processing_time_ms": search_result.get("processingTimeMs", 0),
            "search_type": "hybrid",
            "filters": {
                "speaker": speaker,
                "topic": topic,
                "language": language,
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
                "source": source,
                "candidate": candidate,
                "record_type": record_type,
                "format": format
            }
        }
        
    except Exception as e:
        logger.error(f"Hybrid search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hybrid search error: {str(e)}")


@router.get("/suggestions")
async def search_suggestions(
    q: str = Query(..., description="Partial query for autocomplete suggestions"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of suggestions"),
    kind: Optional[str] = Query(None, description="Filter suggestions by kind (speaker, topic, title)")
):
    """
    Get autocomplete suggestions from the suggestions index.
    """
    try:
        # Build search request for suggestions
        search_body = {
            "q": q,
            "limit": limit,
            "attributesToHighlight": ["term"],
            "sort": ["payload.frequency:desc"]  # Sort by frequency if available
        }
        
        # Filter by kind if specified
        if kind:
            search_body["filter"] = f"kind = '{kind}'"
        
        # Execute search on suggestions index
        response = await meili_request(
            "POST",
            "/indexes/suggestions/search",
            json_body=search_body
        )
        
        if response.status_code >= 400:
            logger.error(f"Meilisearch suggestions search failed: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Suggestions service error")
        
        suggestions_result = response.json()
        
        # Transform results
        suggestions = []
        for hit in suggestions_result.get("hits", []):
            suggestion = {
                "term": hit.get("term", ""),
                "kind": hit.get("kind", ""),
                "frequency": hit.get("payload", {}).get("frequency", 0),
                "highlighted": hit.get("_formatted", {}).get("term", hit.get("term", ""))
            }
            suggestions.append(suggestion)
        
        return {
            "suggestions": suggestions,
            "query": q,
            "total": len(suggestions),
            "processing_time_ms": suggestions_result.get("processingTimeMs", 0)
        }
        
    except Exception as e:
        logger.error(f"Suggestions error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Suggestions error: {str(e)}")


@router.get("/health")
async def meilisearch_health():
    """Check Meilisearch service health"""
    try:
        response = await meili_request("GET", "/health")
        
        if response.status_code == 200:
            return {
                "status": "healthy",
                "meilisearch_version": response.json().get("status", "available")
            }
        else:
            return {
                "status": "unhealthy",
                "error": f"HTTP {response.status_code}"
            }
            
    except Exception as e:
        logger.error(f"Meilisearch health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }