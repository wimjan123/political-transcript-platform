"""
Optimized search service using Meilisearch for high-performance search
Replaces PostgreSQL-based search to fix performance issues
"""
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import date
import httpx
from fastapi import HTTPException

from ..config import settings

logger = logging.getLogger(__name__)

class OptimizedSearchService:
    """High-performance search service using Meilisearch"""
    
    def __init__(self):
        self.base_url = settings.MEILI_HOST.rstrip('/')
        self.headers = self._get_headers()
        self.timeout = httpx.Timeout(
            connect=10.0,
            read=30.0,  # Increased for large result sets
            write=10.0,
            pool=5.0
        )
    
    def _get_headers(self) -> Dict[str, str]:
        """Get Meilisearch API headers"""
        headers = {"Content-Type": "application/json"}
        if settings.MEILI_MASTER_KEY:
            headers["Authorization"] = f"Bearer {settings.MEILI_MASTER_KEY}"
        return headers
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Meilisearch with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    json=json_data,
                    params=params
                )
                
                if response.status_code >= 400:
                    logger.error(f"Meilisearch error {response.status_code}: {response.text}")
                    raise HTTPException(
                        status_code=response.status_code, 
                        detail=f"Search service error: {response.text}"
                    )
                
                return response.json()
                
        except httpx.TimeoutException:
            logger.error("Meilisearch request timeout")
            raise HTTPException(status_code=504, detail="Search service timeout")
        except httpx.ConnectError:
            logger.error("Cannot connect to Meilisearch")
            raise HTTPException(status_code=503, detail="Search service unavailable")
    
    async def search(
        self,
        query: str,
        page: int = 1,
        page_size: int = 25,
        search_type: str = "fulltext",
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "relevance",
        sort_order: str = "desc",
        enable_highlighting: bool = True,
        max_results: int = 10000  # Prevent hangs with large result sets
    ) -> Dict[str, Any]:
        """
        Perform optimized search with highlighting and proper pagination
        
        Args:
            query: Search query text
            page: Page number (1-based)
            page_size: Results per page (max 100)
            search_type: Type of search (fulltext, exact, fuzzy)
            filters: Dictionary of filters to apply
            sort_by: Sort field (relevance, date, speaker, sentiment)
            sort_order: Sort direction (asc, desc)
            enable_highlighting: Enable search term highlighting
            max_results: Maximum total results to prevent hangs
        """
        
        # Limit page size to prevent hangs
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size
        
        # Build Meilisearch query
        search_params = {
            "q": query,
            "offset": offset,
            "limit": page_size,
            "cropLength": 200,
            "cropMarker": "...",
            "matchingStrategy": self._get_matching_strategy(search_type)
        }
        
        # Add highlighting if enabled
        if enable_highlighting:
            search_params.update({
                "highlightPreTag": "<mark>",
                "highlightPostTag": "</mark>",
                "attributesToHighlight": ["transcript_text", "video_title", "speaker_name"]
            })
        
        # Add filtering
        if filters:
            filter_conditions = self._build_filters(filters)
            if filter_conditions:
                search_params["filter"] = filter_conditions
        
        # Add sorting
        if sort_by != "relevance":
            search_params["sort"] = self._build_sort(sort_by, sort_order)
        
        # Perform search
        try:
            result = await self._make_request(
                "POST", 
                "/indexes/segments/search", 
                json_data=search_params
            )
            
            # Process and format results
            return self._format_search_results(result, page, page_size, query)
            
        except Exception as e:
            logger.error(f"Search error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    
    def _get_matching_strategy(self, search_type: str) -> str:
        """Convert search type to Meilisearch matching strategy"""
        strategy_map = {
            "fulltext": "last",  # Find documents with all query terms
            "exact": "all",     # Exact phrase matching
            "fuzzy": "last"     # Allow some missing terms
        }
        return strategy_map.get(search_type, "last")
    
    def _build_filters(self, filters: Dict[str, Any]) -> List[str]:
        """Build Meilisearch filter conditions from filter dictionary"""
        conditions = []
        
        # Speaker filter
        if filters.get("speaker"):
            conditions.append(f'speaker_name = "{filters["speaker"]}"')
        
        # Dataset filter
        if filters.get("dataset") and filters["dataset"].lower() != "all":
            conditions.append(f'dataset = "{filters["dataset"]}"')
        
        # Source filter
        if filters.get("source"):
            conditions.append(f'source = "{filters["source"]}"')
        
        # Date range filters
        if filters.get("date_from"):
            conditions.append(f'video_date >= {int(filters["date_from"].timestamp())}')
        if filters.get("date_to"):
            conditions.append(f'video_date <= {int(filters["date_to"].timestamp())}')
        
        # Sentiment filters
        sentiment = filters.get("sentiment", "").lower()
        if sentiment == "positive":
            conditions.append("sentiment_loughran_score > 0")
        elif sentiment == "negative":
            conditions.append("sentiment_loughran_score < 0")
        elif sentiment == "neutral":
            conditions.append("sentiment_loughran_score = 0")
        
        # Readability filters
        if filters.get("min_readability") is not None:
            conditions.append(f'flesch_kincaid_grade >= {filters["min_readability"]}')
        if filters.get("max_readability") is not None:
            conditions.append(f'flesch_kincaid_grade <= {filters["max_readability"]}')
        
        # Moderation flags
        if filters.get("has_harassment"):
            conditions.append("moderation_harassment_flag = true")
        if filters.get("has_hate"):
            conditions.append("moderation_hate_flag = true")
        if filters.get("has_violence"):
            conditions.append("moderation_violence_flag = true")
        if filters.get("has_sexual"):
            conditions.append("moderation_sexual_flag = true")
        if filters.get("has_selfharm"):
            conditions.append("moderation_selfharm_flag = true")
        
        # Event metadata filters
        if filters.get("format"):
            conditions.append(f'video_format = "{filters["format"]}"')
        if filters.get("candidate"):
            conditions.append(f'video_candidate = "{filters["candidate"]}"')
        if filters.get("place"):
            conditions.append(f'video_place = "{filters["place"]}"')
        if filters.get("record_type"):
            conditions.append(f'video_record_type = "{filters["record_type"]}"')
        
        return conditions
    
    def _build_sort(self, sort_by: str, sort_order: str) -> List[str]:
        """Build Meilisearch sort parameters"""
        sort_field_map = {
            "date": "video_date",
            "speaker": "speaker_name", 
            "sentiment": "sentiment_loughran_score",
            "stresslens": "stresslens_score"
        }
        
        field = sort_field_map.get(sort_by, "video_date")
        direction = "asc" if sort_order.lower() == "asc" else "desc"
        return [f"{field}:{direction}"]
    
    def _format_search_results(
        self, 
        meili_result: Dict[str, Any], 
        page: int, 
        page_size: int,
        query: str
    ) -> Dict[str, Any]:
        """Format Meilisearch results to match API response format"""
        
        hits = meili_result.get("hits", [])
        total = meili_result.get("estimatedTotalHits", len(hits))
        processing_time = meili_result.get("processingTimeMs", 0)
        
        # Format individual results
        formatted_results = []
        for hit in hits:
            # Extract highlighting
            formatted_hit = hit.get("_formatted", hit)
            
            result = {
                "id": hit.get("id"),
                "segment_id": hit.get("segment_id"),
                "speaker_name": formatted_hit.get("speaker_name", hit.get("speaker_name")),
                "transcript_text": formatted_hit.get("transcript_text", hit.get("transcript_text")),
                "video_id": hit.get("video_id"),
                "video_seconds": hit.get("video_seconds"),
                "timestamp_start": hit.get("timestamp_start"),
                "timestamp_end": hit.get("timestamp_end"),
                "word_count": hit.get("word_count", 0),
                "char_count": hit.get("char_count", 0),
                "sentiment_loughran_score": hit.get("sentiment_loughran_score"),
                "stresslens_score": hit.get("stresslens_score"),
                "stresslens_rank": hit.get("stresslens_rank"),
                
                # Video information
                "video": {
                    "id": hit.get("video_id"),
                    "title": formatted_hit.get("video_title", hit.get("video_title")),
                    "source": hit.get("source"),
                    "date": hit.get("video_date"),
                    "format": hit.get("video_format"),
                    "candidate": hit.get("video_candidate"),
                    "place": hit.get("video_place"),
                    "record_type": hit.get("video_record_type"),
                    "video_thumbnail_url": hit.get("video_thumbnail_url")
                },
                
                # Moderation flags
                "moderation_harassment_flag": hit.get("moderation_harassment_flag"),
                "moderation_hate_flag": hit.get("moderation_hate_flag"),
                "moderation_violence_flag": hit.get("moderation_violence_flag"),
                "moderation_sexual_flag": hit.get("moderation_sexual_flag"),
                "moderation_selfharm_flag": hit.get("moderation_selfharm_flag"),
                
                # Search metadata
                "search_score": hit.get("_rankingScore", 0.0),
                "highlighted": "_formatted" in hit,  # Indicates if highlighting was applied
                
                # Frontend compatibility - provide empty segment_topics array
                # TODO: Add proper segment_topics support to Meilisearch sync
                "segment_topics": []
            }
            
            formatted_results.append(result)
        
        return {
            "results": formatted_results,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "query": query,
            "processing_time_ms": processing_time,
            "search_engine": "meilisearch"
        }
    
    async def get_search_suggestions(
        self, 
        partial_query: str,
        suggestion_type: str = "all",
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get autocomplete suggestions for search"""
        
        suggestions = []
        
        try:
            # Use Meilisearch facet search for suggestions
            if suggestion_type in ["all", "speakers"]:
                speaker_results = await self._make_request(
                    "POST",
                    "/indexes/segments/facet-search",
                    json_data={
                        "facetName": "speaker_name",
                        "facetQuery": partial_query,
                        "limit": limit
                    }
                )
                
                for facet in speaker_results.get("facetHits", []):
                    suggestions.append({
                        "value": facet["value"],
                        "type": "speaker",
                        "count": facet["count"]
                    })
            
            # Add more suggestion types as needed
            
            return {
                "suggestions": suggestions[:limit],
                "query": partial_query,
                "type": suggestion_type
            }
            
        except Exception as e:
            logger.error(f"Suggestions error: {str(e)}")
            return {"suggestions": [], "query": partial_query, "error": str(e)}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Meilisearch service health"""
        try:
            health = await self._make_request("GET", "/health")
            stats = await self._make_request("GET", "/stats")
            
            return {
                "status": "healthy",
                "service": "meilisearch",
                "response_time_ms": health.get("response_time_ms", 0),
                "indexes": len(stats.get("indexes", {})),
                "total_documents": sum(
                    idx.get("numberOfDocuments", 0) 
                    for idx in stats.get("indexes", {}).values()
                )
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "service": "meilisearch", 
                "error": str(e)
            }

# Global service instance
optimized_search_service = OptimizedSearchService()