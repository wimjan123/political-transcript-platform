"""
Unified Search endpoints using the new dual search engine system
"""
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from datetime import date

from ..database import get_db
from ..services.unified_search_service import unified_search_service, SearchEngine
from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model_exclude_none=True)
async def unified_search_transcripts(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Results per page"),
    speaker: Optional[str] = Query(None, description="Filter by speaker name"),
    source: Optional[str] = Query(None, description="Filter by video source"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    date_from: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (positive/negative/neutral)"),
    dataset: Optional[str] = Query(None, description="Dataset filter: all|trump|tweede_kamer"),
    min_readability: Optional[float] = Query(None, description="Minimum readability score"),
    max_readability: Optional[float] = Query(None, description="Maximum readability score"),
    
    # Event metadata filters
    format: Optional[str] = Query(None, description="Filter by event format"),
    candidate: Optional[str] = Query(None, description="Filter by candidate name"),
    place: Optional[str] = Query(None, description="Filter by event place"),
    record_type: Optional[str] = Query(None, description="Filter by record type"),
    
    # Stresslens filters
    min_stresslens: Optional[float] = Query(None, description="Minimum stresslens score"),
    max_stresslens: Optional[float] = Query(None, description="Maximum stresslens score"),
    stresslens_rank: Optional[int] = Query(None, description="Filter by stresslens rank"),
    
    # Moderation flags filters
    has_harassment: Optional[bool] = Query(None, description="Filter by harassment flag"),
    has_hate: Optional[bool] = Query(None, description="Filter by hate flag"),
    has_violence: Optional[bool] = Query(None, description="Filter by violence flag"),
    has_sexual: Optional[bool] = Query(None, description="Filter by sexual flag"),
    has_selfharm: Optional[bool] = Query(None, description="Filter by self-harm flag"),
    
    search_type: str = Query("multi_match", description="Search type: multi_match, match, term"),
    sort_by: str = Query("relevance", description="Sort by: relevance, date, speaker, sentiment"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    
    # Engine selection
    engine: Optional[str] = Query(None, description="Force specific engine: elasticsearch, meilisearch"),
    
    db: AsyncSession = Depends(get_db)
):
    """
    Unified search across transcript segments with automatic engine fallback
    """
    try:
        # Build filters
        filters = {}
        
        if speaker:
            filters["speaker"] = speaker
        if source:
            filters["source"] = source
        if topic:
            filters["topic"] = topic
        if date_from:
            filters["date_from"] = date_from.isoformat()
        if date_to:
            filters["date_to"] = date_to.isoformat()
        if sentiment:
            filters["sentiment"] = sentiment
        if dataset and dataset.lower() != "all":
            filters["dataset"] = dataset
        if format:
            filters["format"] = format
        if candidate:
            filters["candidate"] = candidate
        if place:
            filters["place"] = place
        if record_type:
            filters["record_type"] = record_type
        
        # Readability filters
        if min_readability is not None:
            filters["min_readability"] = min_readability
        if max_readability is not None:
            filters["max_readability"] = max_readability
        
        # Stresslens filters
        if min_stresslens is not None:
            filters["min_stresslens"] = min_stresslens
        if max_stresslens is not None:
            filters["max_stresslens"] = max_stresslens
        if stresslens_rank is not None:
            filters["stresslens_rank"] = stresslens_rank
        
        # Moderation filters
        if has_harassment is not None:
            filters["has_harassment"] = has_harassment
        if has_hate is not None:
            filters["has_hate"] = has_hate
        if has_violence is not None:
            filters["has_violence"] = has_violence
        if has_sexual is not None:
            filters["has_sexual"] = has_sexual
        if has_selfharm is not None:
            filters["has_selfharm"] = has_selfharm
        
        # Build sort configuration
        sort = []
        if sort_by == "relevance":
            sort = ["_score"]
        elif sort_by == "date":
            sort = [{"date": {"order": sort_order}}]
        elif sort_by == "speaker":
            sort = [{"speaker": {"order": sort_order}}]
        elif sort_by == "sentiment":
            sort = [{"sentiment.loughran": {"order": sort_order}}]
        else:
            sort = [{"date": {"order": "desc"}}]
        
        # Calculate pagination
        from_ = (page - 1) * page_size
        
        # Force specific engine if requested
        force_engine = None
        if engine:
            try:
                force_engine = SearchEngine(engine.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid engine '{engine}'. Must be 'elasticsearch' or 'meilisearch'"
                )
        
        # Perform search
        search_result = await unified_search_service.search(
            query=q,
            filters=filters,
            size=page_size,
            from_=from_,
            sort=sort,
            search_type=search_type,
            force_engine=force_engine
        )
        
        # Calculate total pages
        total_pages = (search_result.total + page_size - 1) // page_size
        
        # Build response
        return {
            "results": search_result.hits,
            "total": search_result.total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "query": q,
            "search_engine": search_result.engine.value,
            "took": search_result.took,
            "max_score": search_result.max_score,
            "filters": {
                "speaker": speaker,
                "source": source,
                "topic": topic,
                "date_from": date_from,
                "date_to": date_to,
                "sentiment": sentiment,
                "dataset": dataset,
                "min_readability": min_readability,
                "max_readability": max_readability,
                "format": format,
                "candidate": candidate,
                "place": place,
                "record_type": record_type,
                "min_stresslens": min_stresslens,
                "max_stresslens": max_stresslens,
                "stresslens_rank": stresslens_rank,
                "has_harassment": has_harassment,
                "has_hate": has_hate,
                "has_violence": has_violence,
                "has_sexual": has_sexual,
                "has_selfharm": has_selfharm
            }
        }
    
    except Exception as e:
        logger.exception("Unified search error")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@router.get("/suggest")
async def unified_search_suggestions(
    q: str = Query(..., description="Partial search query"),
    type: str = Query("all", description="Suggestion type: all, text, speaker, topic"),
    limit: int = Query(10, ge=1, le=50, description="Maximum suggestions"),
    engine: Optional[str] = Query(None, description="Force specific engine: elasticsearch, meilisearch"),
):
    """
    Get search suggestions for autocomplete using unified search service
    """
    try:
        # Force specific engine if requested
        if engine:
            try:
                SearchEngine(engine.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid engine '{engine}'. Must be 'elasticsearch' or 'meilisearch'"
                )
        
        # Get suggestions based on type
        field = "text"
        if type == "speaker":
            field = "speaker"
        elif type == "topic":
            field = "topic"
        
        suggestions = await unified_search_service.get_suggestions(q, field, limit)
        
        return {"suggestions": [{"value": suggestion, "type": type} for suggestion in suggestions]}
    
    except Exception as e:
        logger.exception("Suggestions error")
        raise HTTPException(status_code=500, detail=f"Suggestion error: {str(e)}")


@router.get("/status")
async def search_engine_status():
    """
    Get status of all search engines
    """
    try:
        status = await unified_search_service.get_engine_status()
        return status
    
    except Exception as e:
        logger.exception("Status check error")
        raise HTTPException(status_code=500, detail=f"Status error: {str(e)}")


@router.post("/reindex")
async def reindex_all_engines(
    batch_size: int = Query(500, ge=100, le=2000, description="Batch size for reindexing"),
    engine: Optional[str] = Query(None, description="Reindex specific engine: elasticsearch, meilisearch, all"),
):
    """
    Reindex all data to search engines
    """
    try:
        if engine and engine.lower() != "all":
            # Reindex specific engine
            try:
                force_engine = SearchEngine(engine.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid engine '{engine}'. Must be 'elasticsearch', 'meilisearch', or 'all'"
                )
            
            # For now, we'll call the full reindex and filter results
            results = await unified_search_service.reindex_all(batch_size)
            
            if force_engine == SearchEngine.ELASTICSEARCH:
                return {"elasticsearch": results.get("elasticsearch")}
            else:
                return {"meilisearch": results.get("meilisearch")}
        else:
            # Reindex all engines
            results = await unified_search_service.reindex_all(batch_size)
            return results
    
    except Exception as e:
        logger.exception("Reindexing error")
        raise HTTPException(status_code=500, detail=f"Reindexing error: {str(e)}")


@router.get("/compare")
async def compare_search_engines(
    q: str = Query(..., description="Search query to compare"),
    size: int = Query(10, ge=1, le=50, description="Number of results to compare"),
):
    """
    Compare search results from both engines for the same query
    """
    try:
        # Search with Elasticsearch
        es_results = None
        try:
            es_result = await unified_search_service.search(
                query=q,
                size=size,
                force_engine=SearchEngine.ELASTICSEARCH
            )
            es_results = {
                "hits": es_result.hits[:5],  # Limit for comparison
                "total": es_result.total,
                "took": es_result.took,
                "engine": es_result.engine.value
            }
        except Exception as e:
            es_results = {"error": str(e)}
        
        # Search with Meilisearch
        meili_results = None
        try:
            meili_result = await unified_search_service.search(
                query=q,
                size=size,
                force_engine=SearchEngine.MEILISEARCH
            )
            meili_results = {
                "hits": meili_result.hits[:5],  # Limit for comparison
                "total": meili_result.total,
                "took": meili_result.took,
                "engine": meili_result.engine.value
            }
        except Exception as e:
            meili_results = {"error": str(e)}
        
        return {
            "query": q,
            "elasticsearch": es_results,
            "meilisearch": meili_results,
            "comparison_summary": {
                "es_total": es_results.get("total", 0) if isinstance(es_results, dict) and "total" in es_results else 0,
                "meili_total": meili_results.get("total", 0) if isinstance(meili_results, dict) and "total" in meili_results else 0,
                "es_took": es_results.get("took", 0) if isinstance(es_results, dict) and "took" in es_results else 0,
                "meili_took": meili_results.get("took", 0) if isinstance(meili_results, dict) and "took" in meili_results else 0
            }
        }
    
    except Exception as e:
        logger.exception("Comparison error")
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")


@router.post("/switch-primary")
async def switch_primary_engine(
    engine: str = Query(..., description="New primary engine: elasticsearch, meilisearch")
):
    """
    Switch the primary search engine (runtime configuration change)
    """
    try:
        new_engine = SearchEngine(engine.lower())
        
        # Update the service configuration
        unified_search_service.primary_engine = new_engine
        
        # If switching primary, make the other one fallback
        if new_engine == SearchEngine.ELASTICSEARCH:
            unified_search_service.fallback_engine = SearchEngine.MEILISEARCH
        else:
            unified_search_service.fallback_engine = SearchEngine.ELASTICSEARCH
        
        return {
            "message": f"Primary search engine switched to {new_engine.value}",
            "primary_engine": unified_search_service.primary_engine.value,
            "fallback_engine": unified_search_service.fallback_engine.value
        }
    
    except ValueError:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid engine '{engine}'. Must be 'elasticsearch' or 'meilisearch'"
        )
    except Exception as e:
        logger.exception("Engine switch error")
        raise HTTPException(status_code=500, detail=f"Engine switch error: {str(e)}")