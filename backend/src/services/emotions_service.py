"""
Service functions for emotion analytics operations
"""
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Tuple, Dict, Any
import logging

from ..models import TranscriptSegment
from ..schemas import EmotionItemIn

logger = logging.getLogger(__name__)


async def upsert_emotions(
    db: AsyncSession, 
    items: List[EmotionItemIn]
) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Batch upsert emotion data for transcript segments
    
    Args:
        db: Database session
        items: List of emotion items to process
    
    Returns:
        Tuple of (updated_count, errors_list)
    """
    updated = 0
    errors = []
    
    try:
        for item in items:
            try:
                # Fetch the segment
                segment = await db.get(TranscriptSegment, item.segment_id)
                if not segment:
                    errors.append({
                        "segment_id": item.segment_id,
                        "error": "segment_not_found",
                        "message": f"Segment {item.segment_id} does not exist"
                    })
                    continue
                
                # Update emotion fields
                segment.emotion_label = item.emotion_label
                segment.emotion_intensity = item.emotion_intensity
                
                if item.heat_score is not None:
                    segment.heat_score = item.heat_score
                
                if item.heat_components is not None:
                    segment.heat_components = item.heat_components
                
                updated += 1
                
            except Exception as e:
                logger.error(f"Error updating segment {item.segment_id}: {str(e)}")
                errors.append({
                    "segment_id": item.segment_id,
                    "error": "update_failed",
                    "message": str(e)
                })
        
        # Commit all changes in a single transaction
        await db.commit()
        
        logger.info(f"Successfully updated {updated} segments with emotion data")
        
    except Exception as e:
        # Rollback on any transaction-level error
        await db.rollback()
        logger.error(f"Transaction failed during emotion upsert: {str(e)}")
        raise e
    
    return updated, errors


async def get_emotion_statistics(db: AsyncSession) -> Dict[str, Any]:
    """
    Get statistics about emotion annotations in the database
    
    Args:
        db: Database session
    
    Returns:
        Dictionary containing emotion statistics
    """
    from sqlalchemy import select, func, distinct
    
    # Count segments with emotion data
    total_with_emotions = await db.scalar(
        select(func.count(TranscriptSegment.id))
        .where(TranscriptSegment.emotion_label.isnot(None))
    )
    
    # Count unique emotion labels
    unique_emotions = await db.scalar(
        select(func.count(distinct(TranscriptSegment.emotion_label)))
        .where(TranscriptSegment.emotion_label.isnot(None))
    )
    
    # Average emotion intensity
    avg_intensity = await db.scalar(
        select(func.avg(TranscriptSegment.emotion_intensity))
        .where(TranscriptSegment.emotion_intensity.isnot(None))
    )
    
    # Average heat score  
    avg_heat_score = await db.scalar(
        select(func.avg(TranscriptSegment.heat_score))
        .where(TranscriptSegment.heat_score.isnot(None))
    )
    
    # Count segments with heat scores
    total_with_heat = await db.scalar(
        select(func.count(TranscriptSegment.id))
        .where(TranscriptSegment.heat_score.isnot(None))
    )
    
    return {
        "total_segments_with_emotions": total_with_emotions,
        "unique_emotion_labels": unique_emotions,
        "average_emotion_intensity": float(avg_intensity) if avg_intensity else 0.0,
        "total_segments_with_heat_scores": total_with_heat,
        "average_heat_score": float(avg_heat_score) if avg_heat_score else 0.0
    }