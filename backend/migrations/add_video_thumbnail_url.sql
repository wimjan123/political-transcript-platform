-- Migration: Add video_thumbnail_url to videos table
-- This allows storing video thumbnail URLs extracted from transcript HTML

ALTER TABLE videos 
ADD COLUMN video_thumbnail_url VARCHAR(500);