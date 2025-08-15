"""
Elasticsearch service for advanced search capabilities
"""
import logging
import json
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import asyncio
from dataclasses import dataclass

try:
    from elasticsearch import AsyncElasticsearch
    from elasticsearch.exceptions import NotFoundError, RequestError
    HAS_ELASTICSEARCH = True
except ImportError:
    AsyncElasticsearch = None
    NotFoundError = Exception
    RequestError = Exception
    HAS_ELASTICSEARCH = False

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..models import TranscriptSegment, Video, Speaker, Topic, SegmentTopic
from ..config import settings

logger = logging.getLogger(__name__)

@dataclass
class SearchResult:
    """Search result data structure"""
    id: int
    segment_id: str
    speaker_name: str
    transcript_text: str
    video_id: int
    video_seconds: Optional[int]
    timestamp_start: Optional[str]
    timestamp_end: Optional[str]
    score: float
    highlights: Optional[Dict[str, List[str]]] = None
    video: Optional[Dict[str, Any]] = None
    speaker: Optional[Dict[str, Any]] = None
    segment_topics: Optional[List[Dict[str, Any]]] = None

class ElasticsearchService:
    """Service for Elasticsearch operations"""
    
    def __init__(self):
        self.client: Optional[AsyncElasticsearch] = None
        self.index_name = settings.ELASTICSEARCH_INDEX
        
    async def initialize(self) -> bool:
        """Initialize Elasticsearch client"""
        if not HAS_ELASTICSEARCH:
            logger.warning("Elasticsearch not available - install elasticsearch package")
            return False
            
        try:
            self.client = AsyncElasticsearch(
                [settings.ELASTICSEARCH_URL],
                request_timeout=settings.ELASTICSEARCH_TIMEOUT,
                retry_on_timeout=True,
                max_retries=3
            )
            
            # Test connection
            await self.client.ping()
            logger.info(f"Connected to Elasticsearch at {settings.ELASTICSEARCH_URL}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Elasticsearch: {e}")
            return False
    
    async def close(self):
        """Close Elasticsearch client"""
        if self.client:
            await self.client.close()
    
    async def create_index(self) -> bool:
        """Create the transcript segments index with proper mapping"""
        if not self.client:
            return False
            
        # Define the index mapping
        mapping = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "transcript_analyzer": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": [
                                "lowercase",
                                "stop",
                                "snowball",
                                "word_delimiter_graph",
                                "flatten_graph"
                            ]
                        },
                        "autocomplete_analyzer": {
                            "type": "custom",
                            "tokenizer": "edge_ngram_tokenizer",
                            "filter": ["lowercase"]
                        }
                    },
                    "tokenizer": {
                        "edge_ngram_tokenizer": {
                            "type": "edge_ngram",
                            "min_gram": 2,
                            "max_gram": 10,
                            "token_chars": ["letter", "digit"]
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    # Core segment data
                    "id": {"type": "integer"},
                    "segment_id": {"type": "keyword"},
                    "transcript_text": {
                        "type": "text",
                        "analyzer": "transcript_analyzer",
                        "fields": {
                            "raw": {"type": "keyword"},
                            "autocomplete": {
                                "type": "text",
                                "analyzer": "autocomplete_analyzer"
                            }
                        }
                    },
                    
                    # Speaker information
                    "speaker_name": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "speaker_id": {"type": "integer"},
                    
                    # Video information
                    "video_id": {"type": "integer"},
                    "video_seconds": {"type": "integer"},
                    "timestamp_start": {"type": "keyword"},
                    "timestamp_end": {"type": "keyword"},
                    "duration_seconds": {"type": "integer"},
                    "word_count": {"type": "integer"},
                    "char_count": {"type": "integer"},
                    
                    # Video metadata
                    "video": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "text",
                                "analyzer": "transcript_analyzer",
                                "fields": {"keyword": {"type": "keyword"}}
                            },
                            "source": {"type": "keyword"},
                            "channel": {"type": "keyword"},
                            "date": {"type": "date"},
                            "format": {"type": "keyword"},
                            "candidate": {"type": "keyword"},
                            "place": {"type": "keyword"},
                            "record_type": {"type": "keyword"}
                        }
                    },
                    
                    # Sentiment analysis
                    "sentiment_loughran_score": {"type": "float"},
                    "sentiment_loughran_label": {"type": "keyword"},
                    "sentiment_harvard_score": {"type": "float"},
                    "sentiment_harvard_label": {"type": "keyword"},
                    "sentiment_vader_score": {"type": "float"},
                    "sentiment_vader_label": {"type": "keyword"},
                    
                    # Content moderation
                    "moderation_harassment": {"type": "float"},
                    "moderation_hate": {"type": "float"},
                    "moderation_self_harm": {"type": "float"},
                    "moderation_sexual": {"type": "float"},
                    "moderation_violence": {"type": "float"},
                    "moderation_overall_score": {"type": "float"},
                    "moderation_flags": {
                        "type": "object",
                        "properties": {
                            "harassment": {"type": "boolean"},
                            "hate": {"type": "boolean"},
                            "violence": {"type": "boolean"},
                            "sexual": {"type": "boolean"},
                            "selfharm": {"type": "boolean"}
                        }
                    },
                    
                    # Readability metrics
                    "readability": {
                        "type": "object",
                        "properties": {
                            "flesch_kincaid_grade": {"type": "float"},
                            "gunning_fog_index": {"type": "float"},
                            "coleman_liau_index": {"type": "float"},
                            "automated_readability_index": {"type": "float"},
                            "smog_index": {"type": "float"},
                            "flesch_reading_ease": {"type": "float"}
                        }
                    },
                    
                    # Stresslens analytics
                    "stresslens_score": {"type": "float"},
                    "stresslens_rank": {"type": "integer"},
                    
                    # Topics
                    "topics": {
                        "type": "nested",
                        "properties": {
                            "name": {"type": "keyword"},
                            "score": {"type": "float"},
                            "magnitude": {"type": "float"},
                            "confidence": {"type": "float"}
                        }
                    },
                    
                    # Vector embeddings for semantic search
                    "embedding": {
                        "type": "dense_vector",
                        "dims": 384  # all-MiniLM-L6-v2 dimensions
                    },
                    "embedding_generated_at": {"type": "date"},
                    
                    # Timestamps
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        }
        
        try:
            # Check if index exists
            exists = await self.client.indices.exists(index=self.index_name)
            if exists:
                logger.info(f"Index {self.index_name} already exists")
                return True
                
            # Create index
            await self.client.indices.create(index=self.index_name, body=mapping)
            logger.info(f"Created Elasticsearch index: {self.index_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create index: {e}")
            return False
    
    async def index_document(self, doc_id: int, document: Dict[str, Any]) -> bool:
        """Index a single document"""
        if not self.client:
            return False
            
        try:
            await self.client.index(
                index=self.index_name,
                id=doc_id,
                document=document
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to index document {doc_id}: {e}")
            return False
    
    async def bulk_index(self, documents: List[Dict[str, Any]], chunk_size: int = 1000) -> Dict[str, int]:
        """Bulk index documents"""
        if not self.client:
            return {"indexed": 0, "failed": 0}
            
        indexed_count = 0
        failed_count = 0
        
        # Process in chunks
        for i in range(0, len(documents), chunk_size):
            chunk = documents[i:i + chunk_size]
            
            # Prepare bulk request
            bulk_body = []
            for doc in chunk:
                bulk_body.append({"index": {"_index": self.index_name, "_id": doc["id"]}})
                bulk_body.append(doc)
            
            try:
                response = await self.client.bulk(body=bulk_body)
                
                # Process response
                for item in response["items"]:
                    if "index" in item:
                        if item["index"].get("status") in [200, 201]:
                            indexed_count += 1
                        else:
                            failed_count += 1
                            logger.error(f"Failed to index document: {item}")
                            
            except Exception as e:
                logger.error(f"Bulk index error: {e}")
                failed_count += len(chunk)
        
        logger.info(f"Bulk index completed: {indexed_count} indexed, {failed_count} failed")
        return {"indexed": indexed_count, "failed": failed_count}
    
    async def search(
        self,
        query: str,
        search_type: str = "fulltext",
        page: int = 1,
        page_size: int = 25,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "relevance",
        sort_order: str = "desc",
        similarity_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """Perform search with various types and filters"""
        if not self.client:
            raise RuntimeError("Elasticsearch client not initialized")
            
        # Build the search query
        search_query = self._build_search_query(
            query, search_type, filters, similarity_threshold
        )
        
        # Add sorting
        if sort_by != "relevance":
            search_query["sort"] = self._build_sort(sort_by, sort_order)
        
        # Add pagination
        search_query["from"] = (page - 1) * page_size
        search_query["size"] = page_size
        
        # Add highlighting
        search_query["highlight"] = {
            "fields": {
                "transcript_text": {
                    "fragment_size": 150,
                    "number_of_fragments": 3
                },
                "video.title": {}
            }
        }
        
        try:
            response = await self.client.search(
                index=self.index_name,
                body=search_query
            )
            
            return self._process_search_response(response, page, page_size)
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            raise RuntimeError(f"Search failed: {str(e)}")
    
    def _build_search_query(
        self,
        query: str,
        search_type: str,
        filters: Optional[Dict[str, Any]],
        similarity_threshold: float
    ) -> Dict[str, Any]:
        """Build Elasticsearch query based on search type and filters"""
        
        # Base query structure
        es_query = {
            "query": {
                "bool": {
                    "must": [],
                    "filter": []
                }
            }
        }
        
        # Add main search query based on type
        if search_type == "fulltext":
            es_query["query"]["bool"]["must"].append({
                "multi_match": {
                    "query": query,
                    "fields": [
                        "transcript_text^3",
                        "video.title^2",
                        "speaker_name^1.5"
                    ],
                    "type": "best_fields",
                    "operator": "or",
                    "fuzziness": "AUTO"
                }
            })
        elif search_type == "exact":
            es_query["query"]["bool"]["must"].append({
                "multi_match": {
                    "query": query,
                    "fields": ["transcript_text", "video.title"],
                    "type": "phrase"
                }
            })
        elif search_type == "fuzzy":
            es_query["query"]["bool"]["must"].append({
                "multi_match": {
                    "query": query,
                    "fields": ["transcript_text^2", "video.title"],
                    "fuzziness": "2",
                    "prefix_length": 0,
                    "max_expansions": 50
                }
            })
        elif search_type == "semantic":
            # This will be implemented with kNN search when we have embeddings
            if query:
                # For now, fall back to fulltext until embeddings are ready
                es_query["query"]["bool"]["must"].append({
                    "multi_match": {
                        "query": query,
                        "fields": ["transcript_text^2", "video.title"]
                    }
                })
        
        # Add filters
        if filters:
            if filters.get("speaker"):
                es_query["query"]["bool"]["filter"].append({
                    "match": {"speaker_name": filters["speaker"]}
                })
            
            if filters.get("source"):
                es_query["query"]["bool"]["filter"].append({
                    "term": {"video.source": filters["source"]}
                })
            
            if filters.get("date_from") or filters.get("date_to"):
                date_range = {}
                if filters.get("date_from"):
                    date_range["gte"] = filters["date_from"]
                if filters.get("date_to"):
                    date_range["lte"] = filters["date_to"]
                    
                es_query["query"]["bool"]["filter"].append({
                    "range": {"video.date": date_range}
                })
            
            if filters.get("sentiment"):
                if filters["sentiment"].lower() == "positive":
                    es_query["query"]["bool"]["filter"].append({
                        "range": {"sentiment_loughran_score": {"gt": 0}}
                    })
                elif filters["sentiment"].lower() == "negative":
                    es_query["query"]["bool"]["filter"].append({
                        "range": {"sentiment_loughran_score": {"lt": 0}}
                    })
                elif filters["sentiment"].lower() == "neutral":
                    es_query["query"]["bool"]["filter"].append({
                        "term": {"sentiment_loughran_score": 0}
                    })
            
            # Readability filters
            if filters.get("min_readability") is not None:
                es_query["query"]["bool"]["filter"].append({
                    "range": {"readability.flesch_kincaid_grade": {"gte": filters["min_readability"]}}
                })
            if filters.get("max_readability") is not None:
                es_query["query"]["bool"]["filter"].append({
                    "range": {"readability.flesch_kincaid_grade": {"lte": filters["max_readability"]}}
                })
            
            # Moderation flags
            moderation_filters = []
            if filters.get("has_harassment"):
                moderation_filters.append({"term": {"moderation_flags.harassment": True}})
            if filters.get("has_hate"):
                moderation_filters.append({"term": {"moderation_flags.hate": True}})
            if filters.get("has_violence"):
                moderation_filters.append({"term": {"moderation_flags.violence": True}})
            if filters.get("has_sexual"):
                moderation_filters.append({"term": {"moderation_flags.sexual": True}})
            if filters.get("has_selfharm"):
                moderation_filters.append({"term": {"moderation_flags.selfharm": True}})
            
            es_query["query"]["bool"]["filter"].extend(moderation_filters)
        
        return es_query
    
    def _build_sort(self, sort_by: str, sort_order: str) -> List[Dict[str, Any]]:
        """Build sort configuration"""
        sort_config = []
        
        if sort_by == "date":
            sort_config.append({"video.date": {"order": sort_order}})
        elif sort_by == "speaker":
            sort_config.append({"speaker_name.keyword": {"order": sort_order}})
        elif sort_by == "sentiment":
            sort_config.append({"sentiment_loughran_score": {"order": sort_order}})
        elif sort_by == "stresslens":
            sort_config.append({"stresslens_score": {"order": sort_order}})
        elif sort_by == "similarity":
            # This would be used for semantic search
            sort_config.append({"_score": {"order": "desc"}})
        else:
            sort_config.append({"_score": {"order": "desc"}})
        
        # Always add _score as secondary sort
        if sort_by != "relevance":
            sort_config.append({"_score": {"order": "desc"}})
            
        return sort_config
    
    def _process_search_response(
        self, response: Dict[str, Any], page: int, page_size: int
    ) -> Dict[str, Any]:
        """Process Elasticsearch response into API format"""
        
        hits = response["hits"]["hits"]
        total = response["hits"]["total"]["value"]
        
        results = []
        for hit in hits:
            source = hit["_source"]
            
            result = SearchResult(
                id=source["id"],
                segment_id=source["segment_id"],
                speaker_name=source["speaker_name"],
                transcript_text=source["transcript_text"],
                video_id=source["video_id"],
                video_seconds=source.get("video_seconds"),
                timestamp_start=source.get("timestamp_start"),
                timestamp_end=source.get("timestamp_end"),
                score=hit["_score"],
                highlights=hit.get("highlight"),
                video=source.get("video"),
                speaker=source.get("speaker"),
                segment_topics=source.get("topics")
            )
            
            results.append(result)
        
        return {
            "results": results,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "took": response["took"],
            "max_score": response["hits"]["max_score"]
        }
    
    async def get_aggregations(
        self, 
        query: str = "*",
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Get search aggregations for analytics"""
        if not self.client:
            return {}
            
        # Build base query
        search_query = self._build_search_query(query, "fulltext", filters, 0.5)
        
        # Add aggregations
        search_query["size"] = 0  # Don't return documents, just aggregations
        search_query["aggs"] = {
            "speakers": {
                "terms": {
                    "field": "speaker_name.keyword",
                    "size": 20
                }
            },
            "sources": {
                "terms": {
                    "field": "video.source",
                    "size": 10
                }
            },
            "sentiment_distribution": {
                "range": {
                    "field": "sentiment_loughran_score",
                    "ranges": [
                        {"key": "negative", "to": -0.1},
                        {"key": "neutral", "from": -0.1, "to": 0.1},
                        {"key": "positive", "from": 0.1}
                    ]
                }
            },
            "date_histogram": {
                "date_histogram": {
                    "field": "video.date",
                    "calendar_interval": "month"
                }
            }
        }
        
        try:
            response = await self.client.search(
                index=self.index_name,
                body=search_query
            )
            return response.get("aggregations", {})
            
        except Exception as e:
            logger.error(f"Aggregation error: {e}")
            return {}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Elasticsearch cluster health"""
        if not self.client:
            return {"status": "unavailable", "message": "Client not initialized"}
            
        try:
            health = await self.client.cluster.health()
            index_stats = await self.client.indices.stats(index=self.index_name)
            
            return {
                "status": health["status"],
                "cluster_name": health["cluster_name"],
                "number_of_nodes": health["number_of_nodes"],
                "index_stats": {
                    "total_docs": index_stats["_all"]["total"]["docs"]["count"],
                    "store_size": index_stats["_all"]["total"]["store"]["size_in_bytes"]
                }
            }
            
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return {"status": "error", "message": str(e)}

# Global service instance
elasticsearch_service = ElasticsearchService()