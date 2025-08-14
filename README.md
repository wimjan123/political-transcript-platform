# Political Video Transcript Search Platform

A complete political video transcript search platform that parses HTML transcript files and provides advanced search capabilities with analytics.

## Features

- **HTML Parser**: Extracts speaker names, timestamps, video seconds, transcript text, sentiment analysis, content moderation scores, topic classification, and readability metrics
- **PostgreSQL Database**: Full-text search capabilities optimized for millions of records
- **FastAPI Backend**: RESTful endpoints with search, analytics, and export functionality
- **React Frontend**: Modern interface with advanced filters and analytics dashboard
- **Docker Setup**: Easy development and production deployment

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

- **Backend**: FastAPI with Python, PostgreSQL with full-text search, SQLAlchemy ORM
- **Frontend**: React with TypeScript, TailwindCSS, Chart.js
- **Infrastructure**: Docker with docker-compose, nginx reverse proxy

## Data Pipeline

The platform processes HTML files with this structure:
- Core transcript data: speaker, timestamp, video seconds, text
- Sentiment analysis: Multiple algorithm scores
- Content moderation: OpenAI moderation categories
- Topic classification: Topics with scores
- Readability metrics: 10+ different algorithms

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