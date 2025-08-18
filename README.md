# Political Video Transcript Search Platform

A comprehensive full-stack platform for processing, analyzing, and searching political video transcripts with advanced AI-powered analytics and summarization capabilities.

## 🎯 Overview

This platform enables users to:
- **Search & Analyze** political video transcripts with advanced semantic search
- **Generate AI Summaries** of video content with multiple AI providers
- **Explore Analytics** including sentiment analysis, content moderation, and readability metrics
- **Import & Process** HTML transcript files with rich metadata extraction
- **Browse & Manage** video libraries with deep-linking and playlist functionality

## 🏗️ Architecture

### Backend (FastAPI + PostgreSQL)
- **FastAPI** REST API with async/await support
- **PostgreSQL** database with full-text search optimization
- **SQLAlchemy** ORM with async sessions
- **Pydantic** models for data validation
- **Meilisearch** integration for semantic and hybrid search
- **OpenAI** integration for AI summarization

### Frontend (React + TypeScript)
- **React 18** with functional components and hooks
- **TypeScript** for type safety and developer experience
- **Tailwind CSS** for responsive styling
- **React Router** for client-side routing
- **Axios** for API communication

### Key Features
- **Multi-Algorithm Analytics**: Sentiment analysis (VADER, Harvard IV, Loughran McDonald), content moderation, readability metrics
- **AI Summarization**: Batch processing with OpenAI/OpenRouter integration
- **Semantic Search**: Vector embeddings with Meilisearch
- **Real-time Processing**: Async import and processing workflows
- **Deep Linking**: Time-based video navigation with segment highlighting

### New in v0.2
- Tweede Kamer VLOS XML importer with progress/cancel controls
- Dataset tagging and filtering (Trump vs Tweede Kamer)
- Import status includes `job_type` and WebSocket live updates

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended)
- **Node.js 18+** (for local development)
- **Python 3.11+** (for local development)
- **PostgreSQL 15+** (if running without Docker)

### Development Setup (Docker - Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd political-transcript-platform
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services**
   ```bash
   make dev
   ```

4. **Import sample data** (optional)
   ```bash
   make import-data
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Manual Setup (Local Development)

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Database setup
createdb political_transcripts
alembic upgrade head

# Start backend
uvicorn src.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 📁 Project Structure

```
political-transcript-platform/
├── backend/                    # FastAPI backend
│   ├── src/
│   │   ├── routes/            # API route handlers
│   │   │   ├── search.py      # Search endpoints
│   │   │   ├── videos.py      # Video management
│   │   │   ├── analytics.py   # Analytics & insights
│   │   │   ├── summarization.py # AI summarization
│   │   │   └── upload.py      # Data import
│   │   ├── services/          # Business logic services
│   │   │   ├── import_service.py # HTML processing
│   │   │   ├── summarization_service.py # AI integration
│   │   │   └── search_service.py # Search logic
│   │   ├── parsers/           # Data processors
│   │   │   └── html_parser.py # HTML transcript parser
│   │   ├── models.py          # SQLAlchemy database models
│   │   ├── database.py        # Database configuration
│   │   └── main.py           # FastAPI application entry
│   ├── migrations/           # Database migrations
│   ├── scripts/             # Utility scripts
│   └── requirements.txt     # Python dependencies
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   │   ├── SearchPage.tsx
│   │   │   ├── SummarySearchPage.tsx
│   │   │   ├── VideosPage.tsx
│   │   │   ├── VideoDetailPage.tsx
│   │   │   └── AnalyticsPage.tsx
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript type definitions
│   │   └── hooks/          # Custom React hooks
│   ├── public/             # Static assets
│   └── package.json        # Node.js dependencies
├── docker-compose.yml      # Docker services configuration
├── Makefile               # Development commands
├── README.md              # This file
└── API.md                 # API documentation
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5433/political_transcripts
POSTGRES_USER=transcripts_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=political_transcripts

# API Configuration
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
HTML_DATA_DIR=/root/polibase/out/html
XML_DATA_DIR=/root/tweedekamer_scrape/tweede-kamer-scraper/output/xml/

# AI Services (Optional)
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Meilisearch
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=your_master_key_here

