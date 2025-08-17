-- Migration: Add video_summaries table for caching AI-generated summaries
-- Date: 2024-08-17
-- Description: Creates table to store cached video summaries to avoid regenerating

CREATE TABLE IF NOT EXISTS video_summaries (
    id SERIAL PRIMARY KEY,
    video_id INTEGER UNIQUE NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    
    -- Summary content
    summary_text TEXT NOT NULL,
    bullet_points INTEGER NOT NULL,
    
    -- Generation parameters (for cache validation)
    provider VARCHAR(50) NOT NULL,  -- openai, openrouter
    model VARCHAR(100) NOT NULL,    -- model name/id used
    custom_prompt TEXT,
    
    -- Generation metadata
    summary_metadata JSONB,
    
    -- Timestamps
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id ON video_summaries(video_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_provider_model ON video_summaries(provider, model);
CREATE INDEX IF NOT EXISTS idx_video_summaries_generated_at ON video_summaries(generated_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_video_summaries_updated_at
    BEFORE UPDATE ON video_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_video_summaries_updated_at();