-- Migration: Add emotion and heat score columns to transcript_segments
-- Date: 2025-01-27

-- Add emotion analysis columns
ALTER TABLE transcript_segments
  ADD COLUMN IF NOT EXISTS emotion_label TEXT,
  ADD COLUMN IF NOT EXISTS emotion_intensity SMALLINT,
  ADD COLUMN IF NOT EXISTS heat_score REAL,
  ADD COLUMN IF NOT EXISTS heat_components JSONB;

-- Create indexes for the new columns for better query performance
CREATE INDEX IF NOT EXISTS idx_segment_emotion ON transcript_segments(emotion_label, emotion_intensity);
CREATE INDEX IF NOT EXISTS idx_segment_heat_score ON transcript_segments(heat_score);

-- Add comments for documentation
COMMENT ON COLUMN transcript_segments.emotion_label IS 'Primary emotion detected in the segment (e.g., anger, joy, fear, sadness)';
COMMENT ON COLUMN transcript_segments.emotion_intensity IS 'Intensity of the emotion on a scale (e.g., 1-10)';
COMMENT ON COLUMN transcript_segments.heat_score IS 'Composite heat score indicating controversial or inflammatory content';
COMMENT ON COLUMN transcript_segments.heat_components IS 'JSON object containing breakdown of heat score components (e.g., {"aggression": 0.8, "controversy": 0.6})';