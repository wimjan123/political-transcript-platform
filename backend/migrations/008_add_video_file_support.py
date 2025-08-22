"""
Add video file support fields to Video model

This migration adds fields to support local video files (AVI/MP4) with SRT subtitles
and transcoding capabilities.
"""

import os
from sqlalchemy import text, create_engine

# Get database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5433/political_transcripts')
engine = create_engine(DATABASE_URL)

def upgrade():
    """Add video file support fields to videos table"""
    
    with engine.connect() as connection:
        # Add video file fields
        connection.execute(text("""
            ALTER TABLE videos 
            ADD COLUMN video_file_path VARCHAR(500),
            ADD COLUMN srt_file_path VARCHAR(500),
            ADD COLUMN video_format VARCHAR(10),
            ADD COLUMN video_file_size INTEGER,
            ADD COLUMN video_duration_seconds FLOAT,
            ADD COLUMN video_resolution VARCHAR(20),
            ADD COLUMN video_fps FLOAT,
            ADD COLUMN video_bitrate INTEGER
        """))
        
        # Add transcoding fields
        connection.execute(text("""
            ALTER TABLE videos
            ADD COLUMN transcoding_status VARCHAR(20) DEFAULT 'pending',
            ADD COLUMN transcoded_file_path VARCHAR(500),
            ADD COLUMN transcoding_started_at TIMESTAMP,
            ADD COLUMN transcoding_completed_at TIMESTAMP,
            ADD COLUMN transcoding_error TEXT
        """))
        
        # Create indexes for video file fields
        connection.execute(text("CREATE INDEX idx_video_file_path ON videos (video_file_path)"))
        connection.execute(text("CREATE INDEX idx_video_transcoding_status ON videos (transcoding_status)"))
        connection.execute(text("CREATE INDEX idx_video_format ON videos (video_format)"))
        connection.execute(text("CREATE INDEX idx_video_file_metadata ON videos (video_format, transcoding_status, created_at)"))
        
        connection.commit()

def downgrade():
    """Remove video file support fields from videos table"""
    
    with engine.connect() as connection:
        # Drop indexes
        connection.execute(text("DROP INDEX IF EXISTS idx_video_file_metadata"))
        connection.execute(text("DROP INDEX IF EXISTS idx_video_format"))
        connection.execute(text("DROP INDEX IF EXISTS idx_video_transcoding_status"))
        connection.execute(text("DROP INDEX IF EXISTS idx_video_file_path"))
        
        # Remove video file fields
        connection.execute(text("""
            ALTER TABLE videos 
            DROP COLUMN IF EXISTS video_file_path,
            DROP COLUMN IF EXISTS srt_file_path,
            DROP COLUMN IF EXISTS video_format,
            DROP COLUMN IF EXISTS video_file_size,
            DROP COLUMN IF EXISTS video_duration_seconds,
            DROP COLUMN IF EXISTS video_resolution,
            DROP COLUMN IF EXISTS video_fps,
            DROP COLUMN IF EXISTS video_bitrate
        """))
        
        # Remove transcoding fields
        connection.execute(text("""
            ALTER TABLE videos
            DROP COLUMN IF EXISTS transcoding_status,
            DROP COLUMN IF EXISTS transcoded_file_path,
            DROP COLUMN IF EXISTS transcoding_started_at,
            DROP COLUMN IF EXISTS transcoding_completed_at,
            DROP COLUMN IF EXISTS transcoding_error
        """))
        
        connection.commit()

if __name__ == "__main__":
    upgrade()
    print("Migration 008_add_video_file_support.py completed successfully")