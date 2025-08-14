"""
Search endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, or_, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime, date

from ..database import get_db
from ..models import TranscriptSegment, Video, Speaker, Topic, SegmentTopic
from ..schemas import SearchResponse, SearchFilters, TranscriptSegmentResponse
from ..config import settings

router = APIRouter()


@router.get("/", response_model=SearchResponse)
async def search_transcripts(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Results per page"),
    speaker: Optional[str] = Query(None, description="Filter by speaker name"),
    source: Optional[str] = Query(None, description="Filter by video source"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    date_from: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (positive/negative/neutral)"),
    min_readability: Optional[float] = Query(None, description="Minimum readability score"),
    max_readability: Optional[float] = Query(None, description="Maximum readability score"),
    search_type: str = Query("fulltext", description="Search type: fulltext, exact, fuzzy"),
    sort_by: str = Query("relevance", description="Sort by: relevance, date, speaker, sentiment"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search transcript segments with advanced filtering and sorting
    """
    try:
        # Build base query
        query = select(TranscriptSegment).options(
            selectinload(TranscriptSegment.video),
            selectinload(TranscriptSegment.speaker),
            selectinload(TranscriptSegment.segment_topics).selectinload(SegmentTopic.topic)
        )
        
        # Add search conditions
        conditions = []
        
        # Text search
        if search_type == "fulltext":
            conditions.append(
                text("to_tsvector('english', transcript_text) @@ plainto_tsquery('english', :query)")
            )
        elif search_type == "exact":
            conditions.append(TranscriptSegment.transcript_text.ilike(f"%{q}%"))
        elif search_type == "fuzzy":
            conditions.append(
                text("transcript_text % :query OR similarity(transcript_text, :query) > 0.3")
            )
        
        # Speaker filter
        if speaker:
            conditions.append(TranscriptSegment.speaker_name.ilike(f"%{speaker}%"))
        
        # Source filter
        if source:
            query = query.join(Video)
            conditions.append(Video.source.ilike(f"%{source}%"))
        
        # Date filters
        if date_from or date_to:
            if Video not in query.column_descriptions:
                query = query.join(Video)
            if date_from:
                conditions.append(Video.date >= date_from)
            if date_to:
                conditions.append(Video.date <= date_to)
        
        # Sentiment filter
        if sentiment:
            if sentiment.lower() == "positive":
                conditions.append(TranscriptSegment.sentiment_loughran_score > 0)
            elif sentiment.lower() == "negative":
                conditions.append(TranscriptSegment.sentiment_loughran_score < 0)
            elif sentiment.lower() == "neutral":
                conditions.append(TranscriptSegment.sentiment_loughran_score == 0)
        
        # Readability filters
        if min_readability is not None:
            conditions.append(TranscriptSegment.flesch_kincaid_grade >= min_readability)
        if max_readability is not None:
            conditions.append(TranscriptSegment.flesch_kincaid_grade <= max_readability)
        
        # Topic filter
        if topic:
            query = query.join(SegmentTopic).join(Topic)
            conditions.append(Topic.name.ilike(f"%{topic}%"))
        
        # Apply conditions
        if conditions:
            query = query.where(and_(*conditions))
        
        # Add sorting
        if sort_by == "relevance" and search_type == "fulltext":
            query = query.order_by(
                text("ts_rank_cd(to_tsvector('english', transcript_text), plainto_tsquery('english', :query)) DESC")
            )
        elif sort_by == "date":
            if Video not in query.column_descriptions:
                query = query.join(Video)
            order_col = Video.date
        elif sort_by == "speaker":
            order_col = TranscriptSegment.speaker_name
        elif sort_by == "sentiment":
            order_col = TranscriptSegment.sentiment_loughran_score
        else:
            order_col = TranscriptSegment.created_at
        
        if sort_by != "relevance":
            if sort_order == "desc":
                query = query.order_by(order_col.desc())
            else:
                query = query.order_by(order_col.asc())
        
        # Count total results
        count_query = select(func.count()).select_from(query.subquery())
        if search_type == "fulltext":
            result = await db.execute(count_query, {"query": q})
        else:
            result = await db.execute(count_query)
        total = result.scalar_one()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # Execute query
        if search_type == "fulltext" or search_type == "fuzzy":
            result = await db.execute(query, {"query": q})
        else:
            result = await db.execute(query)
        
        segments = result.scalars().all()
        
        # Build response
        return SearchResponse(
            results=[TranscriptSegmentResponse.from_orm(segment) for segment in segments],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            query=q,
            filters=SearchFilters(
                speaker=speaker,
                source=source,
                topic=topic,
                date_from=date_from,
                date_to=date_to,
                sentiment=sentiment,
                min_readability=min_readability,
                max_readability=max_readability
            )
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@router.get("/suggest")
async def search_suggestions(
    q: str = Query(..., description="Partial search query"),
    type: str = Query("all", description="Suggestion type: all, speakers, topics, sources"),
    limit: int = Query(10, ge=1, le=50, description="Maximum suggestions"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get search suggestions for autocomplete
    """
    suggestions = []
    
    try:
        if type in ["all", "speakers"]:
            # Speaker suggestions
            speaker_query = select(Speaker.name).where(
                Speaker.name.ilike(f"%{q}%")
            ).limit(limit if type == "speakers" else limit // 3)
            
            result = await db.execute(speaker_query)
            speakers = result.scalars().all()
            suggestions.extend([{"value": name, "type": "speaker"} for name in speakers])
        
        if type in ["all", "topics"]:
            # Topic suggestions
            topic_query = select(Topic.name).where(
                Topic.name.ilike(f"%{q}%")
            ).limit(limit if type == "topics" else limit // 3)
            
            result = await db.execute(topic_query)
            topics = result.scalars().all()
            suggestions.extend([{"value": name, "type": "topic"} for name in topics])
        
        if type in ["all", "sources"]:
            # Source suggestions
            source_query = select(Video.source).where(
                Video.source.ilike(f"%{q}%")
            ).distinct().limit(limit if type == "sources" else limit // 3)
            
            result = await db.execute(source_query)
            sources = result.scalars().all()
            suggestions.extend([{"value": source, "type": "source"} for source in sources if source])
        
        return {"suggestions": suggestions[:limit]}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suggestion error: {str(e)}")


@router.get("/export")
async def export_search_results(
    q: str = Query(..., description="Search query"),
    format: str = Query("csv", description="Export format: csv, json"),
    speaker: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sentiment: Optional[str] = Query(None),
    search_type: str = Query("fulltext"),
    limit: int = Query(1000, le=settings.MAX_SEARCH_RESULTS),
    db: AsyncSession = Depends(get_db)
):
    """
    Export search results in CSV or JSON format
    """
    try:
        # Reuse search logic but with higher limit
        search_response = await search_transcripts(
            q=q, page=1, page_size=limit,
            speaker=speaker, source=source, topic=topic,
            date_from=date_from, date_to=date_to, sentiment=sentiment,
            search_type=search_type, db=db
        )
        
        if format == "csv":
            # Convert to CSV format
            import io
            import csv
            from fastapi.responses import StreamingResponse
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                "Segment ID", "Speaker", "Text", "Video Title", "Source", 
                "Date", "Timestamp", "Sentiment Score", "Primary Topic"
            ])
            
            # Data rows
            for result in search_response.results:
                writer.writerow([
                    result.segment_id,
                    result.speaker_name,
                    result.transcript_text,
                    result.video.title if result.video else "",
                    result.video.source if result.video else "",
                    result.video.date if result.video else "",
                    f"{result.timestamp_start}-{result.timestamp_end}",
                    result.sentiment_loughran_score,
                    result.primary_topic if hasattr(result, 'primary_topic') else ""
                ])
            
            output.seek(0)
            
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode('utf-8')),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=search_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
            )
        
        else:  # JSON format
            from fastapi.responses import JSONResponse
            return JSONResponse(content=search_response.dict())
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")