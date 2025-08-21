# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This repository contains the **Political Video Transcript Search Platform** in the `political-transcript-platform/` subdirectory as a git submodule. The main application consists of a FastAPI backend and React frontend that processes transcript files (HTML and XML), provides semantic search through Meilisearch, and features AI-powered summarization capabilities.

**Working Directory**: Always `cd political-transcript-platform/` before running commands.

## Core Architecture

This is a **Political Video Transcript Search Platform** with FastAPI backend and React frontend. The platform processes transcript files (HTML and XML), provides semantic search through Meilisearch, and features AI-powered summarization capabilities.

### Backend Architecture
- **FastAPI**: Async REST API with SQLAlchemy ORM and Pydantic validation
- **PostgreSQL**: Database with full-text search optimization and GIN indexes  
- **pgvector**: Vector embeddings extension for PostgreSQL
- **Meilisearch**: Semantic search with vector embeddings and hybrid search modes
- **AI Integration**: OpenAI/OpenRouter for summarization with intelligent caching
- **Multi-format Parsers**: HTML parser for political videos, VLOS XML parser for Tweede Kamer

### Frontend Architecture  
- **React 18 + TypeScript**: Functional components with comprehensive type definitions
- **Tailwind CSS**: Responsive design with glass morphism effects
- **React Router**: Client-side routing with deep linking support
- **Chart.js + Recharts**: Interactive analytics visualizations
- **Playwright**: E2E testing with cross-browser support

### Key Services & Components
- **Import Service** (`backend/src/services/import_service.py`): Processes files with progress tracking and cancellation
- **Summarization Service** (`backend/src/services/summarization_service.py`): Batch AI processing with multiple providers
- **Search Indexer** (`backend/src/search/indexer.py`): Meilisearch synchronization and embedding management
- **Database Models** (`backend/src/models.py`): Video, Speaker, TranscriptSegment, VideoSummary with analytics fields
- **Type Definitions** (`frontend/src/types/index.ts`): Comprehensive TypeScript interfaces for all data structures

### Search Architecture
- **Hybrid Search**: Combines lexical (BM25) and semantic (vector) search
- **Three Search Modes**: Lexical, Hybrid (0.6 semantic ratio), Semantic (1.0 ratio)
- **Meilisearch Integration**: Real-time indexing with configurable similarity thresholds
- **Export Capabilities**: CSV/JSON exports with custom formatting

## Essential Commands

**Important**: All commands must be run from the `political-transcript-platform/` directory.

### Development Setup
```bash
cd political-transcript-platform/  # Always start here
make setup          # Initial setup with database creation
make dev            # Start all services (db, api, web, meilisearch)
make import-data    # Import HTML transcripts from data source
```

### Prerequisites & Versions
- **Docker & Docker Compose** (recommended for development)
- **Python 3.11+** (for local development)
- **Node.js 18+** (for local development)  
- **PostgreSQL 15+** (if running without Docker)

### Individual Services
```bash
make start-db       # PostgreSQL only (port 5433)
make start-api      # Backend API only (port 8000, requires DB)
make start-web      # Frontend only (port 3000)
make start-meili    # Meilisearch only (port 7700)
```

### Docker vs Local Development
- **Docker (Recommended)**: Use `make dev` for full-stack development
- **Local Development**: Start services individually, requires manual DB setup
- **Production**: Use `docker-compose -f docker-compose.prod.yml up -d --build`

### Data Import & Processing
```bash
# HTML Import (Political Videos)
make import-data                    # Import HTML transcripts from HTML_DATA_DIR
curl -X POST "http://localhost:8000/api/upload/import-html?force_reimport=false"  # Manual trigger

# XML Import (Tweede Kamer VLOS)  
curl -X POST "http://localhost:8000/api/upload/import-vlos-xml"  # Import XML from XML_DATA_DIR

# Import Status & Monitoring
curl "http://localhost:8000/api/upload/import-status"            # Check import progress
curl -X POST "http://localhost:8000/api/upload/import-cancel"    # Cancel running import

# Meilisearch Operations
make meili-init                     # Initialize Meilisearch indexes
make meili-sync                     # Sync data to Meilisearch
```

### Database Operations
```bash
make shell-db                       # PostgreSQL shell access
make backup-db                      # Create timestamped database backup  
make restore-db FILE=backup.sql     # Restore from backup
```

### Development Tools
```bash
# Backend Testing & Quality
make test                          # Run backend tests with pytest
make lint                          # Check Python code formatting (black, flake8)  
make format                        # Auto-format Python code (black, isort)
pytest tests/specific_test.py      # Run individual test file
pytest tests/ --cov=src --cov-report=html  # Run with coverage

# Frontend Testing & Quality  
cd frontend && npm test            # Run React tests with Jest
cd frontend && npm run test:e2e    # Run Playwright E2E tests
cd frontend && npm run lint        # ESLint checking
cd frontend && npm run lint:fix    # Auto-fix ESLint issues

# Logging & Monitoring
make logs-api                      # View API logs
make logs-web                      # View frontend logs
make logs-db                       # View database logs
```

### Meilisearch Operations
```bash
make meili-up                      # Start Meilisearch container
make meili-init                    # Initialize indexes and settings
make meili-reindex                 # Full reindexing from PostgreSQL
make meili-sync                    # Incremental sync with batch processing
make meili-down                    # Stop Meilisearch
```

## Data Pipeline & Import Process

### HTML Import (Political Videos)
1. Files discovered from `HTML_DATA_DIR` (default: `/root/polibase/out/html/`)
2. Metadata extraction from `<meta>` tags (title, description, date, speaker, thumbnail)
3. Segment parsing with timestamps and speaker attribution
4. Analytics generation: sentiment (VADER, Harvard IV, Loughran McDonald), content moderation, readability metrics
5. Database storage with dataset tag `'trump'` and source type `'html'`

