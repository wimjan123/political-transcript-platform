-- Migration: Make video_seconds nullable in transcript_segments table
-- This allows importing transcript files that don't have timing information

ALTER TABLE transcript_segments 
ALTER COLUMN video_seconds DROP NOT NULL;