"""
Meilisearch Index Initialization Script

This script sets up Meilisearch indexes, applies settings, and configures embedders
for the Political Video Transcript Search Platform.

Usage:
    python scripts/meili_init.py
"""
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.config import settings


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


async def create_indexes():
    """Create segments and suggestions indexes if they don't exist"""
    print("Creating indexes...")
    
    # Check and create segments index
    response = await meili_request("GET", "/indexes/segments")
    if response.status_code == 404:
        print("Creating 'segments' index...")
        await meili_request("POST", "/indexes", json_body={
            "uid": "segments",
            "primaryKey": "id"
        })
    else:
        print("'segments' index already exists")
    
    # Check and create suggestions index
    response = await meili_request("GET", "/indexes/suggestions")
    if response.status_code == 404:
        print("Creating 'suggestions' index...")
        await meili_request("POST", "/indexes", json_body={
            "uid": "suggestions", 
            "primaryKey": "termId"
        })
    else:
        print("'suggestions' index already exists")


async def configure_segments_settings():
    """Configure settings for the segments index"""
    print("Configuring segments index settings...")
    
    segments_settings = {
        "searchableAttributes": [
            "text",
            "speaker",
            "topic", 
            "video_title"
        ],
        "filterableAttributes": [
            "speaker",
            "topic",
            "language", 
            "date",
            "video_id",
            "source",
            "dataset",
            "candidate",
            "record_type",
            "format",
            "moderation.harassment.flag",
            "moderation.hate.flag",
            "moderation.violence.flag",
            "moderation.sexual.flag",
            "moderation.selfharm.flag",
            "sentiment.vader",
            "sentiment.loughran",
            "sentiment.harvard"
        ],
        "sortableAttributes": [
            "date",
            "video_seconds",
            "sentiment.vader",
            "sentiment.loughran",
            "sentiment.harvard"
        ],
        "displayedAttributes": [
            "id",
            "text", 
            "speaker",
            "topic",
            "language",
            "date",
            "video_seconds",
            "video_url",
            "segment_url",
            "sentiment",
            "moderation",
            "readability",
            "video_title",
            "video_id"
        ],
        "typoTolerance": {
            "enabled": True,
            "minWordSizeForTypos": {
                "oneTypo": 5,
                "twoTypos": 9
            }
        },
        "pagination": {
            "maxTotalHits": 1000000
        },
        "synonyms": {
            # Add synonyms for multilingual support
            "en": ["usa,united states,america", "uk,united kingdom,britain"],
            "nl": ["nederland,netherlands", "vs,verenigde staten"]
        },
        "stopWords": {
            "en": ["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"],
            "nl": ["de", "het", "een", "en", "of", "maar", "in", "op", "aan", "naar", "voor", "van", "met", "door"],
            "de": ["der", "die", "das", "und", "oder", "aber", "in", "auf", "an", "zu", "für", "von", "mit", "durch"],
            "fr": ["le", "la", "les", "un", "une", "et", "ou", "mais", "dans", "sur", "à", "pour", "de", "avec", "par"],
            "es": ["el", "la", "los", "las", "un", "una", "y", "o", "pero", "en", "sobre", "a", "para", "de", "con", "por"]
        }
    }
    
    response = await meili_request("PATCH", "/indexes/segments/settings", json_body=segments_settings)
    if response.status_code >= 400:
        print(f"Error configuring segments settings: {response.status_code} - {response.text}")
    else:
        print("Segments settings applied successfully")


async def configure_suggestions_settings():
    """Configure settings for the suggestions index"""
    print("Configuring suggestions index settings...")
    
    suggestions_settings = {
        "searchableAttributes": ["term"],
        "displayedAttributes": ["term", "kind", "payload"],
        "filterableAttributes": ["kind"],
        "typoTolerance": {
            "enabled": True
        }
    }
    
    response = await meili_request("PATCH", "/indexes/suggestions/settings", json_body=suggestions_settings)
    if response.status_code >= 400:
        print(f"Error configuring suggestions settings: {response.status_code} - {response.text}")
    else:
        print("Suggestions settings applied successfully")


async def configure_embedder():
    """Configure AI embedder for semantic search"""
    if not settings.OPENAI_API_KEY:
        print("No OpenAI API key found. Skipping embedder configuration.")
        return
        
    print("Configuring embedder for AI-powered search...")
    
    embedder_config = {
        "default": {
            "source": "openAi",
            "apiKey": settings.OPENAI_API_KEY,
            "model": "text-embedding-3-small",
            "documentTemplate": "{{doc.text}}"
        }
    }
    
    response = await meili_request("PATCH", "/experimental-features", json_body={
        "vectorStore": True
    })
    
    if response.status_code >= 400:
        print(f"Error enabling vector store: {response.status_code} - {response.text}")
        return
    
    response = await meili_request("PATCH", "/indexes/segments/embedders", json_body=embedder_config)
    if response.status_code >= 400:
        print(f"Error configuring embedder: {response.status_code} - {response.text}")
    else:
        print("Embedder configured successfully")


