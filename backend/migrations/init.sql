-- Database initialization script for Political Transcript Search Platform

-- Create extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Enable full-text search configuration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'english_unaccent') THEN
        CREATE TEXT SEARCH CONFIGURATION english_unaccent (COPY = english);
        ALTER TEXT SEARCH CONFIGURATION english_unaccent
          ALTER MAPPING FOR word, asciiword WITH unaccent, english_stem;
    END IF;
END
$$;

-- Create custom functions for better search
CREATE OR REPLACE FUNCTION normalize_text(text) RETURNS text AS $$
BEGIN
    RETURN lower(unaccent($1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Performance optimization functions (will be used after tables are created)
CREATE OR REPLACE FUNCTION update_speaker_stats() RETURNS void AS $$
BEGIN
    -- Check if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'speakers') THEN
        UPDATE speakers 
        SET 
            total_segments = stats.segment_count,
            total_words = stats.word_count,
            avg_sentiment = stats.avg_sentiment
        FROM (
            SELECT 
                speaker_id,
                COUNT(*) as segment_count,
                COALESCE(SUM(word_count), 0) as word_count,
                AVG(sentiment_loughran_score) as avg_sentiment
            FROM transcript_segments 
            WHERE speaker_id IS NOT NULL
            GROUP BY speaker_id
        ) stats
        WHERE speakers.id = stats.speaker_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_topic_stats() RETURNS void AS $$
BEGIN
    -- Check if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'topics') THEN
        UPDATE topics 
        SET 
            total_segments = stats.segment_count,
            avg_score = stats.avg_score
        FROM (
            SELECT 
                topic_id,
                COUNT(*) as segment_count,
                AVG(score) as avg_score
            FROM segment_topics
            GROUP BY topic_id
        ) stats
        WHERE topics.id = stats.topic_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh analytics (will create materialized view later)
CREATE OR REPLACE FUNCTION refresh_analytics() RETURNS void AS $$
BEGIN
    -- Will be implemented after tables are created
    PERFORM update_speaker_stats();
    PERFORM update_topic_stats();
END;
$$ LANGUAGE plpgsql;

COMMIT;