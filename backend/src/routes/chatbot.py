"""
Chatbot API routes for OpenRouter integration with database access
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import httpx
import json
from datetime import datetime

from ..database import get_db
from ..models import Video, TranscriptSegment, Speaker, VideoSummary, Topic
from ..config import settings

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    apiKey: str
    model: str = "anthropic/claude-3.5-sonnet"
    temperature: float = 0.7
    maxTokens: int = 4000
    conversationHistory: List[ChatMessage] = []


class TestRequest(BaseModel):
    apiKey: str
    model: str


class ChatResponse(BaseModel):
    response: str


def build_database_context() -> str:
    """Build context about the database schema and capabilities"""
    return """
You are an AI assistant that helps users analyze a political transcript database. You have access to current database information and can search through transcript content.

DATABASE SCHEMA:
- videos: Contains video metadata (id, title, description, date, thumbnail_url, speaker_name, duration_seconds, video_seconds, sentiment scores, readability metrics, dataset)
- transcript_segments: Individual transcript segments with timestamps (id, video_id, start_time, end_time, speaker_name, content, sentiment scores)
- speakers: Speaker information (id, name, video_count, total_segments)
- video_summaries: AI-generated video summaries (id, video_id, summary, model_used, created_at)
- topics: Topic categories (id, name, frequency)

DATASETS AVAILABLE:
- 'trump': Political video transcripts (primarily English)
- 'tweede_kamer': Dutch parliament (Tweede Kamer) transcripts (Dutch language)

WHAT YOU CAN DO:
- Search through actual transcript content using keywords in English and Dutch
- Find specific quotes and segments from transcripts
- Filter content by language/dataset (e.g., Dutch content from Tweede Kamer)
- Analyze trends and patterns in the political transcript collection
- Provide insights about speakers, topics, sentiment, and content
- Return actual transcript excerpts that match search queries

SEARCH CAPABILITIES:
- Content search supports both English and Dutch keywords
- Can filter by dataset (e.g., only Dutch content from 'tweede_kamer')
- Searches are case-insensitive and support partial matches
- Returns actual transcript content, not just metadata

