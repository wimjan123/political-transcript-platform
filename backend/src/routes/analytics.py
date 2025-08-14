"""
Analytics endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, text
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
        # Base query with date filters
        base_conditions = []
        if date_from or date_to:
            if date_from:
                base_conditions.append(Video.date >= date_from)
            if date_to:
                base_conditions.append(Video.date <= date_to)
        
        # Total videos
        video_query = select(func.count(Video.id))
        if base_conditions:
            video_query = video_query.where(*base_conditions)
        result = await db.execute(video_query)
        total_videos = result.scalar_one()
        
        # Total segments
        segment_query = select(func.count(TranscriptSegment.id))
        if base_conditions:
            segment_query = segment_query.join(Video).where(*base_conditions)
        result = await db.execute(segment_query)
        total_segments = result.scalar_one()
        
        # Total speakers
        speaker_query = select(func.count(Speaker.id))
        result = await db.execute(speaker_query)
        total_speakers = result.scalar_one()
        
        # Total topics
        topic_query = select(func.count(Topic.id))
        result = await db.execute(topic_query)
        total_topics = result.scalar_one()
        
        # Date range
        date_range_query = select(
            func.min(Video.date).label('min_date'),
            func.max(Video.date).label('max_date')
        )
        if base_conditions:
            date_range_query = date_range_query.where(*base_conditions)
        result = await db.execute(date_range_query)
        date_range_result = result.first()
        
        # Top speakers by segment count
        top_speakers_query = select(
            Speaker.name,
            func.count(TranscriptSegment.id).label('segment_count'),
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment')
        ).join(TranscriptSegment)
        
        if base_conditions:
            top_speakers_query = top_speakers_query.join(Video).where(*base_conditions)
        
        top_speakers_query = top_speakers_query.group_by(Speaker.id, Speaker.name).order_by(desc('segment_count')).limit(10)
        result = await db.execute(top_speakers_query)
        top_speakers = [
            {
                "name": row.name,
                "segment_count": row.segment_count,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0
            }
            for row in result
        ]
        
        # Top topics by frequency
        top_topics_query = select(
            Topic.name,
            func.count(SegmentTopic.id).label('frequency'),
            func.avg(SegmentTopic.score).label('avg_score')
        ).join(SegmentTopic).join(TranscriptSegment)
        
        if base_conditions:
            top_topics_query = top_topics_query.join(Video).where(*base_conditions)
        
        top_topics_query = top_topics_query.group_by(Topic.id, Topic.name).order_by(desc('frequency')).limit(10)
        result = await db.execute(top_topics_query)
        top_topics = [
            {
                "name": row.name,
                "frequency": row.frequency,
                "avg_score": float(row.avg_score) if row.avg_score else 0
            }
            for row in result
        ]
        
        # Sentiment distribution
        sentiment_query = select(
            func.case(
                (TranscriptSegment.sentiment_loughran_score > 0, 'positive'),
                (TranscriptSegment.sentiment_loughran_score < 0, 'negative'),
                else_='neutral'
            ).label('sentiment'),
            func.count().label('count')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            sentiment_query = sentiment_query.join(Video).where(*base_conditions)
        
        sentiment_query = sentiment_query.group_by('sentiment')
        result = await db.execute(sentiment_query)
        sentiment_distribution = {row.sentiment: row.count for row in result}
        
        return AnalyticsStatsResponse(
            total_videos=total_videos,
            total_segments=total_segments,
            total_speakers=total_speakers,
            total_topics=total_topics,
            date_range={
                "min_date": date_range_result.min_date,
                "max_date": date_range_result.max_date
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
        
        # Sentiment by speaker
        by_speaker_query = select(
            TranscriptSegment.speaker_name,
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment'),
            func.count().label('segment_count'),
            func.stddev(TranscriptSegment.sentiment_loughran_score).label('sentiment_stddev')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            by_speaker_query = by_speaker_query.join(Video).where(*base_conditions)
        
        by_speaker_query = by_speaker_query.group_by(TranscriptSegment.speaker_name).order_by(desc('segment_count'))
        result = await db.execute(by_speaker_query)
        by_speaker = [
            {
                "speaker": row.speaker_name,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0,
                "segment_count": row.segment_count,
                "sentiment_stddev": float(row.sentiment_stddev) if row.sentiment_stddev else 0
            }
            for row in result
        ]
        
        # Sentiment by topic
        by_topic_query = select(
            Topic.name,
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment'),
            func.count().label('segment_count')
        ).select_from(TranscriptSegment).join(SegmentTopic).join(Topic)
        
        if base_conditions:
            by_topic_query = by_topic_query.join(Video).where(*base_conditions)
        
        if topic:
            by_topic_query = by_topic_query.where(Topic.name.ilike(f"%{topic}%"))
        
        by_topic_query = by_topic_query.group_by(Topic.name).order_by(desc('segment_count'))
        result = await db.execute(by_topic_query)
        by_topic = [
            {
                "topic": row.name,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0,
                "segment_count": row.segment_count
            }
            for row in result
        ]
        
        # Sentiment by date (daily aggregation)
        by_date_query = select(
            Video.date,
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment'),
            func.count().label('segment_count')
        ).select_from(TranscriptSegment).join(Video)
        
        if base_conditions:
            by_date_query = by_date_query.where(*base_conditions)
        
        by_date_query = by_date_query.group_by(Video.date).order_by(Video.date)
        result = await db.execute(by_date_query)
        by_date = [
            {
                "date": row.date.isoformat() if row.date else None,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0,
                "segment_count": row.segment_count
            }
            for row in result if row.date
        ]
        
        # Sentiment distribution
        distribution_query = select(
            func.case(
                (TranscriptSegment.sentiment_loughran_score > 0.1, 'positive'),
                (TranscriptSegment.sentiment_loughran_score < -0.1, 'negative'),
                else_='neutral'
            ).label('sentiment'),
            func.count().label('count')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            distribution_query = distribution_query.join(Video).where(*base_conditions)
        
        distribution_query = distribution_query.group_by('sentiment')
        result = await db.execute(distribution_query)
        distribution = {row.sentiment: row.count for row in result}
        
        # Average scores across algorithms
        avg_scores_query = select(
            func.avg(TranscriptSegment.sentiment_loughran_score).label('loughran'),
            func.avg(TranscriptSegment.sentiment_harvard_score).label('harvard'),
            func.avg(TranscriptSegment.sentiment_vader_score).label('vader')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            avg_scores_query = avg_scores_query.join(Video).where(*base_conditions)
        
        result = await db.execute(avg_scores_query)
        avg_result = result.first()
        average_scores = {
            "loughran": float(avg_result.loughran) if avg_result.loughran else 0,
            "harvard": float(avg_result.harvard) if avg_result.harvard else 0,
            "vader": float(avg_result.vader) if avg_result.vader else 0
        }
        
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
        
        # Topic distribution
        topic_dist_query = select(
            Topic.name,
            Topic.category,
            func.count(SegmentTopic.id).label('frequency'),
            func.avg(SegmentTopic.score).label('avg_score'),
            func.max(SegmentTopic.score).label('max_score')
        ).select_from(Topic).join(SegmentTopic).join(TranscriptSegment)
        
        if base_conditions:
            topic_dist_query = topic_dist_query.join(Video).where(*base_conditions)
        
        topic_dist_query = topic_dist_query.group_by(Topic.id, Topic.name, Topic.category).order_by(desc('frequency'))
        result = await db.execute(topic_dist_query)
        topic_distribution = [
            {
                "topic": row.name,
                "category": row.category,
                "frequency": row.frequency,
                "avg_score": float(row.avg_score) if row.avg_score else 0,
                "max_score": float(row.max_score) if row.max_score else 0
            }
            for row in result
        ]
        
        # Topic trends over time
        topic_trends_query = select(
            Video.date,
            Topic.name,
            func.count(SegmentTopic.id).label('frequency'),
            func.avg(SegmentTopic.score).label('avg_score')
        ).select_from(TranscriptSegment).join(Video).join(SegmentTopic).join(Topic)
        
        if base_conditions:
            topic_trends_query = topic_trends_query.where(*base_conditions)
        
        topic_trends_query = topic_trends_query.group_by(Video.date, Topic.name).order_by(Video.date, desc('frequency'))
        result = await db.execute(topic_trends_query)
        topic_trends = [
            {
                "date": row.date.isoformat() if row.date else None,
                "topic": row.name,
                "frequency": row.frequency,
                "avg_score": float(row.avg_score) if row.avg_score else 0
            }
            for row in result if row.date
        ]
        
        # Speaker-topic associations
        speaker_topics_query = select(
            TranscriptSegment.speaker_name,
            Topic.name,
            func.count(SegmentTopic.id).label('frequency'),
            func.avg(SegmentTopic.score).label('avg_score')
        ).select_from(TranscriptSegment).join(SegmentTopic).join(Topic)
        
        if base_conditions:
            speaker_topics_query = speaker_topics_query.join(Video).where(*base_conditions)
        
        speaker_topics_query = speaker_topics_query.group_by(TranscriptSegment.speaker_name, Topic.name).order_by(desc('frequency'))
        result = await db.execute(speaker_topics_query)
        speaker_topics = [
            {
                "speaker": row.speaker_name,
                "topic": row.name,
                "frequency": row.frequency,
                "avg_score": float(row.avg_score) if row.avg_score else 0
            }
            for row in result
        ]
        
        # Topic sentiment correlation
        topic_sentiment_query = select(
            Topic.name,
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment'),
            func.count().label('segment_count'),
            func.avg(SegmentTopic.score).label('avg_topic_score')
        ).select_from(TranscriptSegment).join(SegmentTopic).join(Topic)
        
        if base_conditions:
            topic_sentiment_query = topic_sentiment_query.join(Video).where(*base_conditions)
        
        topic_sentiment_query = topic_sentiment_query.group_by(Topic.name).order_by(desc('segment_count'))
        result = await db.execute(topic_sentiment_query)
        topic_sentiment = [
            {
                "topic": row.name,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0,
                "segment_count": row.segment_count,
                "avg_topic_score": float(row.avg_topic_score) if row.avg_topic_score else 0
            }
            for row in result
        ]
        
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
        
        # Distribution of readability grades
        distribution_query = select(
            func.case(
                (TranscriptSegment.flesch_kincaid_grade <= 6, 'elementary'),
                (TranscriptSegment.flesch_kincaid_grade <= 9, 'middle_school'),
                (TranscriptSegment.flesch_kincaid_grade <= 12, 'high_school'),
                else_='college'
            ).label('grade_level'),
            func.count().label('count')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            distribution_query = distribution_query.join(Video).where(*base_conditions)
        
        distribution_query = distribution_query.group_by('grade_level')
        result = await db.execute(distribution_query)
        distribution = {row.grade_level: row.count for row in result}
        
        # Average scores
        avg_scores_query = select(
            func.avg(TranscriptSegment.flesch_kincaid_grade).label('flesch_kincaid'),
            func.avg(TranscriptSegment.flesch_reading_ease).label('reading_ease'),
            func.avg(TranscriptSegment.gunning_fog_index).label('gunning_fog'),
            func.avg(TranscriptSegment.coleman_liau_index).label('coleman_liau')
        ).select_from(TranscriptSegment)
        
        if base_conditions:
            avg_scores_query = avg_scores_query.join(Video).where(*base_conditions)
        
        result = await db.execute(avg_scores_query)
        avg_result = result.first()
        average_scores = {
            "flesch_kincaid_grade": float(avg_result.flesch_kincaid) if avg_result.flesch_kincaid else 0,
            "flesch_reading_ease": float(avg_result.reading_ease) if avg_result.reading_ease else 0,
            "gunning_fog_index": float(avg_result.gunning_fog) if avg_result.gunning_fog else 0,
            "coleman_liau_index": float(avg_result.coleman_liau) if avg_result.coleman_liau else 0
        }
        
        # Trends over time
        trends_query = select(
            Video.date,
            func.avg(TranscriptSegment.flesch_kincaid_grade).label('avg_fk_grade'),
            func.avg(TranscriptSegment.flesch_reading_ease).label('avg_reading_ease'),
            func.count().label('segment_count')
        ).select_from(TranscriptSegment).join(Video)
        
        if base_conditions:
            trends_query = trends_query.where(*base_conditions)
        
        trends_query = trends_query.group_by(Video.date).order_by(Video.date)
        result = await db.execute(trends_query)
        trends = [
            {
                "date": row.date.isoformat() if row.date else None,
                "avg_fk_grade": float(row.avg_fk_grade) if row.avg_fk_grade else 0,
                "avg_reading_ease": float(row.avg_reading_ease) if row.avg_reading_ease else 0,
                "segment_count": row.segment_count
            }
            for row in result if row.date
        ]
        
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