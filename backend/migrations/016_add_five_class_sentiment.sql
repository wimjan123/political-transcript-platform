-- Migration: Add 5-class sentiment analysis columns to transcript_segments
-- Date: 2025-08-25

-- Add 5-class sentiment columns
ALTER TABLE transcript_segments
  ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_vneg_prob REAL,
  ADD COLUMN IF NOT EXISTS sentiment_neg_prob REAL,
  ADD COLUMN IF NOT EXISTS sentiment_neu_prob REAL,
  ADD COLUMN IF NOT EXISTS sentiment_pos_prob REAL,
  ADD COLUMN IF NOT EXISTS sentiment_vpos_prob REAL;

-- Create index for sentiment label for filtering
CREATE INDEX IF NOT EXISTS idx_segments_sentiment_label ON transcript_segments(sentiment_label);

-- Add comments for documentation
COMMENT ON COLUMN transcript_segments.sentiment_label IS '5-class sentiment label: Very Negative, Negative, Neutral, Positive, Very Positive';
COMMENT ON COLUMN transcript_segments.sentiment_vneg_prob IS 'Probability of Very Negative sentiment (0.0-1.0)';
COMMENT ON COLUMN transcript_segments.sentiment_neg_prob IS 'Probability of Negative sentiment (0.0-1.0)';
COMMENT ON COLUMN transcript_segments.sentiment_neu_prob IS 'Probability of Neutral sentiment (0.0-1.0)';
COMMENT ON COLUMN transcript_segments.sentiment_pos_prob IS 'Probability of Positive sentiment (0.0-1.0)';
COMMENT ON COLUMN transcript_segments.sentiment_vpos_prob IS 'Probability of Very Positive sentiment (0.0-1.0)';