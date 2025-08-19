-- Migration to add import progress tracking table
-- This allows persistent progress tracking across API restarts

CREATE TABLE IF NOT EXISTS import_progress (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(50) UNIQUE NOT NULL,
    job_type VARCHAR(20) NOT NULL, -- 'html_import', 'vlos_xml_import'
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER NOT NULL DEFAULT 0,
    failed_files INTEGER NOT NULL DEFAULT 0,
    current_file TEXT,
    error_messages TEXT[], -- Array of error messages
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_import_progress_job_id ON import_progress(job_id);
CREATE INDEX IF NOT EXISTS idx_import_progress_status ON import_progress(status);
CREATE INDEX IF NOT EXISTS idx_import_progress_started_at ON import_progress(started_at);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_import_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the timestamp
CREATE TRIGGER trigger_update_import_progress_timestamp
    BEFORE UPDATE ON import_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_import_progress_timestamp();