async def generate_search_key():
    """Generate a restricted search-only API key"""
    print("Generating restricted search key...")
    
    key_config = {
        "description": "Search-only key for frontend",
        "actions": ["search"],
        "indexes": ["segments", "suggestions"],
        "expiresAt": None  # No expiration
    }
    
    response = await meili_request("POST", "/keys", json_body=key_config)
    if response.status_code >= 400:
        print(f"Error generating search key: {response.status_code} - {response.text}")
        return None
    
    key_data = response.json()
    search_key = key_data.get("key")
    print(f"Generated search key: {search_key}")
    print("Store this key in your environment as MEILI_PUBLIC_SEARCH_KEY")
    return search_key


async def seed_suggestions():
    """Seed the suggestions index with common terms"""
    print("Seeding suggestions index...")
    
    try:
        # Connect to database to get common terms
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            db = Session(bind=conn)
            
            # Get top speakers
            speakers_query = text("""
                SELECT speaker_name as term, COUNT(*) as frequency
                FROM transcript_segments 
                WHERE speaker_name IS NOT NULL AND speaker_name != ''
                GROUP BY speaker_name 
                ORDER BY frequency DESC 
                LIMIT 50
            """)
            speakers = db.execute(speakers_query).mappings().all()
            
            # Get top topics (assuming there's a topics table)
            topics_query = text("""
                SELECT t.name as term, COUNT(*) as frequency
                FROM topics t
                JOIN segment_topics st ON t.id = st.topic_id
                GROUP BY t.name 
                ORDER BY frequency DESC 
                LIMIT 30
            """)
            topics = db.execute(topics_query).mappings().all()
            
            # Get common video titles
            titles_query = text("""
                SELECT title as term, 1 as frequency
                FROM videos 
                WHERE title IS NOT NULL AND title != ''
                ORDER BY created_at DESC 
                LIMIT 20
            """)
            titles = db.execute(titles_query).mappings().all()
            
            # Prepare suggestion documents
            suggestions = []
            term_id = 1
            
            for speaker in speakers:
                suggestions.append({
                    "termId": term_id,
                    "term": speaker["term"],
                    "kind": "speaker",
                    "payload": {"frequency": speaker["frequency"]}
                })
                term_id += 1
            
            for topic in topics:
                suggestions.append({
                    "termId": term_id,
                    "term": topic["term"],
                    "kind": "topic", 
                    "payload": {"frequency": topic["frequency"]}
                })
                term_id += 1
                
            for title in titles:
                suggestions.append({
                    "termId": term_id,
                    "term": title["term"],
                    "kind": "title",
                    "payload": {"frequency": title["frequency"]}
                })
                term_id += 1
            
            # Upload suggestions to Meilisearch
            if suggestions:
                response = await meili_request(
                    "POST", 
                    "/indexes/suggestions/documents",
                    json_body=suggestions,
                    params={"primaryKey": "termId"}
                )
                if response.status_code >= 400:
                    print(f"Error seeding suggestions: {response.status_code} - {response.text}")
                else:
                    print(f"Seeded {len(suggestions)} suggestion terms")
            
    except Exception as e:
        print(f"Error seeding suggestions: {e}")


async def wait_for_tasks():
    """Wait for all pending tasks to complete"""
    print("Waiting for Meilisearch tasks to complete...")
    
    while True:
        response = await meili_request("GET", "/tasks")
        if response.status_code >= 400:
            break
            
        tasks = response.json().get("results", [])
        pending_tasks = [t for t in tasks if t.get("status") in ["enqueued", "processing"]]
        
        if not pending_tasks:
            break
            
        print(f"Waiting for {len(pending_tasks)} tasks to complete...")
        await asyncio.sleep(2)
    
    print("All tasks completed")


async def main():
    """Main initialization function"""
    print("Starting Meilisearch initialization...")
    
    if not settings.MEILI_MASTER_KEY:
        print("Error: MEILI_MASTER_KEY is required")
        return
    
    try:
        # Test connection
        response = await meili_request("GET", "/health")
        if response.status_code != 200:
            print("Error: Cannot connect to Meilisearch")
            return
        
        print("Connected to Meilisearch successfully")
        
        # Step 1: Create indexes
        await create_indexes()
        
        # Step 2: Configure settings
        await configure_segments_settings()
        await configure_suggestions_settings()
        
        # Step 3: Configure embedder
        await configure_embedder()
        
        # Step 4: Wait for settings to be applied
        await wait_for_tasks()
        
        # Step 5: Generate search key
        await generate_search_key()
        
        # Step 6: Seed suggestions
        await seed_suggestions()
        
        print("Meilisearch initialization completed successfully!")
        
    except Exception as e:
        print(f"Error during initialization: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
