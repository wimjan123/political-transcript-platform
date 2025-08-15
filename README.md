# Political Video Transcript Search Platform

A complete political video transcript search platform that parses HTML transcript files and provides advanced search capabilities with analytics and detailed video exploration.

## Features

### Core Functionality
- **HTML Parser**: Extracts speaker names, timestamps, video seconds, transcript text, sentiment analysis, content moderation scores, topic classification, and readability metrics
- **PostgreSQL Database**: Full-text search capabilities optimized for millions of records
- **FastAPI Backend**: RESTful endpoints with search, analytics, export, and video management functionality
- **React Frontend**: Modern interface with advanced search, analytics, and video exploration features

### User Experience
- **Advanced Search**: Full-text search with filters and result highlighting
- **Video Detail Pages**: Dedicated pages for each video with complete transcript viewing
- **Infinite Scroll**: Seamless browsing through large transcript segments
- **Deep Linking**: Time-based URLs that auto-navigate to specific segments
- **Auto-Scroll & Highlight**: Automatic positioning and highlighting of target segments
- **Context Navigation**: Easy transition from search results to full video context

### Technical Features
- **Docker Setup**: Easy development and production deployment
- **Responsive Design**: Optimized for desktop and mobile viewing
- **Performance Optimization**: Prefetching and lazy loading for smooth navigation

## Quick Start

```bash
# One-command setup
make setup

# Development mode
make dev

# Import HTML data
make import-data

# Production deployment
make deploy
```

## Architecture

### Backend
- **FastAPI**: Python-based REST API with multiple route modules
  - `/search` - Full-text search with filters and pagination
  - `/videos` - Video management and segment retrieval
  - `/analytics` - Statistics and data insights
  - `/upload` - File import and processing
- **PostgreSQL**: Full-text search with GIN indexes optimized for millions of records
- **SQLAlchemy ORM**: Database abstraction with async support

### Frontend
- **React 18**: Modern React with TypeScript and functional components
- **TailwindCSS**: Utility-first styling with responsive design
- **React Router**: Client-side routing with deep linking support
- **Axios**: HTTP client for API communication

### Infrastructure
- **Docker Compose**: Multi-container development and production setup
- **Nginx**: Reverse proxy and static file serving
- **Hot Reload**: Development environment with live code updates

## Hybrid and Semantic Search with Meilisearch

The platform supports a separate Meilisearch layer for fast lexical, hybrid, and semantic search while keeping PostgreSQL as the source of truth.

- Start Meilisearch: `make meili-up`
- Initialize indexes and settings: `make meili-init`
- Incremental sync from Postgres: `make meili-sync`
- Stop Meilisearch: `make meili-down`

Search modes available on the Search page when Meili is selected:
- Lexical: standard keyword ranking (BM25)
- Hybrid: BM25 + semantic reranking (semanticRatio=0.6)
- Semantic: semantic-only retrieval (semanticRatio=1)

Filters are mapped to Meilisearch filter strings, preserving existing filters such as date range, candidate, place, record type, topics, moderation flags/scores, stresslens thresholds, and document counts/duration.

Security note:
- Set `MEILI_MASTER_KEY` in your `.env` for production use. You can also override via Makefile: `MEILI_MASTER_KEY=your-key make meili-up`.

Notes:
- Meilisearch runs in its own container with a persistent volume (`./meili_data`).
- PostgreSQL remains the source of truth. The ETL script (`backend/scripts/meili_sync.py`) reads from Postgres and upserts to Meili.
- If you plan to use Meili semantic embeddings, configure an embedder on your Meili server and set the embedder id in backend settings (`MEILI_EMBEDDER_ID`).

## Data Pipeline

The platform processes HTML files with this structure:
- Core transcript data: speaker, timestamp, video seconds, text
- Sentiment analysis: Multiple algorithm scores
- Content moderation: OpenAI moderation categories
- Topic classification: Topics with scores
- Readability metrics: 10+ different algorithms

## Pages & Navigation

- **Home Page** (`/`) - Landing page with platform overview
- **Search Page** (`/search`) - Advanced search with filters and results
- **Videos Page** (`/videos`) - Browse all available video transcripts
- **Video Detail** (`/video/:id`) - Full transcript view with segment navigation
  - Supports time-based deep links: `/video/:id?time=123&segment=5`
  - Auto-scroll to specific segments and highlight target content
- **Analytics Page** (`/analytics`) - Data insights and statistics dashboard

## Development

```bash
# Individual services
make start-db      # PostgreSQL only
make start-api     # Backend API only
make start-web     # Frontend only

# Clean up
make clean
```

## Configuration

Copy `.env.example` to `.env` and configure your environment variables.
