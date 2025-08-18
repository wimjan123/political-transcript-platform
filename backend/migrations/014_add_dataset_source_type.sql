-- Add dataset and source_type to videos and backfill
ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS dataset VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_video_dataset ON videos(dataset);
CREATE INDEX IF NOT EXISTS idx_video_source_type ON videos(source_type);

-- Backfill existing HTML-imported records as trump/html
UPDATE videos
SET dataset = COALESCE(dataset, 'trump'),
    source_type = COALESCE(source_type, 'html');

