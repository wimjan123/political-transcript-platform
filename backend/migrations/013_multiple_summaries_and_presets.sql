-- Migration 013: Add support for multiple summaries per video and summary presets
-- This migration removes the unique constraint on video_id in video_summaries
-- and adds a new summary_presets table for custom instructions

BEGIN;

-- Remove unique constraint on video_id to allow multiple summaries per video
ALTER TABLE video_summaries DROP CONSTRAINT IF EXISTS video_summaries_video_id_key;

-- Add name field to video_summaries for identifying different summary types
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT 'Default Summary';

-- Add preset_id to link summaries to presets (nullable for backward compatibility)
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS preset_id INTEGER;

-- Create summary_presets table for storing custom instruction templates
CREATE TABLE IF NOT EXISTS summary_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    custom_prompt TEXT NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
    model VARCHAR(100) NOT NULL DEFAULT 'deepseek/deepseek-chat-v3-0324:free',
    bullet_points INTEGER NOT NULL DEFAULT 4,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint for preset_id
ALTER TABLE video_summaries ADD CONSTRAINT fk_video_summaries_preset 
    FOREIGN KEY (preset_id) REFERENCES summary_presets(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_preset ON video_summaries(video_id, preset_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_name ON video_summaries(name);
CREATE INDEX IF NOT EXISTS idx_summary_presets_default ON summary_presets(is_default);

-- Insert default preset
INSERT INTO summary_presets (name, description, custom_prompt, is_default) 
VALUES (
    'Default Summary',
    'Standard objective summary focusing on key political points and policy positions',
    'Provide a clear, objective summary of the key points discussed in this political transcript. Focus on policy positions, major statements, and significant topics covered.',
    TRUE
) ON CONFLICT (name) DO NOTHING;

-- Insert additional preset examples
INSERT INTO summary_presets (name, description, custom_prompt, bullet_points) 
VALUES 
    (
        'Policy Focus',
        'Detailed analysis of policy positions and proposals discussed',
        'Analyze this political transcript focusing specifically on policy positions, proposals, and legislative discussions. Highlight specific policies mentioned, their details, and the speakers positions on them.',
        6
    ),
    (
        'Key Quotes',
        'Extract and summarize the most impactful quotes and statements',
        'Extract the most significant quotes and statements from this political transcript. Focus on memorable phrases, strong positions, and statements that capture the essence of each speakers message.',
        5
    ),
    (
        'Debate Analysis',
        'Analysis focused on disagreements, rebuttals, and contrasting viewpoints',
        'Analyze this political transcript as a debate or discussion, focusing on disagreements between speakers, rebuttals, contrasting viewpoints, and areas of conflict or consensus.',
        5
    )
ON CONFLICT (name) DO NOTHING;

COMMIT;