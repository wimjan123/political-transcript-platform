"""
Search endpoints for the Political Transcript Search Platform
"""
import logging
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
from ..services.embedding_service import embedding_service

router = APIRouter()
logger = logging.getLogger(__name__)


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
    
    search_type: str = Query("fulltext", description="Search type: fulltext, exact, fuzzy"),
    sort_by: str = Query("relevance", description="Sort by: relevance, date, speaker, sentiment, stresslens"),
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
        joined_video = False
        
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
            joined_video = True
            conditions.append(Video.source.ilike(f"%{source}%"))
        
        # Dataset filter
        if dataset and dataset.lower() != "all":
            if not joined_video:
                query = query.join(Video)
                joined_video = True
            conditions.append(Video.dataset == dataset)
        
        # Date filters
        if date_from or date_to:
            if not joined_video:
                query = query.join(Video)
                joined_video = True
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
        
        # Event metadata filters
        if format or candidate or place or record_type:
            if not joined_video:
                query = query.join(Video)
                joined_video = True
            if format:
                conditions.append(Video.format.ilike(f"%{format}%"))
            if candidate:
                conditions.append(Video.candidate.ilike(f"%{candidate}%"))
            if place:
                conditions.append(Video.place.ilike(f"%{place}%"))
            if record_type:
                conditions.append(Video.record_type.ilike(f"%{record_type}%"))
        
        # Stresslens filters
        if min_stresslens is not None:
            conditions.append(TranscriptSegment.stresslens_score >= min_stresslens)
        if max_stresslens is not None:
            conditions.append(TranscriptSegment.stresslens_score <= max_stresslens)
        if stresslens_rank is not None:
            conditions.append(TranscriptSegment.stresslens_rank == stresslens_rank)
        
        # Moderation flags filters
        if has_harassment is True:
            conditions.append(TranscriptSegment.moderation_harassment_flag == True)
        if has_hate is True:
            conditions.append(TranscriptSegment.moderation_hate_flag == True)
        if has_violence is True:
            conditions.append(TranscriptSegment.moderation_violence_flag == True)
        if has_sexual is True:
            conditions.append(TranscriptSegment.moderation_sexual_flag == True)
        if has_selfharm is True:
            conditions.append(TranscriptSegment.moderation_selfharm_flag == True)
        
        # Apply conditions
        if conditions:
            query = query.where(and_(*conditions))
        
        # Add sorting
        if sort_by == "relevance" and search_type == "fulltext":
            query = query.order_by(
                text("ts_rank_cd(to_tsvector('english', transcript_text), plainto_tsquery('english', :query)) DESC")
            )
        elif sort_by == "date":
            if not joined_video:
                query = query.join(Video)
                joined_video = True
            order_col = Video.date
        elif sort_by == "speaker":
            order_col = TranscriptSegment.speaker_name
        elif sort_by == "sentiment":
            order_col = TranscriptSegment.sentiment_loughran_score
        elif sort_by == "stresslens":
            order_col = TranscriptSegment.stresslens_score
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
                max_readability=max_readability,
                format=format,
                candidate=candidate,
                place=place,
                record_type=record_type,
                min_stresslens=min_stresslens,
                max_stresslens=max_stresslens,
                stresslens_rank=stresslens_rank,
                dataset=dataset,
                has_harassment=has_harassment,
                has_hate=has_hate,
                has_violence=has_violence,
                has_sexual=has_sexual,
                has_selfharm=has_selfharm
            )
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@router.get("/suggest")
async def search_suggestions(
    q: str = Query(..., description="Partial search query"),
    type: str = Query("all", description="Suggestion type: all, speakers, topics, sources, formats, candidates, places, record_types"),
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
            ).distinct().limit(limit if type == "sources" else limit // 7)
            
            result = await db.execute(source_query)
            sources = result.scalars().all()
            suggestions.extend([{"value": source, "type": "source"} for source in sources if source])
        
        if type in ["all", "formats"]:
            # Format suggestions
            format_query = select(Video.format).where(
                Video.format.ilike(f"%{q}%")
            ).distinct().limit(limit if type == "formats" else limit // 7)
            
            result = await db.execute(format_query)
            formats = result.scalars().all()
            suggestions.extend([{"value": format_val, "type": "format"} for format_val in formats if format_val])
        
        if type in ["all", "candidates"]:
            # Candidate suggestions
            candidate_query = select(Video.candidate).where(
                Video.candidate.ilike(f"%{q}%")
            ).distinct().limit(limit if type == "candidates" else limit // 7)
            
            result = await db.execute(candidate_query)
            candidates = result.scalars().all()
            suggestions.extend([{"value": candidate, "type": "candidate"} for candidate in candidates if candidate])
        
        if type in ["all", "places"]:
            # Place suggestions
            place_query = select(Video.place).where(
                Video.place.ilike(f"%{q}%")
            ).distinct().limit(limit if type == "places" else limit // 7)
            
            result = await db.execute(place_query)
            places = result.scalars().all()
            suggestions.extend([{"value": place, "type": "place"} for place in places if place])
        
        if type in ["all", "record_types"]:
            # Record type suggestions
            record_type_query = select(Video.record_type).where(
                Video.record_type.ilike(f"%{q}%")
            ).distinct().limit(limit if type == "record_types" else limit // 7)
            
            result = await db.execute(record_type_query)
            record_types = result.scalars().all()
            suggestions.extend([{"value": record_type, "type": "record_type"} for record_type in record_types if record_type])
        
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
    
    # Event metadata filters
    event_format: Optional[str] = Query(None),
    candidate: Optional[str] = Query(None),
    place: Optional[str] = Query(None),
    record_type: Optional[str] = Query(None),
    
    # Stresslens filters
    min_stresslens: Optional[float] = Query(None),
    max_stresslens: Optional[float] = Query(None),
    stresslens_rank: Optional[int] = Query(None),
    
    # Moderation flags filters
    has_harassment: Optional[bool] = Query(None),
    has_hate: Optional[bool] = Query(None),
    has_violence: Optional[bool] = Query(None),
    has_sexual: Optional[bool] = Query(None),
    has_selfharm: Optional[bool] = Query(None),
    
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
            format=event_format, candidate=candidate, place=place, record_type=record_type,
            min_stresslens=min_stresslens, max_stresslens=max_stresslens, stresslens_rank=stresslens_rank,
            has_harassment=has_harassment, has_hate=has_hate, has_violence=has_violence,
            has_sexual=has_sexual, has_selfharm=has_selfharm,
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
                "Date", "Timestamp", "Sentiment Score", "Primary Topic",
                "Format", "Candidate", "Place", "Record Type",
                "Stresslens Score", "Stresslens Rank",
                "Harassment Flag", "Hate Flag", "Violence Flag", "Sexual Flag", "Self-harm Flag"
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
                    result.primary_topic if hasattr(result, 'primary_topic') else "",
                    result.video.format if result.video else "",
                    result.video.candidate if result.video else "",
                    result.video.place if result.video else "",
                    result.video.record_type if result.video else "",
                    result.stresslens_score,
                    result.stresslens_rank,
                    result.moderation_harassment_flag,
                    result.moderation_hate_flag,
                    result.moderation_violence_flag,
                    result.moderation_sexual_flag,
                    result.moderation_selfharm_flag
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


@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., description="Search query for semantic search"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Results per page"),
    similarity_threshold: float = Query(0.5, ge=0, le=1, description="Minimum similarity threshold (0-1)"),
    
    # Filter parameters (same as regular search)
    speaker: Optional[str] = Query(None, description="Filter by speaker name"),
    source: Optional[str] = Query(None, description="Filter by video source"),
    date_from: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    
    # Event metadata filters
    format: Optional[str] = Query(None, description="Filter by event format"),
    candidate: Optional[str] = Query(None, description="Filter by candidate name"),
    place: Optional[str] = Query(None, description="Filter by event place"),
    record_type: Optional[str] = Query(None, description="Filter by record type"),
    
    db: AsyncSession = Depends(get_db)
):
    """
    Perform semantic search on transcript segments using vector embeddings
    
    This endpoint uses pre-computed embeddings to find semantically similar content,
    even when the exact keywords don't appear in the text.
    """
    try:
        # Build filters dictionary
        filters = {}
        if speaker:
            filters["speaker"] = speaker
        if date_from:
            filters["min_date"] = date_from
        if date_to:
            filters["max_date"] = date_to
            
        # Perform semantic search
        raw_results = await embedding_service.semantic_search(
            db=db,
            query_text=q,
            limit=page_size * 2,  # Get more results to account for post-filtering
            similarity_threshold=similarity_threshold,
            filters=filters
        )
        
        # Apply additional filters that aren't handled by the embedding service
        filtered_results = []
        for result in raw_results:
            # Get video information for additional filtering
            video_query = select(Video).where(Video.id == result["video_id"])
            video_result = await db.execute(video_query)
            video = video_result.scalar_one_or_none()
            
            # Apply video-level filters
            if source and video and video.source and source.lower() not in video.source.lower():
                continue
            if format and video and video.format and format.lower() not in video.format.lower():
                continue
            if candidate and video and video.candidate and candidate.lower() not in video.candidate.lower():
                continue
            if place and video and video.place and place.lower() not in video.place.lower():
                continue
            if record_type and video and video.record_type and record_type.lower() not in video.record_type.lower():
                continue
            
            # Add video info to result
            if video:
                result["video"] = {
                    "id": video.id,
                    "title": video.title,
                    "source": video.source,
                    "date": video.date,
                    "format": video.format,
                    "candidate": video.candidate,
                    "place": video.place,
                    "record_type": video.record_type,
                    "video_thumbnail_url": video.video_thumbnail_url
                }
            
            filtered_results.append(result)
        
        # Apply pagination
        total_results = len(filtered_results)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_results = filtered_results[start_idx:end_idx]
        
        # Convert to response format
        segment_responses = []
        for result in paginated_results:
            segment_response = {
                "id": result["id"],
                "segment_id": result["segment_id"],
                "speaker_name": result["speaker_name"],
                "transcript_text": result["transcript_text"],
                "video_id": result["video_id"],
                "video_seconds": result["video_seconds"],
                "timestamp_start": result["timestamp_start"],
                "timestamp_end": result["timestamp_end"],
                "word_count": len(result["transcript_text"].split()) if result["transcript_text"] else 0,
                "char_count": len(result["transcript_text"]) if result["transcript_text"] else 0,
                "sentiment_loughran_score": result.get("sentiment_loughran_score"),
                "stresslens_score": result.get("stresslens_score"),
                "similarity_score": result["similarity_score"],
                "video": result.get("video"),
                "segment_topics": []  # TODO: Add topics if needed
            }
            segment_responses.append(segment_response)
        
        # Build response
        return {
            "results": segment_responses,
            "total": total_results,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_results + page_size - 1) // page_size,
            "query": q,
            "search_type": "semantic",
            "similarity_threshold": similarity_threshold,
            "filters": {
                "speaker": speaker,
                "source": source,
                "date_from": date_from,
                "date_to": date_to,
                "format": format,
                "candidate": candidate,
                "place": place,
                "record_type": record_type
            }
        }
    
    except Exception as e:
        logger.error(f"Semantic search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Semantic search error: {str(e)}")


@router.post("/generate-embeddings")
async def generate_embeddings_endpoint(
    force_regenerate: bool = Query(False, description="Force regeneration of existing embeddings"),
    batch_size: int = Query(100, ge=10, le=1000, description="Batch size for processing"),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate or regenerate embeddings for all transcript segments
    
    This is typically run after importing new data or when updating the embedding model.
    """
    try:
        result = await embedding_service.generate_embeddings_for_segments(
            db=db,
            force_regenerate=force_regenerate,
            batch_size=batch_size
        )
        
        return {
            "message": "Embedding generation completed",
            "stats": result
        }
    
    except Exception as e:
        logger.error(f"Embedding generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Embedding generation error: {str(e)}")


@router.get("/embedding-status")
async def embedding_status(db: AsyncSession = Depends(get_db)):
    """
    Get status of embedding generation for transcript segments
    """
    try:
        # Count segments with and without embeddings
        total_query = select(func.count(TranscriptSegment.id))
        total_result = await db.execute(total_query)
        total_segments = total_result.scalar_one()
        
        with_embeddings_query = select(func.count(TranscriptSegment.id)).where(
            TranscriptSegment.embedding_generated_at.isnot(None)
        )
        with_embeddings_result = await db.execute(with_embeddings_query)
        with_embeddings = with_embeddings_result.scalar_one()
        
        without_embeddings = total_segments - with_embeddings
        completion_percentage = (with_embeddings / total_segments * 100) if total_segments > 0 else 0
        
        # Get latest embedding generation timestamp
        latest_query = select(func.max(TranscriptSegment.embedding_generated_at))
        latest_result = await db.execute(latest_query)
        latest_generation = latest_result.scalar_one()
        
        return {
            "total_segments": total_segments,
            "segments_with_embeddings": with_embeddings,
            "segments_without_embeddings": without_embeddings,
            "completion_percentage": round(completion_percentage, 2),
            "latest_generation_time": latest_generation,
            "embedding_model": embedding_service.model_name,
            "embedding_dimensions": embedding_service.embedding_dim
        }
    
    except Exception as e:
        logger.error(f"Embedding status error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Embedding status error: {str(e)}")
