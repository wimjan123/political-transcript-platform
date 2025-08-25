"""
Unified Search Service

This module provides a unified interface for searching across multiple search engines
(Elasticsearch and Meilisearch) with automatic fallback capabilities.
"""
import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from ..config import settings

logger = logging.getLogger(__name__)


class SearchEngine(Enum):
    """Supported search engines"""
    ELASTICSEARCH = "elasticsearch"
    MEILISEARCH = "meilisearch"


class SearchResult:
    """Unified search result format"""
    
    def __init__(self, 
                 hits: List[Dict[str, Any]],
                 total: int,
                 took: int,
                 engine: SearchEngine,
                 max_score: Optional[float] = None):
        self.hits = hits
        self.total = total
        self.took = took
        self.engine = engine
        self.max_score = max_score
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            "hits": self.hits,
            "total": self.total,
            "took": self.took,
            "engine": self.engine.value,
            "max_score": self.max_score
        }


class UnifiedSearchService:
    """Unified search service with multiple engine support and fallback"""
    
    def __init__(self):
        self.elasticsearch_service = None
        self.meilisearch_service = None
        self.primary_engine = SearchEngine(settings.PRIMARY_SEARCH_ENGINE)
        self.fallback_engine = SearchEngine(settings.FALLBACK_SEARCH_ENGINE)
        self.timeout = settings.SEARCH_ENGINE_TIMEOUT
        
    async def _get_elasticsearch_service(self):
        """Get Elasticsearch service instance"""
        if not self.elasticsearch_service:
            from .elasticsearch_service import elasticsearch_service
            self.elasticsearch_service = elasticsearch_service
        return self.elasticsearch_service
    
    async def _get_meilisearch_service(self):
        """Get Meilisearch service instance - using existing indexer for now"""
        if not self.meilisearch_service:
            # For now, we'll use the existing Meilisearch functionality
            # This could be refactored to a proper service later
            from ..search import indexer
            self.meilisearch_service = indexer
        return self.meilisearch_service
    
    async def _check_engine_health(self, engine: SearchEngine) -> bool:
        """Check if a search engine is healthy and available"""
        try:
            if engine == SearchEngine.ELASTICSEARCH:
                es_service = await self._get_elasticsearch_service()
                return await es_service.ping()
            elif engine == SearchEngine.MEILISEARCH:
                # For Meilisearch, we'll do a simple health check
                import httpx
                from ..config import settings
                
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{settings.MEILI_HOST}/health")
                    return response.status_code == 200
        except Exception as e:
            logger.warning(f"Health check failed for {engine.value}: {e}")
            return False
    
    async def _search_elasticsearch(self, 
                                  query: str, 
                                  filters: Dict[str, Any] = None, 
                                  size: int = 25, 
                                  from_: int = 0,
                                  sort: List[Dict[str, str]] = None,
                                  search_type: str = "multi_match") -> SearchResult:
        """Search using Elasticsearch"""
        es_service = await self._get_elasticsearch_service()
        
        try:
            start_time = datetime.now()
            
            result = await asyncio.wait_for(
                es_service.search(
                    query=query,
                    filters=filters,
                    size=size,
                    from_=from_,
                    sort=sort,
                    search_type=search_type
                ),
                timeout=self.timeout
            )
            
            end_time = datetime.now()
            took_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Convert Elasticsearch result to unified format
            unified_hits = []
            for hit in result["hits"]:
                # Transform hit to match expected format
                unified_hit = {
                    "id": hit["_source"]["id"],
                    "segment_id": hit["_source"]["id"],  # Using id as segment_id for now
                    "speaker_name": hit["_source"]["speaker"],
                    "transcript_text": hit["_source"]["text"],
                    "video_id": hit["_source"]["video_id"],
                    "video_seconds": hit["_source"]["video_seconds"],
                    "video_title": hit["_source"]["video_title"],
                    "video_url": hit["_source"]["video_url"],
                    "segment_url": hit["_source"]["segment_url"],
                    "source": hit["_source"]["source"],
                    "date": hit["_source"]["date"],
                    "language": hit["_source"]["language"],
                    "candidate": hit["_source"]["candidate"],
                    "record_type": hit["_source"]["record_type"],
                    "format": hit["_source"]["format"],
                    "sentiment_loughran_score": hit["_source"]["sentiment"]["loughran"],
                    "sentiment_vader_score": hit["_source"]["sentiment"]["vader"],
                    "sentiment_harvard_score": hit["_source"]["sentiment"]["harvard"],
                    "score": hit["_score"],
                    "highlight": hit.get("highlight", {}),
                    "topics": hit["_source"]["topic"]
                }
                
                # Add moderation flags
                moderation = hit["_source"]["moderation"]
                unified_hit.update({
                    "moderation_harassment_flag": moderation["harassment"]["flag"],
                    "moderation_hate_flag": moderation["hate"]["flag"],
                    "moderation_violence_flag": moderation["violence"]["flag"],
                    "moderation_sexual_flag": moderation["sexual"]["flag"],
                    "moderation_selfharm_flag": moderation["selfharm"]["flag"]
                })
                
                # Add readability scores
                readability = hit["_source"]["readability"]
                unified_hit.update({
                    "flesch_kincaid_grade": readability.get("flesch_kincaid"),
                    "gunning_fog_index": readability.get("gunning_fog"),
                    "coleman_liau_index": readability.get("coleman_liau"),
                    "flesch_reading_ease": readability.get("flesch_reading_ease"),
                    "smog_index": readability.get("smog"),
                    "automated_readability_index": readability.get("ari")
                })
                
                unified_hits.append(unified_hit)
            
            return SearchResult(
                hits=unified_hits,
                total=result["total"],
                took=took_ms,
                engine=SearchEngine.ELASTICSEARCH,
                max_score=result.get("max_score")
            )
            
        except asyncio.TimeoutError:
            logger.warning(f"Elasticsearch search timed out after {self.timeout}s")
            raise
        except Exception as e:
            logger.error(f"Elasticsearch search error: {e}")
            raise
    
    async def _search_meilisearch(self, 
                                query: str, 
                                filters: Dict[str, Any] = None, 
                                size: int = 25, 
                                from_: int = 0,
                                sort: List[Dict[str, str]] = None,
                                search_type: str = "multi_match") -> SearchResult:
        """Search using Meilisearch"""
        try:
            start_time = datetime.now()
            
            # Build Meilisearch query
            search_params = {
                "q": query,
                "limit": size,
                "offset": from_,
                "attributesToHighlight": ["text", "video_title"],
                "highlightPreTag": "<mark>",
                "highlightPostTag": "</mark>"
            }
            
            # Add filters
            filter_conditions = []
            if filters:
                if filters.get("speaker"):
                    filter_conditions.append(f"speaker = '{filters['speaker']}'")
                if filters.get("source"):
                    filter_conditions.append(f"source = '{filters['source']}'")
                if filters.get("language"):
                    filter_conditions.append(f"language = '{filters['language']}'")
                if filters.get("date_from"):
                    filter_conditions.append(f"date >= '{filters['date_from']}'")
                if filters.get("date_to"):
                    filter_conditions.append(f"date <= '{filters['date_to']}'")
                if filters.get("topic"):
                    filter_conditions.append(f"topic = '{filters['topic']}'")
                
                # Sentiment filters
                sentiment = filters.get("sentiment")
                if sentiment == "positive":
                    filter_conditions.append("sentiment.loughran > 0")
                elif sentiment == "negative":
                    filter_conditions.append("sentiment.loughran < 0")
                elif sentiment == "neutral":
                    filter_conditions.append("sentiment.loughran = 0")
                
                # Moderation flags
                for flag in ["harassment", "hate", "violence", "sexual", "selfharm"]:
                    if filters.get(f"has_{flag}") is True:
                        filter_conditions.append(f"moderation.{flag}.flag = true")
            
            if filter_conditions:
                search_params["filter"] = " AND ".join(filter_conditions)
            
            # Add sorting
            if sort:
                # Convert Elasticsearch sort format to Meilisearch
                sort_attrs = []
                for sort_item in sort:
                    if isinstance(sort_item, dict):
                        for field, order in sort_item.items():
                            if field == "_score":
                                continue  # Relevance is default
                            sort_attrs.append(f"{field}:{order}")
                    elif isinstance(sort_item, str) and sort_item == "_score":
                        continue  # Relevance is default
                
                if sort_attrs:
                    search_params["sort"] = sort_attrs
            
            # Make Meilisearch request
            import httpx
            from ..config import settings
            
            headers = {"Content-Type": "application/json"}
            if settings.MEILI_MASTER_KEY:
                headers["Authorization"] = f"Bearer {settings.MEILI_MASTER_KEY}"
            
            timeout = httpx.Timeout(self.timeout)
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{settings.MEILI_HOST}/indexes/segments/search",
                    json=search_params,
                    headers=headers
                )
                
                if response.status_code != 200:
                    raise Exception(f"Meilisearch error: {response.status_code} - {response.text}")
                
                result = response.json()
            
            end_time = datetime.now()
            took_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Convert Meilisearch result to unified format
            unified_hits = []
            for hit in result["hits"]:
                # Meilisearch results should already be in a compatible format
                # but we might need some minor transformations
                unified_hit = {
                    "id": hit["id"],
                    "segment_id": hit.get("segment_id", hit["id"]),
                    "speaker_name": hit.get("speaker", ""),
                    "transcript_text": hit.get("text", ""),
                    "video_id": hit.get("videoId", hit.get("video_id")),
                    "video_seconds": hit.get("video_seconds"),
                    "video_title": hit.get("video_title", ""),
                    "video_url": hit.get("video_url", ""),
                    "segment_url": hit.get("segment_url", ""),
                    "source": hit.get("source", ""),
                    "date": hit.get("date"),
                    "language": hit.get("language", "en"),
                    "candidate": hit.get("candidate", ""),
                    "record_type": hit.get("record_type", ""),
                    "format": hit.get("format", ""),
                    "topics": hit.get("topic", []),
                    "highlight": hit.get("_formatted", {}),
                    "score": 1.0  # Meilisearch doesn't provide scores in the same way
                }
                
                # Add sentiment scores
                sentiment = hit.get("sentiment", {})
                unified_hit.update({
                    "sentiment_loughran_score": sentiment.get("loughran"),
                    "sentiment_vader_score": sentiment.get("vader"),
                    "sentiment_harvard_score": sentiment.get("harvard")
                })
                
                # Add moderation flags
                moderation = hit.get("moderation", {})
                unified_hit.update({
                    "moderation_harassment_flag": moderation.get("harassment", {}).get("flag", False),
                    "moderation_hate_flag": moderation.get("hate", {}).get("flag", False),
                    "moderation_violence_flag": moderation.get("violence", {}).get("flag", False),
                    "moderation_sexual_flag": moderation.get("sexual", {}).get("flag", False),
                    "moderation_selfharm_flag": moderation.get("selfharm", {}).get("flag", False)
                })
                
                # Add readability scores
                readability = hit.get("readability", {})
                unified_hit.update({
                    "flesch_kincaid_grade": readability.get("flesch_kincaid"),
                    "gunning_fog_index": readability.get("gunning_fog"),
                    "coleman_liau_index": readability.get("coleman_liau"),
                    "flesch_reading_ease": readability.get("flesch_reading_ease"),
                    "smog_index": readability.get("smog"),
                    "automated_readability_index": readability.get("ari")
                })
                
                unified_hits.append(unified_hit)
            
            return SearchResult(
                hits=unified_hits,
                total=result.get("estimatedTotalHits", len(unified_hits)),
                took=took_ms,
                engine=SearchEngine.MEILISEARCH,
                max_score=None  # Meilisearch doesn't provide max_score
            )
            
        except asyncio.TimeoutError:
            logger.warning(f"Meilisearch search timed out after {self.timeout}s")
            raise
        except Exception as e:
            logger.error(f"Meilisearch search error: {e}")
            raise
    
    async def search(self, 
                    query: str, 
                    filters: Dict[str, Any] = None, 
                    size: int = 25, 
                    from_: int = 0,
                    sort: List[Dict[str, str]] = None,
                    search_type: str = "multi_match",
                    force_engine: Optional[SearchEngine] = None) -> SearchResult:
        """
        Unified search with automatic fallback
        
        Args:
            query: Search query string
            filters: Dictionary of filters to apply
            size: Number of results to return
            from_: Offset for pagination
            sort: Sort configuration
            search_type: Type of search (multi_match, match, term, etc.)
            force_engine: Force use of specific engine (bypasses fallback)
            
        Returns:
            SearchResult object with unified format
        """
        filters = filters or {}
        
        # If engine is forced, use it without fallback
        if force_engine:
            try:
                if force_engine == SearchEngine.ELASTICSEARCH:
                    return await self._search_elasticsearch(query, filters, size, from_, sort, search_type)
                else:
                    return await self._search_meilisearch(query, filters, size, from_, sort, search_type)
            except Exception as e:
                logger.error(f"Forced {force_engine.value} search failed: {e}")
                raise
        
        # Try primary engine first
        try:
            # Check if primary engine is healthy
            if await self._check_engine_health(self.primary_engine):
                if self.primary_engine == SearchEngine.ELASTICSEARCH:
                    return await self._search_elasticsearch(query, filters, size, from_, sort, search_type)
                else:
                    return await self._search_meilisearch(query, filters, size, from_, sort, search_type)
            else:
                logger.warning(f"Primary engine {self.primary_engine.value} is unhealthy, trying fallback")
        except Exception as e:
            logger.error(f"Primary engine {self.primary_engine.value} failed: {e}, trying fallback")
        
        # Try fallback engine
        try:
            if await self._check_engine_health(self.fallback_engine):
                logger.info(f"Using fallback engine: {self.fallback_engine.value}")
                
                if self.fallback_engine == SearchEngine.ELASTICSEARCH:
                    return await self._search_elasticsearch(query, filters, size, from_, sort, search_type)
                else:
                    return await self._search_meilisearch(query, filters, size, from_, sort, search_type)
            else:
                raise Exception(f"Fallback engine {self.fallback_engine.value} is also unhealthy")
        
        except Exception as e:
            logger.error(f"Fallback engine {self.fallback_engine.value} also failed: {e}")
            raise Exception("Both primary and fallback search engines are unavailable")
    
    async def get_suggestions(self, query: str, field: str = "text", size: int = 10) -> List[str]:
        """Get search suggestions with fallback"""
        try:
            # Try primary engine first
            if self.primary_engine == SearchEngine.ELASTICSEARCH:
                es_service = await self._get_elasticsearch_service()
                if await self._check_engine_health(self.primary_engine):
                    return await es_service.get_suggestions(query, field, size)
            
            # Fallback to simpler suggestions for Meilisearch
            # This is a placeholder - Meilisearch suggestions would need proper implementation
            return []
            
        except Exception as e:
            logger.error(f"Error getting suggestions: {e}")
            return []
    
    async def reindex_all(self, batch_size: int = 500) -> Dict[str, Any]:
        """Reindex all data to both search engines"""
        results = {}
        
        # Reindex to Elasticsearch
        try:
            if await self._check_engine_health(SearchEngine.ELASTICSEARCH):
                es_service = await self._get_elasticsearch_service()
                results["elasticsearch"] = await es_service.reindex_all_segments(batch_size)
            else:
                results["elasticsearch"] = {"error": "Elasticsearch is not healthy"}
        except Exception as e:
            logger.error(f"Elasticsearch reindexing failed: {e}")
            results["elasticsearch"] = {"error": str(e)}
        
        # Reindex to Meilisearch (using existing functionality)
        try:
            if await self._check_engine_health(SearchEngine.MEILISEARCH):
                from ..search.indexer import reindex_segments
                await reindex_segments(batch_size)
                results["meilisearch"] = {"status": "completed"}
            else:
                results["meilisearch"] = {"error": "Meilisearch is not healthy"}
        except Exception as e:
            logger.error(f"Meilisearch reindexing failed: {e}")
            results["meilisearch"] = {"error": str(e)}
        
        return results
    
    async def get_engine_status(self) -> Dict[str, Any]:
        """Get status of all search engines"""
        status = {
            "primary_engine": self.primary_engine.value,
            "fallback_engine": self.fallback_engine.value,
            "engines": {}
        }
        
        # Check Elasticsearch
        try:
            es_healthy = await self._check_engine_health(SearchEngine.ELASTICSEARCH)
            status["engines"]["elasticsearch"] = {
                "healthy": es_healthy,
                "url": settings.ELASTICSEARCH_URL
            }
            
            if es_healthy:
                es_service = await self._get_elasticsearch_service()
                client = await es_service.get_client()
                cluster_info = await client.cluster.health()
                status["engines"]["elasticsearch"]["cluster_status"] = cluster_info["status"]
                status["engines"]["elasticsearch"]["nodes"] = cluster_info["number_of_nodes"]
        except Exception as e:
            status["engines"]["elasticsearch"] = {
                "healthy": False,
                "error": str(e)
            }
        
        # Check Meilisearch
        try:
            meili_healthy = await self._check_engine_health(SearchEngine.MEILISEARCH)
            status["engines"]["meilisearch"] = {
                "healthy": meili_healthy,
                "url": settings.MEILI_HOST
            }
        except Exception as e:
            status["engines"]["meilisearch"] = {
                "healthy": False,
                "error": str(e)
            }
        
        return status


# Global service instance
unified_search_service = UnifiedSearchService()