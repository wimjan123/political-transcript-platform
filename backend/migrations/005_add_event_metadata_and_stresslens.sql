-- Migration 005: Add event metadata fields and stresslens analytics
-- This migration adds new fields for event metadata and stress analysis

-- Add event metadata fields to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS format VARCHAR(100);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS candidate VARCHAR(200);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS place VARCHAR(300);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS record_type VARCHAR(100);

-- Add stresslens analytics fields to transcript_segments table
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS stresslens_score FLOAT;
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS stresslens_rank INTEGER;

-- Add moderation flag fields to transcript_segments table
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS moderation_harassment_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS moderation_hate_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS moderation_violence_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS moderation_sexual_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS moderation_selfharm_flag BOOLEAN DEFAULT FALSE;

-- Create indexes for better query performance on new fields
CREATE INDEX IF NOT EXISTS idx_videos_format ON videos(format);
CREATE INDEX IF NOT EXISTS idx_videos_candidate ON videos(candidate);
CREATE INDEX IF NOT EXISTS idx_videos_place ON videos(place);
CREATE INDEX IF NOT EXISTS idx_videos_record_type ON videos(record_type);

CREATE INDEX IF NOT EXISTS idx_segments_stresslens_score ON transcript_segments(stresslens_score);
CREATE INDEX IF NOT EXISTS idx_segments_stresslens_rank ON transcript_segments(stresslens_rank);

CREATE INDEX IF NOT EXISTS idx_segments_moderation_flags ON transcript_segments(
    moderation_harassment_flag, 
    moderation_hate_flag, 
    moderation_violence_flag, 
    moderation_sexual_flag, 
    moderation_selfharm_flag
);

-- Update moderation flags based on existing scores (threshold: 0.3)
UPDATE transcript_segments 
SET moderation_harassment_flag = CASE WHEN moderation_harassment >= 0.3 THEN TRUE ELSE FALSE END
WHERE moderation_harassment IS NOT NULL;

UPDATE transcript_segments 
SET moderation_hate_flag = CASE WHEN moderation_hate >= 0.3 THEN TRUE ELSE FALSE END
WHERE moderation_hate IS NOT NULL;

UPDATE transcript_segments 
SET moderation_violence_flag = CASE WHEN moderation_violence >= 0.3 THEN TRUE ELSE FALSE END
WHERE moderation_violence IS NOT NULL;

UPDATE transcript_segments 
SET moderation_sexual_flag = CASE WHEN moderation_sexual >= 0.3 THEN TRUE ELSE FALSE END
WHERE moderation_sexual IS NOT NULL;

UPDATE transcript_segments 
SET moderation_selfharm_flag = CASE WHEN moderation_self_harm >= 0.3 THEN TRUE ELSE FALSE END
WHERE moderation_self_harm IS NOT NULL;

-- Create a composite index for efficient event metadata queries
CREATE INDEX IF NOT EXISTS idx_videos_event_metadata ON videos(format, candidate, record_type, date);

-- Create a composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_segments_analytics ON transcript_segments(
    stresslens_score, 
    sentiment_loughran_score, 
    flesch_kincaid_grade
);