### XML Import (Tweede Kamer VLOS)  
1. Files discovered from `XML_DATA_DIR` (default: `/root/tweedekamer_scrape/tweede-kamer-scraper/output/xml/`)
2. XML sanitization (removes scraper comments and BOM)
3. Content extraction from `tekst/alinea` elements
4. Heuristic speaker detection (patterns like "Voorzitter: ...")
5. Database storage with dataset tag `'tweede_kamer'` and source type `'xml'`

### Data Directory Configuration
- **HTML_DATA_DIR**: `/root/polibase/out/html/` (political video transcripts)
- **XML_DATA_DIR**: `/root/tweedekamer_scrape/tweede-kamer-scraper/output/xml/` (Tweede Kamer transcripts)
- Both directories configurable via environment variables

### Import Status & Monitoring
- Real-time progress tracking with WebSocket updates (`/ws/import-status`)
- Cancellation support for long-running imports  
- Job type identification (`html_import` vs `vlos_xml_import`)
- Error reporting and retry mechanisms

## Database Schema

### Core Entities
- **Video**: Metadata, file info, thumbnails, event context, analytics aggregations
- **Speaker**: Name normalization, statistics, appearance tracking
- **TranscriptSegment**: Timestamped content, speaker attribution, sentiment/readability scores
- **VideoSummary**: AI-generated summaries with provider metadata and caching
- **Topic**: Hierarchical classification with frequency scoring

### Key Schema Points
- `video_seconds` nullable for transcripts without timing data
- Dataset filtering with `'trump'` and `'tweede_kamer'` tags
- Source type tracking (`'html'`, `'xml'`) for format-specific processing
- Full-text search indexes (GIN) on content fields
- Analytics fields as floats/JSON for flexible querying

## Configuration & Environment

### Required Environment Variables
```bash
# Database (PostgreSQL on port 5433 to avoid conflicts)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/political_transcripts

# Data Sources  
HTML_DATA_DIR=/root/polibase/out/html                              # Political video transcripts
XML_DATA_DIR=/root/tweedekamer_scrape/tweede-kamer-scraper/output/xml  # Tweede Kamer transcripts

# Search (Meilisearch on port 7700)
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=change-me

# AI Services (optional - for summarization features)
OPENAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# Frontend (React on port 3000)
REACT_APP_API_URL=                 # Empty for CRA dev proxy to :8000
BACKEND_CORS_ORIGINS=["http://localhost:3000"]

# Production
API_WORKERS=4                      # Uvicorn worker processes (dev/prod)
```

### Database Configuration
- PostgreSQL runs on port 5433 in Docker to avoid conflicts with system installs
- Migrations in `backend/migrations/` applied via `python apply_migration.py`
- Alembic support for schema versioning
- pgvector extension required for vector embeddings

### Service URLs (Development)
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000 (API docs at /docs)  
- **Database**: localhost:5433 (PostgreSQL)
- **Meilisearch**: http://localhost:7700

## AI Features & Summarization

### Summarization Capabilities
- **Multiple Providers**: OpenAI (GPT-4, GPT-3.5) and OpenRouter support
- **Batch Processing**: Summarize up to 10 videos simultaneously with progress tracking
- **Intelligent Caching**: Avoids duplicate processing with summary versioning
- **Customizable Output**: 3-5 bullet points with adjustable detail levels
- **Search Integration**: Full-text search across generated summaries

### Content Analytics
- **Multi-Algorithm Sentiment**: VADER, Harvard IV, Loughran McDonald scoring
- **Content Moderation**: OpenAI safety categories (harassment, hate, violence, etc.)
- **Readability Assessment**: Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG indices
- **Topic Extraction**: Automated categorization and classification

## Frontend Features & Pages

### Search Interfaces
- **Standard Search** (`/search`): Full-text search with advanced filters and export
- **Semantic Search** (`/search?mode=semantic`): AI-powered similarity search
- **Summary Search** (`/summaries`): Search through AI-generated video summaries

### Video Management
- **Videos Page** (`/videos`): Library browser with batch operations and metadata display
- **Video Detail** (`/videos/:id`): Full transcript with deep linking (`?t=123&segment_id=456`)
- **Analytics Dashboard** (`/analytics`): Platform-wide statistics and visualizations

### Advanced Features
- **Conversational Search**: ChatGPT-style interface with context awareness
- **Playlist Management**: Video collections with sharing capabilities
- **Batch Summarization**: Multi-video AI processing with job tracking
- **Real-time Updates**: WebSocket integration for import progress

## Testing & Quality

### Testing Strategy
- **Backend**: pytest with coverage reporting (`make test`)
- **Frontend**: React Testing Library + Jest (`cd frontend && npm test`)
- **E2E**: Playwright cross-browser testing (`cd frontend && npm run test:e2e`)  
- **Integration**: Full-stack API testing with Docker
- **Individual Tests**: `pytest tests/specific_test.py` for targeted testing

### Code Quality Tools
- **Python**: Black formatting, flake8 linting, isort imports (`make lint`, `make format`)
- **TypeScript**: ESLint + Prettier (`cd frontend && npm run lint`)
- **Coverage**: `pytest tests/ --cov=src --cov-report=html`
- **Git**: Conventional commit messages encouraged

### Debugging & Troubleshooting
- **Container Access**: `docker compose exec api bash`, `docker compose exec db psql -U postgres -d political_transcripts`
- **Service Health**: Check `http://localhost:8000/health` for API health
- **Log Monitoring**: `make logs-api`, `make logs-web`, `make logs-db`