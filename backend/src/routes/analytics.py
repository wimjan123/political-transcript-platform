"""
Analytics endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, text, case
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta

from ..database import get_db
from ..models import TranscriptSegment, Video, Speaker, Topic, SegmentTopic
from ..schemas import (
    AnalyticsStatsResponse, SentimentAnalyticsResponse, TopicAnalyticsResponse,
    ReadabilityAnalyticsResponse, ContentModerationAnalyticsResponse
)

router = APIRouter()


@router.get("/stats", response_model=AnalyticsStatsResponse)
async def get_analytics_stats(
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall platform statistics
    """
    try:
        # Simple counts without joins first
        total_videos = await db.scalar(select(func.count(Video.id)))
        total_segments = await db.scalar(select(func.count(TranscriptSegment.id)))
        total_speakers = await db.scalar(select(func.count(Speaker.id)))
        total_topics = await db.scalar(select(func.count(Topic.id)))
        
        # Date range - simple query
        result = await db.execute(select(func.min(Video.date), func.max(Video.date)))
        min_date, max_date = result.first()
        
        # Top speakers by segment count (simplified query)
        top_speakers_query = select(
            TranscriptSegment.speaker_name,
            func.count(TranscriptSegment.id).label('segment_count'),
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment')
        ).group_by(TranscriptSegment.speaker_name).order_by(func.count(TranscriptSegment.id).desc()).limit(10)
        
        result = await db.execute(top_speakers_query)
        top_speakers = [
            {
                "name": row.speaker_name,
                "segment_count": row.segment_count,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0
            }
            for row in result
        ]
        
        # Basic sentiment distribution
        sentiment_query = select(
            case(
                (
                    TranscriptSegment.sentiment_loughran_score > 0,
                    'positive'
                ),
                (
                    TranscriptSegment.sentiment_loughran_score < 0,
                    'negative'
                ),
                else_='neutral'
            ).label('sentiment'),
            func.count().label('count')
        ).group_by('sentiment')
        
        result = await db.execute(sentiment_query)
        sentiment_distribution = {row.sentiment: row.count for row in result}
        
        # For now, leave top_topics empty to avoid complex joins
        top_topics = []
        
        return AnalyticsStatsResponse(
            total_videos=total_videos,
            total_segments=total_segments,
            total_speakers=total_speakers,
            total_topics=total_topics,
            date_range={
                "min_date": min_date,
                "max_date": max_date
            },
            top_speakers=top_speakers,
            top_topics=top_topics,
            sentiment_distribution=sentiment_distribution
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics stats error: {str(e)}")


@router.get("/sentiment", response_model=SentimentAnalyticsResponse)
async def get_sentiment_analytics(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    speaker: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get sentiment analysis analytics
    """
    try:
        base_conditions = []
        if date_from or date_to:
            if date_from:
                base_conditions.append(Video.date >= date_from)
            if date_to:
                base_conditions.append(Video.date <= date_to)
        
        if speaker:
            base_conditions.append(TranscriptSegment.speaker_name.ilike(f"%{speaker}%"))
        
        # Sentiment by speaker - simplified
        by_speaker_query = select(
            TranscriptSegment.speaker_name,
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment'),
            func.count().label('segment_count')
        ).group_by(TranscriptSegment.speaker_name).order_by(func.count().desc()).limit(20)
        
        result = await db.execute(by_speaker_query)
        by_speaker = [
            {
                "speaker": row.speaker_name,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0,
                "segment_count": row.segment_count,
                "sentiment_stddev": 0
            }
            for row in result
        ]
        
        # Simplified placeholders for other data
        by_topic = []
        by_date = []
        
        # Sentiment distribution - simplified
        distribution = {"positive": 0, "negative": 0, "neutral": 0}
        
        # Average scores - simplified
        average_scores = {"loughran": 0, "harvard": 0, "vader": 0}
        
        return SentimentAnalyticsResponse(
            by_speaker=by_speaker[:20],  # Limit to top 20
            by_topic=by_topic[:20],
            by_date=by_date,
            distribution=distribution,
            average_scores=average_scores
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analytics error: {str(e)}")


@router.get("/topics", response_model=TopicAnalyticsResponse)
async def get_topic_analytics(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    speaker: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get topic analysis analytics
    """
    try:
        base_conditions = []
        if date_from or date_to:
            if date_from:
                base_conditions.append(Video.date >= date_from)
            if date_to:
                base_conditions.append(Video.date <= date_to)
        
        if speaker:
            base_conditions.append(TranscriptSegment.speaker_name.ilike(f"%{speaker}%"))
        
        # Simplified topic analytics - return basic structure
        topic_distribution = []
        topic_trends = []
        speaker_topics = []
        topic_sentiment = []
        
        return TopicAnalyticsResponse(
            topic_distribution=topic_distribution[:30],  # Top 30 topics
            topic_trends=topic_trends,
            speaker_topics=speaker_topics[:50],  # Top 50 speaker-topic pairs
            topic_sentiment=topic_sentiment[:30]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Topic analytics error: {str(e)}")


@router.get("/readability", response_model=ReadabilityAnalyticsResponse)
async def get_readability_analytics(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get readability metrics analytics
    """
    try:
        base_conditions = []
        if date_from or date_to:
            if date_from:
                base_conditions.append(Video.date >= date_from)
            if date_to:
                base_conditions.append(Video.date <= date_to)
        
        # Readability by speaker
        by_speaker_query = select(
            TranscriptSegment.speaker_name,
            func.avg(TranscriptSegment.flesch_kincaid_grade).label('avg_fk_grade'),
            func.avg(TranscriptSegment.flesch_reading_ease).label('avg_reading_ease'),
            func.avg(TranscriptSegment.gunning_fog_index).label('avg_fog_index'),
            func.count().label('segment_count')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            by_speaker_query = by_speaker_query.join(Video).where(*base_conditions)
        
        by_speaker_query = by_speaker_query.group_by(TranscriptSegment.speaker_name).order_by(desc('segment_count'))
        result = await db.execute(by_speaker_query)
        by_speaker = [
            {
                "speaker": row.speaker_name,
                "avg_fk_grade": float(row.avg_fk_grade) if row.avg_fk_grade else 0,
                "avg_reading_ease": float(row.avg_reading_ease) if row.avg_reading_ease else 0,
                "avg_fog_index": float(row.avg_fog_index) if row.avg_fog_index else 0,
                "segment_count": row.segment_count
            }
            for row in result
        ]
        
        # Readability by source
        by_source_query = select(
            Video.source,
            func.avg(TranscriptSegment.flesch_kincaid_grade).label('avg_fk_grade'),
            func.avg(TranscriptSegment.flesch_reading_ease).label('avg_reading_ease'),
            func.count().label('segment_count')
        ).select_from(TranscriptSegment).join(Video)
        
        if base_conditions:
            by_source_query = by_source_query.where(*base_conditions)
        
        by_source_query = by_source_query.group_by(Video.source).order_by(desc('segment_count'))
        result = await db.execute(by_source_query)
        by_source = [
            {
                "source": row.source,
                "avg_fk_grade": float(row.avg_fk_grade) if row.avg_fk_grade else 0,
                "avg_reading_ease": float(row.avg_reading_ease) if row.avg_reading_ease else 0,
                "segment_count": row.segment_count
            }
            for row in result if row.source
        ]
        
        # Distribution of readability grades - simplified
        distribution = {"elementary": 0, "middle_school": 0, "high_school": 0, "college": 0}
        
        # Average scores - simplified
        average_scores = {
            "flesch_kincaid_grade": 0,
            "flesch_reading_ease": 0,
            "gunning_fog_index": 0,
            "coleman_liau_index": 0
        }
        
        # Trends over time - simplified
        trends = []
        
        return ReadabilityAnalyticsResponse(
            by_speaker=by_speaker[:20],
            by_source=by_source,
            distribution=distribution,
            average_scores=average_scores,
            trends=trends
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Readability analytics error: {str(e)}")


@router.get("/moderation", response_model=ContentModerationAnalyticsResponse)
async def get_moderation_analytics(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    threshold: float = Query(0.5, description="Moderation score threshold"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get content moderation analytics
    """
    try:
        base_conditions = []
        if date_from or date_to:
            if date_from:
                base_conditions.append(Video.date >= date_from)
            if date_to:
                base_conditions.append(Video.date <= date_to)
        
        # Average scores by category
        by_category_query = select(
            func.avg(TranscriptSegment.moderation_harassment).label('harassment'),
            func.avg(TranscriptSegment.moderation_hate).label('hate'),
            func.avg(TranscriptSegment.moderation_self_harm).label('self_harm'),
            func.avg(TranscriptSegment.moderation_sexual).label('sexual'),
            func.avg(TranscriptSegment.moderation_violence).label('violence')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            by_category_query = by_category_query.join(Video).where(*base_conditions)
        
        result = await db.execute(by_category_query)
        category_result = result.first()
        by_category = [
            {"category": "harassment", "avg_score": float(category_result.harassment) if category_result.harassment else 0},
            {"category": "hate", "avg_score": float(category_result.hate) if category_result.hate else 0},
            {"category": "self_harm", "avg_score": float(category_result.self_harm) if category_result.self_harm else 0},
            {"category": "sexual", "avg_score": float(category_result.sexual) if category_result.sexual else 0},
            {"category": "violence", "avg_score": float(category_result.violence) if category_result.violence else 0}
        ]
        
        # High-risk segments
        high_risk_query = select(TranscriptSegment).options(
            selectinload(TranscriptSegment.video),
            selectinload(TranscriptSegment.speaker)
        ).where(TranscriptSegment.moderation_overall_score > threshold)
        
        if base_conditions:
            high_risk_query = high_risk_query.join(Video).where(*base_conditions)
        
        high_risk_query = high_risk_query.order_by(desc(TranscriptSegment.moderation_overall_score)).limit(20)
        result = await db.execute(high_risk_query)
        high_risk_segments = result.scalars().all()
        
        return ContentModerationAnalyticsResponse(
            by_category=by_category,
            by_speaker=[],  # Implement if needed
            by_source=[],   # Implement if needed
            high_risk_segments=high_risk_segments,
            trends=[]       # Implement if needed
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Moderation analytics error: {str(e)}")
