# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Architecture

This is a **Political Video Transcript Search Platform** built with FastAPI backend and React frontend, designed to process and search political video transcript HTML files with advanced analytics.

### Data Flow Architecture
- **HTML Parser** (`backend/src/parsers/html_parser.py`): Extracts comprehensive data from transcript HTML files including speaker names, timestamps, video seconds, sentiment analysis scores, content moderation metrics, topic classifications, and readability statistics
- **Import Service** (`backend/src/services/import_service.py`): Processes HTML files through the parser and stores structured data in PostgreSQL with full-text search optimization
- **Database Models** (`backend/src/models.py`): Core entities are Video, Speaker, Topic, TranscriptSegment with rich analytics fields (sentiment analysis from multiple algorithms, content moderation scores, readability metrics)
- **API Routes** (`backend/src/routes/`): Modular FastAPI routes for search, analytics, videos, and upload functionality

### Frontend Architecture
- **React 18 + TypeScript**: Modern functional components with comprehensive type definitions in `frontend/src/types/index.ts`
- **Page Structure**: Home → Search → Videos (list) → VideoDetail (with deep linking support for time-based navigation)
- **Analytics Integration**: Full display of sentiment analysis, content moderation warnings, readability metrics, and video thumbnails throughout the UI

### Key Technical Patterns
- **Deep Linking**: Video detail pages support `?t=123&segment_id=456` parameters for auto-scroll and highlighting
- **Infinite Scroll**: Segment loading with intersection observer and prefetching
- **Analytics Display**: Expandable sections showing detailed sentiment, moderation, and readability data
- **Database Migrations**: Manual SQL migrations in `backend/migrations/` with Python migration script

## Essential Commands

### Development Setup
```bash
make setup          # Initial setup with database creation
make dev            # Start all services in development mode
make import-data    # Import HTML transcripts from /root/polibase/out/html/
```

### Individual Services
```bash
make start-db       # PostgreSQL only
make start-api      # Backend API only (requires DB)
make start-web      # Frontend only
```

### Database Operations
```bash
make shell-db       # PostgreSQL shell access
make backup-db      # Create timestamped database backup
make restore-db FILE=backup.sql  # Restore from backup
```

### Development Tools
```bash
make test           # Run backend tests
make lint           # Check code formatting
make format         # Auto-format Python code
make logs-api       # View API logs
make logs-web       # View frontend logs
```

## Data Pipeline

### HTML Import Process
1. HTML files expected in `/root/polibase/out/html/` directory (configurable via `HTML_DATA_DIR`)
2. Parser extracts metadata from `<meta>` tags and segment data from structured divs
3. Comprehensive analytics extraction:
   - **Sentiment**: Loughran McDonald, Harvard IV, VADER algorithms
   - **Content Moderation**: OpenAI categories (harassment, hate, self-harm, sexual, violence)
   - **Readability**: Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG, Reading Ease, ARI
   - **Video Data**: Thumbnail URLs from twitter:image meta tags
4. Database storage with full-text search indexes

### Database Schema Key Points
- `video_seconds` field is nullable to support transcripts without timing data
- Speaker names normalized for consistency while preserving original names
- Full-text search optimized with PostgreSQL GIN indexes
- Analytics fields stored as floats/strings for flexible querying

## Configuration

- Copy `.env.example` to `.env` for local development
- Key environment variables:
  - `HTML_DATA_DIR`: Source directory for HTML transcript files
  - `DATABASE_URL`: PostgreSQL connection string  
  - `BACKEND_CORS_ORIGINS`: Frontend URL for CORS
- Database runs on port 5433 in Docker to avoid conflicts

## Import Status Monitoring

```bash
curl http://localhost:8000/api/upload/import-status  # Check import progress
curl -X POST http://localhost:8000/api/upload/import-html?force_reimport=false  # Start import
```

## Analytics Features

The platform provides comprehensive analytics display:
- **Sentiment Analysis**: Color-coded sentiment labels with multiple algorithm scores
- **Content Moderation**: Warning badges for potentially harmful content with severity levels
- **Readability Metrics**: Grade-level indicators and reading difficulty scores
- **Video Thumbnails**: Extracted from transcript metadata and displayed throughout UI
- **Deep Analytics**: Expandable detailed sections in video segment views