# Frontend
REACT_APP_API_URL=http://localhost:8000
```

### Key Configuration Options

- **`HTML_DATA_DIR`**: Directory containing HTML transcript files for import
- **`XML_DATA_DIR`**: Directory containing Tweede Kamer VLOS XML files for import
- **`DATABASE_URL`**: PostgreSQL connection string
- **`OPENAI_API_KEY`**: Required for AI summarization features
- **`MEILISEARCH_URL`**: Meilisearch instance for semantic search

## 🛠️ Available Commands

### Development Commands
```bash
make setup          # Initial setup with database creation
make dev            # Start all services in development mode
make start-db       # Start PostgreSQL only
make start-api      # Start backend API only
make start-web      # Start frontend only
```

### Data Management
```bash
make import-data    # Import HTML transcripts
curl -X POST "http://localhost:8000/api/upload/import-vlos-xml"  # Start Tweede Kamer XML import
make backup-db      # Create database backup
make restore-db FILE=backup.sql  # Restore from backup
make shell-db       # Access PostgreSQL shell
```

### Meilisearch Operations
```bash
make meili-up       # Start Meilisearch container
make meili-init     # Initialize indexes and settings
make meili-sync     # Sync data from PostgreSQL
make meili-down     # Stop Meilisearch
```

### Code Quality
```bash
make test           # Run backend tests
make lint           # Check code formatting
make format         # Auto-format Python code
```

### Monitoring
```bash
make logs-api       # View API logs
make logs-web       # View frontend logs
```

## 📊 Data Pipeline

### HTML Import Process

1. **File Discovery**: Scans `HTML_DATA_DIR` for `.html` files
2. **Metadata Extraction**: Parses `<meta>` tags for video information
3. **Content Parsing**: Extracts transcript segments with timestamps
4. **Analytics Processing**: Generates sentiment, readability, and moderation scores
5. **Database Storage**: Stores structured data with full-text search indexes

### Supported HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
  <meta property="twitter:title" content="Video Title">
  <meta property="twitter:image" content="thumbnail_url">
  <meta name="description" content="Video description">
  <meta name="candidate" content="Speaker Name">
  <meta name="date" content="2024-01-15">
  <meta name="source" content="News Network">
</head>
<body>
  <div class="segment" data-start="0" data-speaker="Speaker Name" data-video-seconds="15.5">
    Transcript content with timestamps...
  </div>
  <div class="segment" data-start="1" data-speaker="Moderator" data-video-seconds="45.2">
    More transcript content...
  </div>
</body>
</html>
```

### Analytics Generated

- **Sentiment Analysis**: VADER, Harvard IV, Loughran McDonald algorithms
- **Content Moderation**: OpenAI categories (harassment, hate, violence, etc.)
- **Readability Metrics**: Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG
- **Topic Classification**: Automated topic extraction and categorization

## 🔍 Search Capabilities

### Full-Text Search (PostgreSQL)
- PostgreSQL GIN indexes for fast text search
- Supports complex queries with boolean operators
- Fuzzy matching and phrase search
- Advanced filters by date, speaker, source, sentiment

### Semantic Search (Meilisearch)
- **Vector embeddings** for semantic similarity
- **Hybrid search** combining lexical and semantic results
- **Configurable similarity** thresholds
- **Multiple search modes**:
  - **Lexical**: Standard keyword ranking (BM25)
  - **Hybrid**: BM25 + semantic reranking (semanticRatio=0.6)
  - **Semantic**: Semantic-only retrieval (semanticRatio=1.0)

### Search Features
- **Real-time suggestions** with auto-complete
- **Export capabilities** (CSV/JSON)
- **Advanced filtering** by multiple criteria
- **Result highlighting** with context

## 🤖 AI Features

### Summarization
- **Multiple Providers**: OpenAI, OpenRouter support
- **Batch Processing**: Summarize up to 10 videos simultaneously
- **Customizable**: Adjustable bullet points (3-5)
- **Caching**: Intelligent caching to avoid duplicate processing
- **Search**: Full-text search across generated summaries

### Content Analysis
- **Automatic Sentiment**: Multi-algorithm sentiment scoring
- **Safety Screening**: Content moderation flagging
- **Readability Assessment**: Grade-level analysis
- **Topic Extraction**: Automatic categorization

## 📱 User Interface

### Main Features

#### Search Page (`/search`)
- **Advanced Search**: Complex queries with filters
- **Real-time Suggestions**: Auto-complete functionality
- **Export Options**: CSV/JSON result exports
- **Semantic Search**: AI-powered similarity search
- **Meilisearch Integration**: Multiple search modes

#### Summary Search (`/summaries`)
- **Overview Dashboard**: Statistics and summary counts
- **Full-Text Search**: Search through AI-generated summaries
- **Provider Details**: See which AI model generated each summary
- **Direct Links**: Navigate to source videos
- **Batch Operations**: View batch summarization results

#### Videos Page (`/videos`)
- **Library Browser**: Paginated video collection
- **Batch Operations**: Select multiple videos for summarization
- **Rich Metadata**: Thumbnails, durations, sources
- **Advanced Filters**: Search, date range, source filtering
- **Selection Mode**: Multi-select for batch operations

#### Video Detail Page (`/videos/:id`)
- **Full Transcript**: Complete transcript with timestamps
- **Segment Navigation**: Jump to specific time codes
- **Analytics Display**: Detailed sentiment and readability data
- **AI Summary**: On-demand summary generation
- **Deep Linking**: Time-based URLs (`?t=123&segment_id=456`)

#### Analytics Dashboard (`/analytics`)
- **Overview Stats**: Platform-wide statistics
- **Sentiment Trends**: Temporal sentiment analysis
- **Speaker Analytics**: Per-speaker insights
- **Content Moderation**: Safety metrics
- **Interactive Charts**: Filterable data visualizations

### Design System

- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Accessibility**: WCAG 2.1 compliant with keyboard navigation
- **Performance Optimized**: Code splitting and lazy loading
- **Modern UI**: Glass morphism effects and smooth animations

## 🔌 API Integration

### REST API Endpoints

#### Search
- `GET /api/search/` - Full-text search with filters
- `GET /api/search/semantic` - Semantic similarity search
- `GET /api/search/suggest` - Search suggestions
- `GET /api/search/meili` - Meilisearch endpoints
- `POST /api/search/export` - Export search results

#### Videos
- `GET /api/videos/` - List videos with pagination
- `GET /api/videos/{id}` - Get video details
- `GET /api/videos/{id}/segments` - Get video segments
- `GET /api/videos/{id}/stats` - Get video analytics

#### Summarization
- `POST /api/summarization/video/{id}/summary` - Generate summary
- `GET /api/summarization/search` - Search summaries
- `POST /api/summarization/batch-summarize` - Batch summarization
- `GET /api/summarization/stats` - Summarization statistics
- `GET /api/summarization/video/{id}/cached-summary` - Get cached summary

#### Analytics
- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/sentiment` - Sentiment analysis
- `GET /api/analytics/topics` - Topic analytics
- `GET /api/analytics/readability` - Readability metrics

#### Upload & Import
- `POST /api/upload/import-html` - Start HTML import
- `GET /api/upload/import-status` - Check import progress
- `POST /api/upload/import-cancel` - Cancel import

For detailed API documentation, see [API.md](API.md).

## 🗄️ Database Schema

### Core Entities

#### Videos
- Metadata (title, description, source, date)
- File information (filename, URL, duration)
- Thumbnail and media URLs
- Event context (candidate, place, format)

#### Speakers
- Name normalization and original names
- Speaker statistics and appearances

#### Transcript Segments
- Timestamped content with video positioning
- Speaker attribution
- Analytics scores (sentiment, readability, moderation)

#### Video Summaries
- AI-generated summaries with metadata
- Provider and model information
- Caching and versioning

#### Topics
- Hierarchical topic classification
- Frequency and relevance scoring

### Indexes
- **Full-text search**: GIN indexes on content
- **Temporal queries**: B-tree indexes on dates
- **Analytics queries**: Indexes on score fields

## 🚀 Deployment

### Docker Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with production configuration
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose exec api alembic upgrade head
```

### Environment-Specific Configuration
- **Development**: Hot reloading, debug logging
- **Staging**: Production-like with additional logging
- **Production**: Optimized builds, error monitoring

### Health Checks
- `/health` - API health check
- Database connection monitoring
- Meilisearch connectivity verification

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
pytest tests/ --cov=src --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

### Integration Tests
```bash
make test-integration
```

## 📈 Performance

### Optimization Strategies
- **Database**: Optimized queries with proper indexing
- **Caching**: Intelligent caching for AI summaries
- **CDN**: Static asset delivery optimization
- **Code Splitting**: Lazy loading of React components

### Monitoring
- **Metrics**: Request/response times, error rates
- **Logging**: Structured logging with correlation IDs
- **Alerts**: Performance threshold monitoring

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database status
make logs-db

# Restart database
docker-compose restart db

# Reset database
make setup
```

#### Import Failures
```bash
# Check import status
curl http://localhost:8000/api/upload/import-status

# Restart import
curl -X POST http://localhost:8000/api/upload/import-html
```

#### Meilisearch Issues
```bash
# Check Meilisearch health
curl http://localhost:7700/health

# Reset indexes
make meili-init
```

### Logs and Debugging
- **API Logs**: `make logs-api`
- **Frontend Logs**: Browser console + `make logs-web`
- **Database Logs**: `make logs-db`

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with proper tests
4. Run linting and tests (`make lint && make test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards
- **Python**: PEP 8 with Black formatting
- **TypeScript**: ESLint + Prettier configuration
- **Git**: Conventional commit messages
- **Testing**: Minimum 80% test coverage

### Documentation
- Update README.md for new features
- Add API documentation for new endpoints
- Include inline code comments for complex logic

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT-based summarization capabilities
- **Meilisearch** for semantic search infrastructure
- **FastAPI** for the robust backend framework
- **React** ecosystem for the frontend foundation

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the [API Documentation](API.md) for endpoint details
- Review the troubleshooting section above

---

**Built with ❤️ for political transparency and accessibility**

### VLOS XML Import (Tweede Kamer)

1. Files discovered from `XML_DATA_DIR` (`*.xml`)
2. Parser sanitizes leading scraper comments/BOM and extracts tekst/alinea content
3. Heuristic speaker header detection (lines like "Voorzitter: …")
4. Records stored with `dataset='tweede_kamer'`, `source_type='xml'`
5. Same progress reporting and cancellation as HTML import

Endpoints:
- Start: `POST /api/upload/import-vlos-xml`
- Status: `GET /api/upload/import-status` (includes `job_type`)
- Live: WebSocket `/ws/import-status`

Searching by dataset:
- Add `dataset=trump|tweede_kamer` to `/api/search/` or `/api/search/meili`
