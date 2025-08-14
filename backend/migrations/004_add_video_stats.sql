-- Add statistics fields to videos table
-- Migration: 004_add_video_stats

ALTER TABLE videos 
ADD COLUMN total_words INTEGER DEFAULT 0,
ADD COLUMN total_characters INTEGER DEFAULT 0,
ADD COLUMN total_segments INTEGER DEFAULT 0;

-- Update the existing records with calculated values
UPDATE videos SET 
  total_segments = (SELECT COUNT(*) FROM transcript_segments WHERE video_id = videos.id),
  total_words = (SELECT COALESCE(SUM(LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1), 0) FROM transcript_segments WHERE video_id = videos.id AND content IS NOT NULL AND content != ''),
  total_characters = (SELECT COALESCE(SUM(LENGTH(content)), 0) FROM transcript_segments WHERE video_id = videos.id AND content IS NOT NULL);

-- Create indexes for the new fields
CREATE INDEX idx_videos_total_words ON videos(total_words);
CREATE INDEX idx_videos_total_segments ON videos(total_segments);