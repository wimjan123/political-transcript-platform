# Codebase Structure Overview

## Root Directory Structure
```
political-transcript-platform/
├── backend/               # FastAPI backend application
├── frontend/              # React frontend application
├── data/                  # Data storage directory
├── docs/                  # Documentation
├── nginx/                 # Reverse proxy configuration
├── docker-compose.yml     # Development docker configuration
├── docker-compose.prod.yml # Production docker configuration
├── Makefile              # Development automation commands
└── CLAUDE.md             # AI assistant instructions
```

## Backend Architecture (`backend/`)
```
backend/
├── src/
│   ├── api/              # FastAPI route handlers
│   ├── models.py         # SQLAlchemy database models
│   ├── services/         # Business logic services
│   │   ├── import_service.py      # File processing
│   │   └── summarization_service.py  # AI summarization
│   ├── search/           # Meilisearch integration
│   │   └── indexer.py    # Search indexing logic
│   └── utils/            # Utility functions
├── tests/                # Backend test suite
├── scripts/              # Database and utility scripts
├── migrations/           # Database migration files
└── requirements.txt      # Python dependencies
```

## Frontend Architecture (`frontend/`)
```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page-level components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API service functions
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts     # Comprehensive type definitions
│   └── utils/           # Utility functions
├── tests/               # Frontend test suite
├── public/              # Static assets
├── package.json         # Node.js dependencies
└── playwright.config.ts # E2E test configuration
```

## Key Services & Components

### Database Models (`backend/src/models.py`)
- **Video**: Metadata, file info, thumbnails, analytics
- **Speaker**: Name normalization, statistics
- **TranscriptSegment**: Timestamped content, sentiment scores
- **VideoSummary**: AI-generated summaries with caching

### Import Pipeline
- **HTML Import**: Political video transcript processing
- **XML Import**: Tweede Kamer VLOS document processing
- **Progress Tracking**: Real-time WebSocket updates
- **Cancellation Support**: User-controlled import termination

### Search Architecture
- **Meilisearch Integration**: Real-time indexing
- **Hybrid Search**: Lexical + semantic search modes
- **Vector Embeddings**: AI-powered similarity search
- **Export Features**: CSV/JSON data export

### AI Features
- **Summarization**: OpenAI/OpenRouter integration
- **Content Analytics**: Multi-algorithm sentiment analysis
- **Batch Processing**: Concurrent video processing
- **Intelligent Caching**: Duplicate prevention