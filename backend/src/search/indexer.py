"""
Meilisearch Data Indexing Pipeline

This module handles the transformation and indexing of PostgreSQL data into Meilisearch.
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from ..config import settings

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


async def upsert_documents(index: str, documents: List[Dict[str, Any]]) -> None:
    """Upsert documents into a Meilisearch index"""
    if not documents:
        return
    
    # Batch documents to avoid large payloads
    batch_size = 1000
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        
        response = await meili_request(
            "POST",
            f"/indexes/{index}/documents",
            json_body=batch,
            params={"primaryKey": "id"}
        )
        
        if response.status_code >= 400:
            logger.error(f"Failed to upsert batch {i//batch_size + 1}: {response.status_code} - {response.text}")
            raise RuntimeError(f"Meilisearch upsert failed: {response.text}")
        
        logger.info(f"Upserted batch {i//batch_size + 1} with {len(batch)} documents")


def detect_language(text: str) -> str:
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
            "en": "en",
            "nl": "nl", 
            "de": "de",
            "fr": "fr",
            "es": "es",
            "it": "it",
            "pt": "pt",
            "pl": "pl",
            "ru": "ru",
            "zh-cn": "zh",
            "zh": "zh",
            "ja": "ja",
            "ko": "ko",
            "ar": "ar"
        }
        
        return language_map.get(detected, "en")
        
    except Exception as e:
        logger.warning(f"Language detection failed for text snippet: {e}")
        
        # Fallback to simple heuristics
        text_lower = text.lower()
        
        # Dutch indicators
        dutch_words = ["de", "het", "van", "een", "is", "dat", "en", "te", "op", "voor", "wordt", "heeft", "zijn"]
        dutch_count = sum(1 for word in dutch_words if f" {word} " in f" {text_lower} ")
        
        # English indicators  
        english_words = ["the", "and", "a", "to", "of", "in", "that", "is", "for", "on", "with", "have", "are"]
        english_count = sum(1 for word in english_words if f" {word} " in f" {text_lower} ")
        
        # German indicators
        german_words = ["der", "die", "das", "und", "ist", "von", "zu", "mit", "sich", "auf", "für"]
        german_count = sum(1 for word in german_words if f" {word} " in f" {text_lower} ")
        
        # French indicators
        french_words = ["le", "de", "et", "la", "les", "des", "est", "un", "une", "dans", "pour", "avec"]
        french_count = sum(1 for word in french_words if f" {word} " in f" {text_lower} ")
        
        # Spanish indicators
        spanish_words = ["el", "la", "de", "que", "y", "es", "en", "un", "se", "no", "te", "lo", "le"]
        spanish_count = sum(1 for word in spanish_words if f" {word} " in f" {text_lower} ")
        
        # Find language with highest count
        counts = {
            "nl": dutch_count,
            "en": english_count,
            "de": german_count,
            "fr": french_count,
            "es": spanish_count
        }
        
        detected_lang = max(counts, key=counts.get)
        return detected_lang if counts[detected_lang] > 0 else "en"


def build_segment_url(video_id: int, video_seconds: Optional[int], segment_id: str) -> str:
    """Build a deep link URL for a transcript segment"""
    base_url = f"/videos/{video_id}"
    params = {}
    
    if video_seconds is not None:
        params["t"] = str(video_seconds)
    params["segment_id"] = segment_id
    
    if params:
        return f"{base_url}?{urlencode(params)}"
    return base_url


def transform_segment_to_document(row: Dict[str, Any], topics: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Transform a database row into a Meilisearch document"""
    
    # Detect language
    language = detect_language(row.get("transcript_text", ""))
    
    # Build segment URL for deep linking
    segment_url = build_segment_url(
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


def fetch_segments_batch(db: Session, offset: int, limit: int) -> List[Dict[str, Any]]:
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
        document = transform_segment_to_document(row, segment_topics)
        documents.append(document)
    
    return documents


async def reindex_segments(batch_size: int = 1000) -> None:
    """
    Reindex all transcript segments from PostgreSQL to Meilisearch.
    
    Args:
        batch_size: Number of segments to process in each batch
    """
    logger.info("Starting segments reindexing...")
    
    # Create database connection
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        db = Session(bind=conn)
        
        # Get total count
        count_query = text("SELECT COUNT(*) as total FROM transcript_segments")
        total_result = db.execute(count_query)
        total_segments = total_result.scalar()
        
        logger.info(f"Found {total_segments} segments to index")
        
        offset = 0
        indexed_count = 0
        
        while offset < total_segments:
            # Fetch batch
            documents = fetch_segments_batch(db, offset, batch_size)
            
            if not documents:
                break
            
            # Upsert to Meilisearch
            await upsert_documents("segments", documents)
            
            indexed_count += len(documents)
            offset += batch_size
            
            logger.info(f"Indexed {indexed_count}/{total_segments} segments ({indexed_count/total_segments*100:.1f}%)")
        
        logger.info(f"Reindexing completed. Indexed {indexed_count} segments")


async def generate_suggestions() -> None:
    """Generate and index suggestion terms from the database"""
    logger.info("Generating suggestions...")
    
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        db = Session(bind=conn)
        
        suggestions = []
        term_id = 1
        
        # Top speakers
        speakers_query = text("""
            SELECT speaker_name as term, COUNT(*) as frequency
            FROM transcript_segments 
            WHERE speaker_name IS NOT NULL AND speaker_name != ''
            GROUP BY speaker_name 
            ORDER BY frequency DESC 
            LIMIT 50
        """)
        speakers = db.execute(speakers_query).mappings().all()
        
        for speaker in speakers:
            suggestions.append({
                "termId": term_id,
                "term": speaker["term"],
                "kind": "speaker",
                "payload": {"frequency": speaker["frequency"]}
            })
            term_id += 1
        
        # Top topics
        try:
            topics_query = text("""
                SELECT t.name as term, COUNT(*) as frequency
                FROM topics t
                JOIN segment_topics st ON t.id = st.topic_id
                GROUP BY t.name 
                ORDER BY frequency DESC 
                LIMIT 30
            """)
            topics = db.execute(topics_query).mappings().all()
            
            for topic in topics:
                suggestions.append({
                    "termId": term_id,
                    "term": topic["term"],
                    "kind": "topic",
                    "payload": {"frequency": topic["frequency"]}
                })
                term_id += 1
        except Exception as e:
            logger.warning(f"Could not fetch topics: {e}")
        
        # Video titles
        titles_query = text("""
            SELECT title as term, 1 as frequency
            FROM videos 
            WHERE title IS NOT NULL AND title != ''
            ORDER BY created_at DESC 
            LIMIT 20
        """)
        titles = db.execute(titles_query).mappings().all()
        
        for title in titles:
            suggestions.append({
                "termId": term_id,
                "term": title["term"],
                "kind": "title",
                "payload": {"frequency": title["frequency"]}
            })
            term_id += 1
        
        # Upsert suggestions
        if suggestions:
            await upsert_documents("suggestions", suggestions)
            logger.info(f"Generated {len(suggestions)} suggestion terms")
        else:
            logger.warning("No suggestions generated")


if __name__ == "__main__":
    # This allows the module to be run directly for testing
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "suggestions":
        asyncio.run(generate_suggestions())
    else:
        asyncio.run(reindex_segments())