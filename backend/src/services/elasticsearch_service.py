"""
Elasticsearch Data Indexing and Search Service

This module handles the indexing and searching of PostgreSQL data using Elasticsearch.
Provides full-text search, aggregations, and advanced query capabilities.
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode

from elasticsearch import AsyncElasticsearch, exceptions
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from ..config import settings

logger = logging.getLogger(__name__)


class ElasticsearchService:
    """Elasticsearch service for indexing and searching transcript data"""
    
    def __init__(self):
        self.client = None
        self.index_name = settings.ELASTICSEARCH_INDEX
        
    async def get_client(self) -> AsyncElasticsearch:
        """Get or create Elasticsearch client"""
        if not self.client:
            es_config = {
                "hosts": [settings.ELASTICSEARCH_URL],
                "timeout": settings.ELASTICSEARCH_TIMEOUT,
                "max_retries": 3,
                "retry_on_timeout": True,
            }
            
            # Add authentication if configured
            if settings.ELASTICSEARCH_USERNAME and settings.ELASTICSEARCH_PASSWORD:
                es_config["basic_auth"] = (
                    settings.ELASTICSEARCH_USERNAME, 
                    settings.ELASTICSEARCH_PASSWORD
                )
            
            self.client = AsyncElasticsearch(**es_config)
        
        return self.client
    
    async def close(self):
        """Close Elasticsearch client"""
        if self.client:
            await self.client.close()
            self.client = None
    
    async def ping(self) -> bool:
        """Check if Elasticsearch is available"""
        try:
            client = await self.get_client()
            return await client.ping()
        except Exception as e:
            logger.error(f"Elasticsearch ping failed: {e}")
            return False
    
    async def create_index(self) -> bool:
        """Create the transcript segments index with proper mapping"""
        client = await self.get_client()
        
        # Define the mapping for transcript segments
        mapping = {
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "videoId": {"type": "keyword"},
                    "text": {
                        "type": "text",
                        "analyzer": "standard",
                        "search_analyzer": "standard",
                        "fields": {
                            "keyword": {"type": "keyword", "ignore_above": 256},
                            "suggest": {
                                "type": "completion",
                                "analyzer": "simple"
                            }
                        }
                    },
                    "speaker": {
                        "type": "text",
                        "analyzer": "keyword",
                        "fields": {
                            "keyword": {"type": "keyword", "ignore_above": 256}
                        }
                    },
                    "topic": {"type": "keyword"},
                    "language": {"type": "keyword"},
                    "date": {"type": "date"},
                    "video_seconds": {"type": "integer"},
                    "video_url": {"type": "keyword"},
                    "segment_url": {"type": "keyword"},
                    "video_title": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "keyword": {"type": "keyword", "ignore_above": 256}
                        }
                    },
                    "video_id": {"type": "integer"},
                    "source": {"type": "keyword"},
                    "candidate": {"type": "keyword"},
                    "record_type": {"type": "keyword"},
                    "format": {"type": "keyword"},
                    "sentiment": {
                        "type": "object",
                        "properties": {
                            "vader": {"type": "float"},
                            "loughran": {"type": "float"},
                            "harvard": {"type": "float"}
                        }
                    },
                    "moderation": {
                        "type": "object",
                        "properties": {
                            "harassment": {
                                "type": "object",
                                "properties": {
                                    "flag": {"type": "boolean"},
                                    "score": {"type": "float"}
                                }
                            },
                            "hate": {
                                "type": "object",
                                "properties": {
                                    "flag": {"type": "boolean"},
                                    "score": {"type": "float"}
                                }
                            },
                            "violence": {
                                "type": "object",
                                "properties": {
                                    "flag": {"type": "boolean"},
                                    "score": {"type": "float"}
                                }
                            },
                            "sexual": {
                                "type": "object",
                                "properties": {
                                    "flag": {"type": "boolean"},
                                    "score": {"type": "float"}
                                }
                            },
                            "selfharm": {
                                "type": "object",
                                "properties": {
                                    "flag": {"type": "boolean"},
                                    "score": {"type": "float"}
                                }
                            }
                        }
                    },
                    "readability": {
                        "type": "object",
                        "properties": {
                            "flesch_kincaid": {"type": "float"},
                            "gunning_fog": {"type": "float"},
                            "coleman_liau": {"type": "float"},
                            "flesch_reading_ease": {"type": "float"},
                            "smog": {"type": "float"},
                            "ari": {"type": "float"}
                        }
                    }
                }
            },
            "settings": {
                "number_of_shards": 2,
                "number_of_replicas": 1,
                "refresh_interval": "1s",
                "max_result_window": 50000,
                "analysis": {
                    "analyzer": {
                        "text_analyzer": {
                            "type": "standard",
                            "stopwords": "_english_"
                        },
                        "speaker_analyzer": {
                            "type": "keyword"
                        }
                    }
                }
            }
        }
        
        try:
            # Check if index exists
            index_exists = await client.indices.exists(index=self.index_name)
            if index_exists:
                logger.info(f"Index {self.index_name} already exists")
                return True
            
            # Create the index
            await client.indices.create(index=self.index_name, body=mapping)
            logger.info(f"Created Elasticsearch index: {self.index_name}")
            return True
            
        except exceptions.RequestError as e:
            if e.error == "resource_already_exists_exception":
                logger.info(f"Index {self.index_name} already exists")
                return True
            logger.error(f"Error creating index: {e}")
            return False
        except Exception as e:
            logger.error(f"Error creating index: {e}")
            return False
    
    def detect_language(self, text: str) -> str:
        """
        Detect language using langdetect library with fallback to simple heuristics.
        """
        if not text or len(text.strip()) < 10:
            return "en"  # Default to English for short texts
        
        try:
            from langdetect import detect, DetectorFactory
            
            # Set seed for consistent results
            DetectorFactory.seed = 0
            
            # Detect language
            detected = detect(text)
            
            # Map some common language codes to expected ones
            language_map = {
                "en": "en", "nl": "nl", "de": "de", "fr": "fr", "es": "es",
                "it": "it", "pt": "pt", "pl": "pl", "ru": "ru",
                "zh-cn": "zh", "zh": "zh", "ja": "ja", "ko": "ko", "ar": "ar"
            }
            
            return language_map.get(detected, "en")
            
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
            
            # Fallback to simple heuristics
            text_lower = text.lower()
            
            # Language indicators
            dutch_words = ["de", "het", "van", "een", "is", "dat", "en", "te", "op", "voor"]
            english_words = ["the", "and", "a", "to", "of", "in", "that", "is", "for", "on"]
            
            dutch_count = sum(1 for word in dutch_words if f" {word} " in f" {text_lower} ")
            english_count = sum(1 for word in english_words if f" {word} " in f" {text_lower} ")
            
            return "nl" if dutch_count > english_count else "en"
    
    def build_segment_url(self, video_id: int, video_seconds: Optional[int], segment_id: str) -> str:
        """Build a deep link URL for a transcript segment"""
        base_url = f"/videos/{video_id}"
        params = {}
        
        if video_seconds is not None:
            params["t"] = str(video_seconds)
        params["segment_id"] = segment_id
        
        if params:
            return f"{base_url}?{urlencode(params)}"
        return base_url
    
    def transform_segment_to_document(self, row: Dict[str, Any], topics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Transform a database row into an Elasticsearch document"""
        
        # Detect language
        language = self.detect_language(row.get("transcript_text", ""))
        
        # Build segment URL for deep linking
        segment_url = self.build_segment_url(
            row["video_id"], 
            row.get("video_seconds"),
            row["segment_id"]
        )
        
        # Transform the document
        document = {
            "id": str(row["id"]),
            "videoId": str(row["video_id"]),
            "text": row.get("transcript_text", ""),
            "speaker": row.get("speaker_name", ""),
            "topic": [topic["name"] for topic in topics],
            "language": language,
            "date": row["date"].isoformat() if row.get("date") else None,
            "video_seconds": row.get("video_seconds"),
            "video_url": row.get("video_url"),
            "segment_url": segment_url,
            "video_title": row.get("title", ""),
            "video_id": row["video_id"],
            "source": row.get("source"),
            "candidate": row.get("candidate"),
            "record_type": row.get("record_type"),
            "format": row.get("format"),
            "sentiment": {
                "vader": row.get("sentiment_vader_score"),
                "loughran": row.get("sentiment_loughran_score"), 
                "harvard": row.get("sentiment_harvard_score")
            },
            "moderation": {
                "harassment": {
                    "flag": row.get("moderation_harassment_flag", False),
                    "score": row.get("moderation_harassment")
                },
                "hate": {
                    "flag": row.get("moderation_hate_flag", False),
                    "score": row.get("moderation_hate")
                },
                "violence": {
                    "flag": row.get("moderation_violence_flag", False),
                    "score": row.get("moderation_violence")
                },
                "sexual": {
                    "flag": row.get("moderation_sexual_flag", False),
                    "score": row.get("moderation_sexual")
                },
                "selfharm": {
                    "flag": row.get("moderation_selfharm_flag", False),
                    "score": row.get("moderation_self_harm")
                }
            },
            "readability": {
                "flesch_kincaid": row.get("flesch_kincaid_grade"),
                "gunning_fog": row.get("gunning_fog_index"),
                "coleman_liau": row.get("coleman_liau_index"),
                "flesch_reading_ease": row.get("flesch_reading_ease"),
                "smog": row.get("smog_index"),
                "ari": row.get("automated_readability_index")
            }
        }
        
        return document
    
    async def bulk_index_documents(self, documents: List[Dict[str, Any]]) -> bool:
        """Bulk index documents to Elasticsearch"""
        if not documents:
            return True
        
        client = await self.get_client()
        
        # Prepare bulk index actions
        actions = []
        for doc in documents:
            actions.append({
                "_index": self.index_name,
                "_id": doc["id"],
                "_source": doc
            })
        
        try:
            # Batch documents to avoid large payloads
            batch_size = 500
            for i in range(0, len(actions), batch_size):
                batch = actions[i:i + batch_size]
                
                response = await client.bulk(operations=batch, refresh=True)
                
                if response["errors"]:
                    errors = [item for item in response["items"] if "error" in item["index"]]
                    logger.error(f"Bulk indexing errors: {errors[:5]}")  # Log first 5 errors
                    return False
                
                logger.info(f"Indexed batch {i//batch_size + 1} with {len(batch)} documents")
            
            return True
            
        except Exception as e:
            logger.error(f"Error bulk indexing documents: {e}")
            return False
    
    def fetch_segments_batch(self, db: Session, offset: int, limit: int) -> List[Dict[str, Any]]:
        """Fetch a batch of transcript segments with all related data"""
        query = text("""
            SELECT 
                s.id,
                s.segment_id,
                s.speaker_name,
                s.transcript_text,
                s.video_seconds,
                s.timestamp_start,
                s.timestamp_end,
                s.duration_seconds,
                s.word_count,
                s.char_count,
                s.sentiment_loughran_score,
                s.sentiment_harvard_score,
                s.sentiment_vader_score,
                s.moderation_harassment_flag,
                s.moderation_hate_flag,
                s.moderation_violence_flag,
                s.moderation_sexual_flag,
                s.moderation_selfharm_flag,
                s.moderation_harassment,
                s.moderation_hate,
                s.moderation_violence,
                s.moderation_sexual,
                s.moderation_self_harm,
                s.flesch_kincaid_grade,
                s.gunning_fog_index,
                s.coleman_liau_index,
                s.flesch_reading_ease,
                s.smog_index,
                s.automated_readability_index,
                s.stresslens_score,
                s.stresslens_rank,
                s.created_at,
                s.updated_at,
                v.id as video_id,
                v.title,
                v.date,
                v.source,
                v.candidate,
                v.record_type,
                v.format,
                v.url as video_url
            FROM transcript_segments s
            JOIN videos v ON v.id = s.video_id
            ORDER BY s.id
            LIMIT :limit OFFSET :offset
        """)
        
        result = db.execute(query, {"limit": limit, "offset": offset})
        rows = [dict(row._mapping) for row in result]
        
        if not rows:
            return []
        
        # Fetch topics for these segments
        segment_ids = [row["id"] for row in rows]
        topics_query = text("""
            SELECT 
                st.segment_id,
                t.name,
                st.score
            FROM segment_topics st
            JOIN topics t ON t.id = st.topic_id
            WHERE st.segment_id = ANY(:segment_ids)
            ORDER BY st.score DESC
        """)
        
        topics_result = db.execute(topics_query, {"segment_ids": segment_ids})
        topics_by_segment = {}
        
        for topic_row in topics_result:
            segment_id = topic_row.segment_id
            if segment_id not in topics_by_segment:
                topics_by_segment[segment_id] = []
            topics_by_segment[segment_id].append({
                "name": topic_row.name,
                "score": topic_row.score
            })
        
        # Transform rows to documents
        documents = []
        for row in rows:
            segment_topics = topics_by_segment.get(row["id"], [])
            document = self.transform_segment_to_document(row, segment_topics)
            documents.append(document)
        
        return documents
    
    async def reindex_all_segments(self, batch_size: int = 500) -> Dict[str, Any]:
        """
        Reindex all transcript segments from PostgreSQL to Elasticsearch.
        
        Args:
            batch_size: Number of segments to process in each batch
            
        Returns:
            Dictionary with indexing statistics
        """
        logger.info("Starting Elasticsearch reindexing...")
        
        # Ensure index exists
        await self.create_index()
        
        # Create database connection
        engine = create_engine(settings.database_url)
        
        stats = {
            "total_segments": 0,
            "indexed_segments": 0,
            "errors": 0,
            "start_time": datetime.now(),
            "end_time": None
        }
        
        try:
            with engine.connect() as conn:
                db = Session(bind=conn)
                
                # Get total count
                count_query = text("SELECT COUNT(*) as total FROM transcript_segments")
                total_result = db.execute(count_query)
                total_segments = total_result.scalar()
                stats["total_segments"] = total_segments
                
                logger.info(f"Found {total_segments} segments to index")
                
                offset = 0
                indexed_count = 0
                
                while offset < total_segments:
                    # Fetch batch
                    documents = self.fetch_segments_batch(db, offset, batch_size)
                    
                    if not documents:
                        break
                    
                    # Index to Elasticsearch
                    success = await self.bulk_index_documents(documents)
                    
                    if success:
                        indexed_count += len(documents)
                        stats["indexed_segments"] = indexed_count
                    else:
                        stats["errors"] += len(documents)
                    
                    offset += batch_size
                    
                    progress = (indexed_count / total_segments * 100) if total_segments > 0 else 0
                    logger.info(f"Indexed {indexed_count}/{total_segments} segments ({progress:.1f}%)")
                
        except Exception as e:
            logger.error(f"Error during reindexing: {e}")
            stats["errors"] += 1
        
        stats["end_time"] = datetime.now()
        stats["duration"] = (stats["end_time"] - stats["start_time"]).total_seconds()
        
        logger.info(f"Reindexing completed. Indexed {stats['indexed_segments']} segments with {stats['errors']} errors")
        return stats
    
    async def search(self, 
                     query: str, 
                     filters: Dict[str, Any] = None, 
                     size: int = 25, 
                     from_: int = 0,
                     sort: List[Dict[str, str]] = None,
                     search_type: str = "multi_match") -> Dict[str, Any]:
        """
        Search documents in Elasticsearch
        
        Args:
            query: Search query string
            filters: Dictionary of filters to apply
            size: Number of results to return
            from_: Offset for pagination
            sort: Sort configuration
            search_type: Type of search (multi_match, match, term, etc.)
            
        Returns:
            Dictionary with search results
        """
        client = await self.get_client()
        filters = filters or {}
        
        # Build query
        search_body = {
            "size": size,
            "from": from_,
            "query": {
                "bool": {
                    "must": [],
                    "filter": []
                }
            },
            "highlight": {
                "fields": {
                    "text": {
                        "fragment_size": 150,
                        "number_of_fragments": 3
                    },
                    "video_title": {}
                }
            }
        }
        
        # Add main query
        if query:
            if search_type == "multi_match":
                search_body["query"]["bool"]["must"].append({
                    "multi_match": {
                        "query": query,
                        "fields": ["text^2", "video_title^1.5", "speaker"],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                })
            elif search_type == "match":
                search_body["query"]["bool"]["must"].append({
                    "match": {
                        "text": {
                            "query": query,
                            "fuzziness": "AUTO"
                        }
                    }
                })
            elif search_type == "term":
                search_body["query"]["bool"]["must"].append({
                    "match_phrase": {
                        "text": query
                    }
                })
        else:
            search_body["query"] = {"match_all": {}}
        
        # Add filters
        if filters.get("speaker"):
            search_body["query"]["bool"]["filter"].append({
                "match": {"speaker": filters["speaker"]}
            })
        
        if filters.get("source"):
            search_body["query"]["bool"]["filter"].append({
                "term": {"source": filters["source"]}
            })
        
        if filters.get("language"):
            search_body["query"]["bool"]["filter"].append({
                "term": {"language": filters["language"]}
            })
        
        if filters.get("date_from") or filters.get("date_to"):
            date_range = {}
            if filters.get("date_from"):
                date_range["gte"] = filters["date_from"]
            if filters.get("date_to"):
                date_range["lte"] = filters["date_to"]
            
            search_body["query"]["bool"]["filter"].append({
                "range": {"date": date_range}
            })
        
        # Add sentiment filters
        if filters.get("sentiment"):
            sentiment_type = filters["sentiment"].lower()
            if sentiment_type == "positive":
                search_body["query"]["bool"]["filter"].append({
                    "range": {"sentiment.loughran": {"gt": 0}}
                })
            elif sentiment_type == "negative":
                search_body["query"]["bool"]["filter"].append({
                    "range": {"sentiment.loughran": {"lt": 0}}
                })
            elif sentiment_type == "neutral":
                search_body["query"]["bool"]["filter"].append({
                    "term": {"sentiment.loughran": 0}
                })
        
        # Add topic filter
        if filters.get("topic"):
            search_body["query"]["bool"]["filter"].append({
                "term": {"topic": filters["topic"]}
            })
        
        # Add moderation filters
        for flag in ["harassment", "hate", "violence", "sexual", "selfharm"]:
            if filters.get(f"has_{flag}") is True:
                search_body["query"]["bool"]["filter"].append({
                    "term": {f"moderation.{flag}.flag": True}
                })
        
        # Add sorting
        if sort:
            search_body["sort"] = sort
        elif query:
            # Default to relevance sorting when there's a query
            search_body["sort"] = ["_score"]
        else:
            # Default to date sorting for match_all queries
            search_body["sort"] = [{"date": {"order": "desc"}}]
        
        try:
            response = await client.search(index=self.index_name, body=search_body)
            
            # Format response
            results = {
                "hits": response["hits"]["hits"],
                "total": response["hits"]["total"]["value"],
                "max_score": response["hits"].get("max_score"),
                "took": response["took"]
            }
            
            return results
            
        except Exception as e:
            logger.error(f"Elasticsearch search error: {e}")
            raise
    
    async def get_suggestions(self, query: str, field: str = "text", size: int = 10) -> List[str]:
        """Get search suggestions from Elasticsearch"""
        client = await self.get_client()
        
        search_body = {
            "suggest": {
                "suggestions": {
                    "prefix": query,
                    "completion": {
                        "field": f"{field}.suggest",
                        "size": size
                    }
                }
            }
        }
        
        try:
            response = await client.search(index=self.index_name, body=search_body)
            suggestions = []
            
            for option in response["suggest"]["suggestions"][0]["options"]:
                suggestions.append(option["text"])
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error getting suggestions: {e}")
            return []


# Global service instance
elasticsearch_service = ElasticsearchService()