When you receive database search results in your context, you can provide specific quotes and content from the transcripts. The database contains actual transcript text that can be searched and quoted directly.
"""


async def query_database(query: str, db: AsyncSession) -> Dict[str, Any]:
    """
    Execute database queries based on natural language requests
    This is a simplified implementation - in production, you'd want more sophisticated NLP
    """
    query_lower = query.lower()
    results = {}
    
    try:
        # Always provide basic database stats
        video_result = await db.execute(select(func.count(Video.id)))
        segment_result = await db.execute(select(func.count(TranscriptSegment.id)))
        speaker_result = await db.execute(select(func.count(Speaker.id)))
        
        results["database_overview"] = {
            "total_videos": video_result.scalar(),
            "total_segments": segment_result.scalar(),
            "unique_speakers": speaker_result.scalar()
        }
        # Video count queries (now redundant but keeping for specific responses)
        if "how many videos" in query_lower or "total videos" in query_lower or "video count" in query_lower:
            results["video_count_specific"] = results["database_overview"]["total_videos"]
            
        # Speaker queries
        if "speakers" in query_lower or "who spoke" in query_lower or "speaker" in query_lower:
            result = await db.execute(
                select(Speaker.name, Speaker.video_count)
                .order_by(Speaker.video_count.desc())
                .limit(10)
            )
            speakers = result.all()
            results["top_speakers"] = [{"name": name, "video_count": count} for name, count in speakers]
            
        # Recent videos
        if "recent" in query_lower or "latest" in query_lower:
            result = await db.execute(
                select(Video.id, Video.title, Video.date, Video.speaker_name)
                .order_by(Video.date.desc())
                .limit(5)
            )
            videos = result.all()
            results["recent_videos"] = [{"id": v.id, "title": v.title, "date": str(v.date), "speaker": v.speaker_name} for v in videos]
            
        # Topic queries
        if "topic" in query_lower or "subjects" in query_lower:
            result = await db.execute(
                select(Topic.name, Topic.frequency)
                .order_by(Topic.frequency.desc())
                .limit(10)
            )
            topics = result.all()
            results["top_topics"] = [{"name": name, "frequency": freq} for name, freq in topics]
            
        # Sentiment queries
        if "sentiment" in query_lower:
            result = await db.execute(
                select(Video.sentiment_vader)
                .where(Video.sentiment_vader.isnot(None))
            )
            avg_sentiment = result.scalars().all()
            if avg_sentiment:
                sentiments = [v for v in avg_sentiment if v is not None]
                if sentiments:
                    avg = sum(sentiments) / len(sentiments)
                    results["average_sentiment"] = round(avg, 3)
                    results["sentiment_analysis"] = f"Average sentiment score: {avg:.3f} (range: -1 to 1)"
        
        # Search for specific content - Enhanced with Dutch keywords
        search_terms = {
            "climate": ["climate", "klima", "milieu", "klimaat"],
            "economy": ["economy", "economie", "economic", "economisch"],
            "healthcare": ["healthcare", "health", "zorg", "gezondheid", "ziekenhuis"],
            "education": ["education", "onderwijs", "school", "university", "universiteit"],
            "immigration": ["immigration", "immigratie", "migratie", "vreemdeling"],
            "tax": ["tax", "belasting", "btw", "fiscaal"],
            "government_workers": ["ambtenaren", "overheidsmedewerkers", "civil servants", "government workers", "personeelsreductie", "bezuiniging"],
            "saving_money": ["besparen", "bezuinigen", "kostenreductie", "save money", "cut costs", "reduce spending"]
        }
        
        # Check for Dutch language indicators
        dutch_indicators = ["dutch", "nederlands", "nederlandse", "holland", "tweede kamer"]
        is_dutch_query = any(indicator in query_lower for indicator in dutch_indicators)
        
        # Add more flexible keyword matching for common queries
        if any(word in query_lower for word in ["quotes", "content", "transcripts", "find", "search"]):
            if any(word in query_lower for word in ["government", "overheid", "ambtenaren", "workers", "medewerkers"]):
                search_terms["government_workers_broad"] = ["ambtenaren", "overheid", "government", "workers", "medewerkers", "overheidsmedewerkers"]
            if any(word in query_lower for word in ["money", "geld", "besparen", "saving", "bezuinigen", "costs"]):
                search_terms["saving_money_broad"] = ["besparen", "bezuinigen", "geld", "money", "kosten", "costs", "besparingen"]
        
        for category, terms in search_terms.items():
            if any(term in query_lower for term in terms):
                print(f"DEBUG: Matched category '{category}' with terms {terms}")
                # Build query with dataset filter for Dutch content if requested
                query_builder = select(TranscriptSegment).join(Video)
                
                # Add content search condition
                content_conditions = [TranscriptSegment.content.ilike(f"%{term}%") for term in terms]
                query_builder = query_builder.where(or_(*content_conditions))
                
                # Filter for Dutch content if specifically requested
                if is_dutch_query:
                    query_builder = query_builder.where(Video.dataset == 'tweede_kamer')
                
                query_builder = query_builder.limit(10)
                
                result = await db.execute(query_builder)
                segments = result.scalars().all()
                
                results[f"{category}_mentions"] = len(segments)
                if segments:
                    results[f"{category}_examples"] = [
                        {
                            "video_id": s.video_id, 
                            "content": s.content[:300] + "..." if len(s.content) > 300 else s.content,
                            "speaker": s.speaker_name,
                            "dataset": segments[0].video.dataset if hasattr(segments[0], 'video') else None
                        } 
                        for s in segments[:5]
                    ]
                    
        # Add recent videos for general queries about the database
        if any(word in query_lower for word in ["database", "data", "what", "tell me", "show me", "available", "content"]):
            result = await db.execute(
                select(Video.id, Video.title, Video.date, Video.speaker_name)
                .order_by(Video.date.desc())
                .limit(3)
            )
            videos = result.all()
            results["sample_videos"] = [{"id": v.id, "title": v.title, "date": str(v.date), "speaker": v.speaker_name} for v in videos]
            
        # Database stats
        if "statistics" in query_lower or "stats" in query_lower or "overview" in query_lower:
            video_result = await db.execute(select(func.count(Video.id)))
            video_count = video_result.scalar()
            
            segment_result = await db.execute(select(func.count(TranscriptSegment.id)))
            segment_count = segment_result.scalar()
            
            speaker_result = await db.execute(select(func.count(Speaker.id)))
            speaker_count = speaker_result.scalar()
            
            summary_result = await db.execute(select(func.count(VideoSummary.id)))
            summary_count = summary_result.scalar()
            
            results["database_stats"] = {
                "total_videos": video_count,
                "total_segments": segment_count,
                "unique_speakers": speaker_count,
                "total_summaries": summary_count
            }
            
    except Exception as e:
        results["error"] = f"Database query error: {str(e)}"
        
    return results


@router.post("/test")
async def test_connection(request: TestRequest):
    """Test OpenRouter API connection"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {request.apiKey}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://polibase.nl",
                    "X-Title": "Political Transcript Platform"
                },
                json={
                    "model": request.model,
                    "messages": [{"role": "user", "content": "Test message"}],
                    "max_tokens": 10
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                return {"status": "success", "message": "Connection successful"}
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"OpenRouter API error: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Connection timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Chat with AI assistant that has database access"""
    
    if not request.apiKey:
        raise HTTPException(status_code=400, detail="API key is required")
    
    try:
        # Query database for relevant information
        db_results = await query_database(request.message, db)
        
        # Build context with database results
        db_context = ""
        if db_results:
            db_context = f"\n\nRELEVANT DATABASE INFORMATION:\n{json.dumps(db_results, indent=2)}"
        
        # Build messages for OpenRouter
        messages = [
            {
                "role": "system", 
                "content": build_database_context() + db_context
            }
        ]
        
        # Add conversation history
        for msg in request.conversationHistory[-10:]:  # Last 10 messages for context
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Call OpenRouter API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {request.apiKey}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://polibase.nl",
                    "X-Title": "Political Transcript Platform"
                },
                json={
                    "model": request.model,
                    "messages": messages,
                    "max_tokens": request.maxTokens,
                    "temperature": request.temperature,
                    "stream": False
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                error_detail = f"OpenRouter API error: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_detail += f" - {error_data['error'].get('message', 'Unknown error')}"
                except:
                    pass
                raise HTTPException(status_code=400, detail=error_detail)
            
            result = response.json()
            
            if "choices" not in result or not result["choices"]:
                raise HTTPException(status_code=500, detail="No response from AI model")
                
            ai_response = result["choices"][0]["message"]["content"]
            
            return ChatResponse(response=ai_response)
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/models")
async def get_available_models():
    """Get list of available OpenRouter models"""
    models = [
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet"},
        {"id": "anthropic/claude-3-opus", "name": "Claude 3 Opus"},
        {"id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku"},
        {"id": "openai/gpt-4", "name": "GPT-4"},
        {"id": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
        {"id": "meta-llama/llama-3.2-90b-instruct", "name": "Llama 3.2 90B"},
        {"id": "google/gemini-flash-1.5", "name": "Gemini Flash 1.5"},
        {"id": "x-ai/grok-beta", "name": "Grok Beta"},
    ]
    return {"models": models}


@router.get("/database/stats")
async def get_database_stats(db: AsyncSession = Depends(get_db)):
    """Get database statistics"""
    try:
        video_result = await db.execute(select(func.count(Video.id)))
        segment_result = await db.execute(select(func.count(TranscriptSegment.id)))
        speaker_result = await db.execute(select(func.count(Speaker.id)))
        summary_result = await db.execute(select(func.count(VideoSummary.id)))
        topic_result = await db.execute(select(func.count(Topic.id)))
        
        stats = {
            "total_videos": video_result.scalar(),
            "total_segments": segment_result.scalar(),
            "unique_speakers": speaker_result.scalar(),
            "total_summaries": summary_result.scalar(),
            "topics": topic_result.scalar()
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")