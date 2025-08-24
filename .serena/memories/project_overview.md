# Political Video Transcript Search Platform - Project Overview

## Purpose
A full-stack web application for searching, analyzing, and managing political video transcripts with AI-powered features. The platform processes transcript files (HTML and XML), provides semantic search through Meilisearch, and features AI-powered summarization capabilities.

## Tech Stack

### Backend
- **FastAPI**: Async REST API with SQLAlchemy ORM and Pydantic validation
- **PostgreSQL**: Database with full-text search optimization and GIN indexes
- **pgvector**: Vector embeddings extension for PostgreSQL
- **Meilisearch**: Semantic search with vector embeddings and hybrid search modes
- **Python 3.11+**: Core language
- **AI Integration**: OpenAI/OpenRouter for summarization with intelligent caching
- **Multi-format Parsers**: HTML parser for political videos, VLOS XML parser for Tweede Kamer

### Frontend
- **React 18 + TypeScript**: Functional components with comprehensive type definitions
- **Tailwind CSS**: Responsive design with glass morphism effects
- **React Router**: Client-side routing with deep linking support
- **Chart.js + Recharts**: Interactive analytics visualizations
- **Playwright**: E2E testing with cross-browser support

### Infrastructure
- **Docker & Docker Compose**: Containerized development and deployment
- **PostgreSQL 15+**: Database (port 5433 to avoid conflicts)
- **Meilisearch**: Search engine (port 7700)
- **nginx**: Reverse proxy for production

## Key Features
- **Hybrid Search**: Combines lexical (BM25) and semantic (vector) search
- **Three Search Modes**: Lexical, Hybrid (0.6 semantic ratio), Semantic (1.0 ratio)
- **Real-time Import**: Progress tracking with WebSocket updates
- **AI Summarization**: Batch processing with multiple providers
- **Content Analytics**: Multi-algorithm sentiment analysis, content moderation, readability assessment
- **Export Capabilities**: CSV/JSON exports with custom formatting