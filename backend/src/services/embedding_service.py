"""
Embedding generation service for semantic search
"""
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text, func, and_
from sqlalchemy.orm import selectinload

from ..models import TranscriptSegment
from ..config import settings

# Try to import sentence_transformers, fallback if not available
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    SentenceTransformer = None
    HAS_SENTENCE_TRANSFORMERS = False

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating and managing text embeddings for semantic search"""
    
    def __init__(self):
        self.model_name = "all-MiniLM-L6-v2"  # 384 dimensions, good balance of speed/quality
        self._model: Optional[SentenceTransformer] = None
        self.embedding_dim = 384
        
    def _load_model(self):
        """Lazy load the sentence transformer model"""
        if not HAS_SENTENCE_TRANSFORMERS:
            raise RuntimeError("sentence-transformers package not available. Please install it to use semantic search.")
        
        if self._model is None:
            logger.info(f"Loading embedding model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            logger.info("Embedding model loaded successfully")
        return self._model
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text
        
        Args:
            text: Input text to embed
            
        Returns:
            List of float values representing the embedding vector
        """
        if not HAS_SENTENCE_TRANSFORMERS:
            # Fallback: generate a simple hash-based embedding for testing
            return self._generate_simple_embedding(text)
            
        model = self._load_model()
        
        # Clean and prepare text
        cleaned_text = self._clean_text(text)
        
        # Generate embedding
        embedding = model.encode(cleaned_text, normalize_embeddings=True)
        
        # Convert to list for JSON serialization
        return embedding.tolist()
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batch (more efficient)
        
        Args:
            texts: List of input texts to embed
            
        Returns:
            List of embedding vectors
        """
        if not HAS_SENTENCE_TRANSFORMERS:
            # Fallback: generate simple embeddings for testing
            return [self._generate_simple_embedding(text) for text in texts]
            
        model = self._load_model()
        
        # Clean texts
        cleaned_texts = [self._clean_text(text) for text in texts]
        
        # Generate embeddings in batch
        embeddings = model.encode(cleaned_texts, normalize_embeddings=True, batch_size=32, show_progress_bar=True)
        
        # Convert to list of lists
        return [embedding.tolist() for embedding in embeddings]
    
    def _clean_text(self, text: str) -> str:
        """Clean and prepare text for embedding generation"""
        if not text:
            return ""
        
        # Basic text cleaning
        text = text.strip()
        
        # Remove excessive whitespace
        text = ' '.join(text.split())
        
        # Truncate if too long (model has 512 token limit)
        if len(text.split()) > 400:  # Leave some buffer for special tokens
            text = ' '.join(text.split()[:400])
            
        return text
    
    def _generate_simple_embedding(self, text: str) -> List[float]:
        """
        Generate a simple hash-based embedding for testing when sentence_transformers is not available
        """
        import hashlib
        import math
        
        # Clean text
        cleaned_text = self._clean_text(text)
        
        # Generate hash
        text_hash = hashlib.md5(cleaned_text.encode()).hexdigest()
        
        # Convert hash to vector (simple approach for testing)
        embedding = []
        for i in range(0, len(text_hash), 2):
            hex_val = int(text_hash[i:i+2], 16)
            # Normalize to [-1, 1] range
            normalized = (hex_val - 127.5) / 127.5
            embedding.append(normalized)
        
        # Pad or truncate to required dimensions
        while len(embedding) < self.embedding_dim:
            embedding.extend(embedding[:self.embedding_dim - len(embedding)])
        embedding = embedding[:self.embedding_dim]
        
        # Add some text length and word-based features for better similarity
        word_count = len(cleaned_text.split())
        char_count = len(cleaned_text)
        
        # Incorporate text statistics into the embedding
        if len(embedding) > 10:
            embedding[-1] = word_count / 100.0  # Normalize word count
            embedding[-2] = char_count / 1000.0  # Normalize char count
            embedding[-3] = len(set(cleaned_text.split())) / max(1, word_count)  # Unique word ratio
        
        return embedding
    
    def calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Calculate cosine similarity between two embeddings
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score (0-1, higher is more similar)
        """
        # Convert to numpy arrays
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Calculate cosine similarity
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return float(dot_product / (norm1 * norm2))
    
    async def generate_embeddings_for_segments(
        self, 
        db: AsyncSession, 
        segment_ids: Optional[List[int]] = None,
        batch_size: int = 100,
        force_regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Generate embeddings for transcript segments
        
        Args:
            db: Database session
            segment_ids: Optional list of specific segment IDs to process
            batch_size: Number of segments to process in each batch
            force_regenerate: Whether to regenerate embeddings for segments that already have them
            
        Returns:
            Dictionary with processing statistics
        """
        logger.info("Starting embedding generation for transcript segments")
        
        # Build query for segments that need embeddings
        query = select(TranscriptSegment)
        
        if segment_ids:
            query = query.where(TranscriptSegment.id.in_(segment_ids))
        elif not force_regenerate:
            query = query.where(TranscriptSegment.embedding_generated_at.is_(None))
            
        # Get total count
        count_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total_segments = count_result.scalar_one()
        
        if total_segments == 0:
            logger.info("No segments found that need embedding generation")
            return {"processed": 0, "total": 0, "errors": 0}
        
        logger.info(f"Found {total_segments} segments to process")
        
        processed = 0
        errors = 0
        
        # Process in batches
        offset = 0
        while offset < total_segments:
            try:
                # Get batch of segments
                batch_query = query.offset(offset).limit(batch_size)
                result = await db.execute(batch_query)
                segments = result.scalars().all()
                
                if not segments:
                    break
                
                # Extract texts for batch processing
                texts = [segment.transcript_text for segment in segments]
                segment_ids_batch = [segment.id for segment in segments]
                
                logger.info(f"Processing batch {offset//batch_size + 1}: {len(segments)} segments")
                
                # Generate embeddings in batch
                embeddings = self.generate_embeddings_batch(texts)
                
                # Update database with embeddings
                for segment_id, embedding in zip(segment_ids_batch, embeddings):
                    try:
                        # Convert embedding to JSON string for storage
                        embedding_json = json.dumps(embedding)
                        
                        # Update segment with embedding
                        await db.execute(
                            update(TranscriptSegment)
                            .where(TranscriptSegment.id == segment_id)
                            .values(
                                embedding=embedding_json,
                                embedding_generated_at=datetime.utcnow()
                            )
                        )
                        processed += 1
                        
                    except Exception as e:
                        logger.error(f"Error updating segment {segment_id} with embedding: {str(e)}")
                        errors += 1
                
                # Commit batch
                await db.commit()
                
                offset += batch_size
                
                # Progress logging
                if processed % 1000 == 0:
                    logger.info(f"Progress: {processed}/{total_segments} segments processed")
                    
            except Exception as e:
                logger.error(f"Error processing batch at offset {offset}: {str(e)}")
                errors += len(segments) if 'segments' in locals() else batch_size
                offset += batch_size
                await db.rollback()
        
        logger.info(f"Embedding generation completed. Processed: {processed}, Errors: {errors}")
        
        return {
            "processed": processed,
            "total": total_segments,
            "errors": errors,
            "model_name": self.model_name,
            "embedding_dimensions": self.embedding_dim
        }
    
    async def semantic_search(
        self,
        db: AsyncSession,
        query_text: str,
        limit: int = 50,
        similarity_threshold: float = 0.5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search using vector similarity
        
        Args:
            db: Database session
            query_text: Search query text
            limit: Maximum number of results to return
            similarity_threshold: Minimum similarity score to include in results
            filters: Additional filters to apply (speaker, date range, etc.)
            
        Returns:
            List of search results with similarity scores
        """
        # Generate embedding for query
        query_embedding = self.generate_embedding(query_text)
        query_vector_str = json.dumps(query_embedding)
        
        # Get all segments with embeddings (fallback to manual similarity calculation)
        # Since we don't have pgvector, we'll fetch segments and compute similarity in Python
        segments_query = select(TranscriptSegment).where(
            TranscriptSegment.embedding.is_not(None)
        )
        
        # Add basic filters
        filter_conditions = []
        if filters:
            if filters.get("speaker"):
                filter_conditions.append(TranscriptSegment.speaker_name.ilike(f"%{filters['speaker']}%"))
            if filters.get("min_date") or filters.get("max_date"):
                # We'll handle date filters after joining with videos
                pass
        
        if filter_conditions:
            segments_query = segments_query.where(and_(*filter_conditions))
        
        # Fetch segments - limit to reasonable amount for performance
        segments_query = segments_query.limit(min(1000, limit * 5))  # Get more candidates
        result = await db.execute(segments_query)
        segments = result.scalars().all()
        
        # Calculate similarities and filter
        results = []
        for segment in segments:
            try:
                # Parse embedding from JSON
                segment_embedding = json.loads(segment.embedding)
                
                # Calculate similarity
                similarity = self.calculate_similarity(query_embedding, segment_embedding)
                
                if similarity >= similarity_threshold:
                    segment_dict = {
                        "id": segment.id,
                        "segment_id": segment.segment_id,
                        "speaker_name": segment.speaker_name,
                        "transcript_text": segment.transcript_text,
                        "video_id": segment.video_id,
                        "video_seconds": segment.video_seconds,
                        "timestamp_start": segment.timestamp_start,
                        "timestamp_end": segment.timestamp_end,
                        "similarity_score": similarity,
                        "sentiment_loughran_score": segment.sentiment_loughran_score,
                        "stresslens_score": segment.stresslens_score
                    }
                    results.append(segment_dict)
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                logger.warning(f"Error parsing embedding for segment {segment.id}: {str(e)}")
                continue
        
        # Sort by similarity (highest first) and limit results
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        results = results[:limit]
        
        logger.info(f"Semantic search for '{query_text}' returned {len(results)} results")
        
        return results


# Global embedding service instance
embedding_service = EmbeddingService()