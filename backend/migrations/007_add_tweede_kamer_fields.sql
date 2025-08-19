-- Migration to add Tweede Kamer specific fields to transcript_segments
-- Add speaker_party and segment_type fields

ALTER TABLE transcript_segments 
ADD COLUMN speaker_party VARCHAR(20) NULL,
ADD COLUMN segment_type VARCHAR(20) DEFAULT 'spoken' NOT NULL;

-- Add indexes for new fields
CREATE INDEX idx_transcript_segments_speaker_party ON transcript_segments(speaker_party);
CREATE INDEX idx_transcript_segments_segment_type ON transcript_segments(segment_type);

-- Update existing segments to have default segment_type
UPDATE transcript_segments SET segment_type = 'spoken' WHERE segment_type IS NULL;