-- Migration: Add vector embeddings for semantic search
-- This adds pgvector extension and embedding columns to transcript_segments table

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector embedding column to transcript_segments table
-- Using 384 dimensions for all-MiniLM-L6-v2 model
ALTER TABLE transcript_segments 
ADD COLUMN embedding vector(384);

-- Create index for vector similarity search (HNSW index for better performance)
CREATE INDEX idx_transcript_segments_embedding ON transcript_segments 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add a flag to track which segments have embeddings generated
ALTER TABLE transcript_segments 
ADD COLUMN embedding_generated_at TIMESTAMP DEFAULT NULL;

-- Create index for efficiently finding segments that need embeddings
CREATE INDEX idx_transcript_segments_embedding_generated 
ON transcript_segments (embedding_generated_at) 
WHERE embedding_generated_at IS NULL;