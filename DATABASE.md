# Database Guide

This document outlines the database schema relevant to imports, the new dataset tagging (v0.2), and how to run migrations and Meilisearch syncs.

## Tables (Core)

### `videos`
- `id` (PK)
- `title`, `filename` (unique), `date`, `duration`
- `source`, `channel`, `description`, `url`
- `video_thumbnail_url`, `video_url`, `vimeo_video_id`, `vimeo_embed_url`
- Event metadata: `format`, `candidate`, `place`, `record_type`
- Stats: `total_words`, `total_characters`, `total_segments`
- Timestamps: `created_at`, `updated_at`
- v0.2: `dataset` (e.g., `trump`, `tweede_kamer`), `source_type` (e.g., `html`, `xml`)

Indexes:
- `(date, source)`, event metadata composite, plus dataset/source_type (v0.2)

### `transcript_segments`
- `id` (PK)
- `segment_id` (source segment ID)
- `video_id` (FK videos.id)
- `speaker_id` (nullable FK speakers.id)
- Core text/timing: `speaker_name`, `transcript_text`, `video_seconds`, `timestamp_start`, `timestamp_end`, `duration_seconds`
- Text metrics: `word_count`, `char_count`
- Sentiment: `sentiment_loughran_score`, `sentiment_harvard_score`, `sentiment_vader_score`
- Moderation: numeric scores and boolean flags
- Readability metrics
- Stresslens: `stresslens_score`, `stresslens_rank`
- Embedding fields: `embedding`, `embedding_generated_at`
- Timestamps: `created_at`, `updated_at`

### `speakers`, `topics`, `segment_topics`
- Standard speaker/topic entities; `segment_topics` as many-to-many with score metadata.

## Migrations

### v0.2 Migration: Dataset Tagging

File: `backend/migrations/014_add_dataset_source_type.sql`

- Adds to `videos`:
  - `dataset VARCHAR(50)` (indexed)
  - `source_type VARCHAR(20)` (indexed)
- Backfills existing rows to:
  - `dataset='trump'`
  - `source_type='html'`

Apply (Docker):
```bash
# execute inside db container (already applied if you used the helper commands earlier)
docker compose exec -T db psql -U postgres -d political_transcripts -v ON_ERROR_STOP=1 \
  -c "ALTER TABLE videos ADD COLUMN IF NOT EXISTS dataset VARCHAR(50);" \
  -c "ALTER TABLE videos ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);" \
  -c "CREATE INDEX IF NOT EXISTS idx_video_dataset ON videos(dataset);" \
  -c "CREATE INDEX IF NOT EXISTS idx_video_source_type ON videos(source_type);" \
  -c "UPDATE videos SET dataset = COALESCE(dataset, 'trump'), source_type = COALESCE(source_type, 'html');"
```

## Imports

### HTML Import
- Endpoint: `POST /api/upload/import-html`
- Tags new videos with `dataset='trump'`, `source_type='html'` (v0.2+)

### VLOS XML Import (Tweede Kamer)
- Endpoint: `POST /api/upload/import-vlos-xml`
- Files read from `XML_DATA_DIR` (override with `source_dir`)
- Tags new videos with `dataset='tweede_kamer'`, `source_type='xml'`
- Status: `GET /api/upload/import-status` (includes `job_type`), WS: `/ws/import-status`

## Meilisearch

- `dataset` added as a filterable attribute for both `segments` and `events` indexes (v0.2).
- Initialization: `python scripts/meili_init.py`
- Incremental sync: `python scripts/meili_sync.py --incremental --batch-size=1000`

Docker helpers:
```bash
make start-meili
make meili-init
make meili-sync
```

## Searching by Dataset

- Postgres API (`/api/search/`): add `dataset=trump|tweede_kamer` (omit or `all` to include both)
- Meilisearch API (`/api/search/meili`): add `dataset=trump|tweede_kamer`

