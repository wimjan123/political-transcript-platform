# Political Video Transcript Search Platform - API Documentation

This document provides comprehensive documentation for the REST API endpoints of the Political Video Transcript Search Platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Search Endpoints](#search-endpoints)
- [Video Endpoints](#video-endpoints)
- [Summarization Endpoints](#summarization-endpoints)
- [Analytics Endpoints](#analytics-endpoints)
- [Upload & Import Endpoints](#upload--import-endpoints)
- [Health Check](#health-check)
- [WebSocket Events](#websocket-events)
- [Examples](#examples)

## Overview

The API is built with FastAPI and provides REST endpoints for:
- Full-text and semantic search across political video transcripts
- Video and transcript segment management
- AI-powered summarization with multiple providers
- Analytics and insights (sentiment, readability, content moderation)
- HTML transcript import and processing
- Real-time status updates

## Authentication

Currently, the API operates without authentication. Future versions will include:
- JWT-based authentication
- API key management
- Role-based access control

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://your-domain.com`

All endpoints are prefixed with `/api/` unless otherwise specified.

## Response Format

All API responses follow a consistent JSON format:

### Success Response
```json
{
  "data": {...},
  "message": "Success",
  "status_code": 200
}
```

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 150,
    "total_pages": 6
  },
  "message": "Success",
  "status_code": 200
}
```

### Error Response
```json
{
  "detail": "Error message",
  "status_code": 400,
  "type": "validation_error"
}
```

## Error Handling

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Summarization**: 10 requests per minute per IP
- **Export**: 5 requests per minute per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

---

## Search Endpoints

### Full-Text Search

**GET** `/api/search/`

Search across video transcripts with advanced filtering and pagination.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | integer | No | Page number (default: 1) |
| `page_size` | integer | No | Results per page (default: 25, max: 100) |
| `video_id` | integer | No | Filter by specific video |
| `speaker` | string | No | Filter by speaker name |
| `date_from` | string | No | Start date (YYYY-MM-DD) |
| `date_to` | string | No | End date (YYYY-MM-DD) |
| `source` | string | No | Filter by news source |
| `sort_by` | string | No | Sort field (`relevance`, `date`, `speaker`) |
| `sort_order` | string | No | Sort direction (`asc`, `desc`) |

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/search/" \
  -G \
  -d "q=climate change" \
  -d "date_from=2024-01-01" \
  -d "speaker=Biden" \
  -d "page=1" \
  -d "page_size=10"
```

#### Example Response
```json
{
  "segments": [
    {
      "id": 12345,
      "video_id": 789,
      "video_title": "Climate Summit 2024",
      "speaker": "Joe Biden",
      "speaker_original": "President Biden",
      "content": "Climate change represents an existential threat...",
      "start_time": 0,
      "video_seconds": 125.5,
      "sentiment_vader": 0.2,
      "sentiment_lm": 0.1,
      "readability_flesch_kincaid": 12.5,
      "content_moderation_harassment": 0.01,
      "topics": [
        {
          "name": "Environment",
          "score": 0.95
        }
      ],
      "video": {
        "id": 789,
        "title": "Climate Summit 2024",
        "date": "2024-01-15",
        "source": "White House",
        "thumbnail_url": "https://example.com/thumb.jpg"
      }
    }
  ],
  "total_segments": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1,
  "query": "climate change",
  "filters_applied": {
    "date_from": "2024-01-01",
    "speaker": "Biden"
  }
}
```

### Semantic Search

**GET** `/api/search/semantic`

Perform semantic similarity search using vector embeddings.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `similarity_threshold` | float | No | Minimum similarity score (0.0-1.0, default: 0.7) |
| `page` | integer | No | Page number |
| `page_size` | integer | No | Results per page |

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/search/semantic" \
  -G \
  -d "q=environmental policy" \
  -d "similarity_threshold=0.8"
```

### Meilisearch Integration

**GET** `/api/search/meili`

Search using Meilisearch with lexical, hybrid, or semantic modes.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `mode` | string | No | Search mode (`lexical`, `hybrid`, `semantic`) |
| `index` | string | No | Index to search (`segments`, `events`) |
| `page` | integer | No | Page number |
| `page_size` | integer | No | Results per page |

### Search Suggestions

**GET** `/api/search/suggest`

Get search query suggestions and auto-completion.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Partial query |
| `type` | string | No | Suggestion type (`speakers`, `topics`, `sources`, `all`) |
| `limit` | integer | No | Max suggestions (default: 10) |

#### Example Response
```json
{
  "suggestions": [
    {
      "text": "climate change policy",
      "type": "topic",
      "count": 45,
      "category": "Environment"
    },
    {
      "text": "Joe Biden",
      "type": "speaker",
      "count": 120,
      "category": "Politicians"
    }
  ],
  "query": "clim",
  "total": 2
}
```

### Export Search Results

**GET** `/api/search/export`

Export search results in CSV or JSON format.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `format` | string | No | Export format (`csv`, `json`) |
| All other search parameters | | No | Same as search endpoint |

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/search/export" \
  -G \
  -d "q=immigration" \
  -d "format=csv" \
  --output search_results.csv
```

---

## Video Endpoints

### List Videos

**GET** `/api/videos/`

Retrieve a paginated list of videos with metadata.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `page_size` | integer | No | Videos per page (default: 25) |
| `search` | string | No | Search in title/description |
| `source` | string | No | Filter by source |
| `date_from` | string | No | Start date filter |
| `date_to` | string | No | End date filter |
| `sort_by` | string | No | Sort field (`date`, `title`, `source`) |
| `sort_order` | string | No | Sort direction (`asc`, `desc`) |

#### Example Response
```json
[
  {
    "id": 789,
    "title": "Presidential Debate 2024",
    "description": "Live debate coverage between candidates",
    "filename": "debate_2024_01_15.html",
    "url": "https://example.com/transcript",
    "video_url": "https://example.com/video",
    "source": "CNN",
    "channel": "CNN Politics",
    "date": "2024-01-15",
    "created_at": "2024-01-15T20:00:00Z",
    "duration": 5400,
    "video_thumbnail_url": "https://example.com/thumb.jpg",
    "vimeo_video_id": "123456789",
    "vimeo_embed_url": "https://player.vimeo.com/video/123456789",
    "candidate": "Multiple",
    "place": "Iowa",
    "format": "Debate",
    "record_type": "Live Event"
  }
]
```

### Get Video Details

**GET** `/api/videos/{video_id}`

Retrieve detailed information about a specific video.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_id` | integer | Yes | Unique video identifier |

#### Example Response
```json
{
  "id": 789,
  "title": "Presidential Debate 2024",
  "description": "Live debate coverage...",
  "filename": "debate_2024_01_15.html",
  "url": "https://example.com/transcript",
  "video_url": "https://example.com/video",
  "source": "CNN",
  "channel": "CNN Politics",
  "date": "2024-01-15",
  "created_at": "2024-01-15T20:00:00Z",
  "duration": 5400,
  "video_thumbnail_url": "https://example.com/thumb.jpg",
  "segment_count": 245,
  "speaker_count": 6,
  "unique_speakers": [
    "Joe Biden",
    "Donald Trump",
    "Moderator"
  ],
  "topics": [
    {
      "name": "Economy",
      "score": 0.85,
      "frequency": 23
    }
  ]
}
```

### Get Video Segments

**GET** `/api/videos/{video_id}/segments`

Retrieve transcript segments for a specific video.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_id` | integer | Yes | Unique video identifier |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number |
| `page_size` | integer | No | Segments per page (default: 50) |
| `speaker` | string | No | Filter by speaker |
| `q` | string | No | Search within segments |

#### Example Response
```json
[
  {
    "id": 12345,
    "start_time": 0,
    "video_seconds": 15.5,
    "speaker": "Joe Biden",
    "speaker_original": "President Biden",
    "content": "Good evening, everyone. Tonight we discuss...",
    "sentiment_vader": 0.2,
    "sentiment_harvard_iv": 0.1,
    "sentiment_loughran_mcdonald": 0.05,
    "readability_flesch_kincaid": 12.5,
    "readability_gunning_fog": 14.2,
    "readability_coleman_liau": 11.8,
    "content_moderation_harassment": 0.01,
    "content_moderation_hate": 0.005,
    "content_moderation_violence": 0.002,
    "topics": [
      {
        "name": "Politics",
        "score": 0.9
      }
    ]
  }
]
```

### Get Video Statistics

**GET** `/api/videos/{video_id}/stats`

Retrieve analytics and statistics for a specific video.

#### Example Response
```json
{
  "video_id": 789,
  "total_segments": 245,
  "total_speakers": 6,
  "duration_minutes": 90,
  "avg_sentiment": 0.15,
  "avg_readability": 12.3,
  "content_flags": {
    "harassment": 2,
    "hate": 0,
    "violence": 1
  },
  "speaker_distribution": [
    {
      "speaker": "Joe Biden",
      "segment_count": 98,
      "word_count": 2450,
      "avg_sentiment": 0.2
    }
  ],
  "topic_distribution": [
    {
      "topic": "Economy",
      "frequency": 23,
      "avg_score": 0.85
    }
  ]
}
```

### Download Video Clip

**POST** `/api/videos/{video_id}/clip`

Generate and download a video clip for specific time range.

#### Request Body
```json
{
  "start_seconds": 125.5,
  "duration_seconds": 30.0,
  "source_url": "https://example.com/video.mp4"
}
```

#### Response
Binary video file (MP4 format)

### Download Multiple Clips

**POST** `/api/videos/{video_id}/clips.zip`

Generate and download multiple video clips as a ZIP file.

#### Request Body
```json
{
  "items": [
    {
      "start_seconds": 125.5,
      "duration_seconds": 30.0,
      "label": "Opening Statement"
    },
    {
      "start_seconds": 456.2,
      "duration_seconds": 45.0,
      "label": "Policy Discussion"
    }
  ],
  "source_url": "https://example.com/video.mp4"
}
```

---

## Summarization Endpoints

### Generate Video Summary

**POST** `/api/summarization/video/{video_id}/summary`

Generate an AI-powered summary of a video transcript.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_id` | integer | Yes | Unique video identifier |

#### Request Body
```json
{
  "bullet_points": 4,
  "custom_prompt": "Focus on policy positions and key arguments",
  "provider": "openai",
  "model": "gpt-3.5-turbo",
  "api_key": "your_api_key_here"
}
```

#### Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bullet_points` | integer | No | Number of bullet points (3-5, default: 4) |
| `custom_prompt` | string | No | Custom summarization prompt |
| `provider` | string | No | AI provider (`openai`, `openrouter`) |
| `model` | string | No | Specific model name |
| `api_key` | string | No | API key for the provider |

#### Example Response
```json
{
  "video_id": 789,
  "video_title": "Presidential Debate 2024",
  "summary": "• Candidates discussed economic recovery plans with focus on job creation\n• Healthcare reform proposals included expanded coverage options\n• Climate change initiatives emphasized renewable energy investments\n• Foreign policy positions highlighted NATO alliance strengthening",
  "bullet_points": 4,
  "metadata": {
    "provider_used": "openai",
    "model_used": "gpt-3.5-turbo",
    "tokens_used": 1250,
    "processing_time": 3.2,
    "cached": false,
    "generated_at": "2024-01-15T21:30:00Z"
  }
}
```

### Search Summaries

**GET** `/api/summarization/search`

Search through cached AI-generated summaries.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search query (empty for all summaries) |
| `page` | integer | No | Page number |
| `page_size` | integer | No | Results per page |

#### Example Response
```json
{
  "results": [
    {
      "id": 123,
      "video_id": 789,
      "video_title": "Presidential Debate 2024",
      "video_date": "2024-01-15",
      "summary_text": "• Economic recovery plans...",
      "bullet_points": 4,
      "provider": "openai",
      "model": "gpt-3.5-turbo",
      "generated_at": "2024-01-15T21:30:00Z",
      "metadata": {
        "tokens_used": 1250,
        "processing_time": 3.2
      }
    }
  ],
  "total": 45,
  "page": 1,
  "page_size": 25,
  "total_pages": 2,
  "query": "economic policy"
}
```

### Batch Summarization

**POST** `/api/summarization/batch-summarize`

Generate summaries for multiple videos simultaneously.

#### Request Body
```json
{
  "video_ids": [789, 790, 791],
  "bullet_points": 4
}
```

#### Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_ids` | array[integer] | Yes | List of video IDs (max 10) |
| `bullet_points` | integer | No | Number of bullet points (3-5) |

#### Example Response
```json
{
  "successful": [
    {
      "video_id": 789,
      "video_title": "Presidential Debate 2024",
      "summary": "• Economic recovery plans...",
      "bullet_points": 4,
      "metadata": {
        "provider_used": "openai",
        "processing_time": 3.2
      }
    }
  ],
  "failed": [
    {
      "video_id": 791,
      "error": "Insufficient transcript data"
    }
  ],
  "total_requested": 3,
  "successful_count": 2,
  "failed_count": 1
}
```

### Get Cached Summary

**GET** `/api/summarization/video/{video_id}/cached-summary`

Retrieve a cached summary if one exists.

#### Example Response
```json
{
  "video_id": 789,
  "video_title": "Presidential Debate 2024",
  "summary": "• Economic recovery plans...",
  "bullet_points": 4,
  "metadata": {
    "cached": true,
    "generated_at": "2024-01-15T21:30:00Z",
    "provider_used": "openai",
    "model_used": "gpt-3.5-turbo"
  }
}
```

### Delete Cached Summary

**DELETE** `/api/summarization/video/{video_id}/cached-summary`

Delete a cached summary to force regeneration.

#### Example Response
```json
{
  "message": "Cached summary deleted for video 789"
}
```

### Check Summarization Capability

**GET** `/api/summarization/video/{video_id}/can-summarize`

Check if a video can be summarized (has sufficient transcript data).

#### Example Response
```json
{
  "video_id": 789,
  "video_title": "Presidential Debate 2024",
  "can_summarize": true,
  "segment_count": 245,
  "summarization_available": true
}
```

### Get Summarization Statistics

**GET** `/api/summarization/stats`

Retrieve statistics about summarization capabilities.

#### Example Response
```json
{
  "total_videos": 150,
  "videos_with_transcripts": 142,
  "average_segments_per_video": 87.5,
  "summarization_available": true,
  "model_used": "gpt-3.5-turbo"
}
```

### Get Model Information

**GET** `/api/summarization/models/info`

Get information about available AI models and capabilities.

#### Example Response
```json
{
  "openai_available": true,
  "primary_model": "gpt-3.5-turbo",
  "fallback_method": "extractive",
  "max_tokens_per_summary": 2000,
  "supported_bullet_points": {
    "min": 3,
    "max": 5
  },
  "batch_limit": 10
}
```

---

## Analytics Endpoints

### Dashboard Analytics

**GET** `/api/analytics/dashboard`

Retrieve comprehensive analytics for the dashboard.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | string | No | Start date filter |
| `date_to` | string | No | End date filter |
| `speakers` | string | No | Comma-separated speaker names |
| `topics` | string | No | Comma-separated topic names |

#### Example Response
```json
{
  "overview": {
    "total_videos": 150,
    "total_segments": 12450,
    "total_speakers": 89,
    "avg_sentiment": 0.12,
    "avg_readability": 11.8
  },
  "sentiment_distribution": {
    "positive": 45,
    "neutral": 78,
    "negative": 27
  },
  "top_speakers": [
    {
      "name": "Joe Biden",
      "segment_count": 450,
      "avg_sentiment": 0.15
    }
  ],
  "top_topics": [
    {
      "name": "Economy",
      "frequency": 234,
      "avg_score": 0.85
    }
  ],
  "content_moderation": {
    "total_flags": 15,
    "harassment": 8,
    "hate": 2,
    "violence": 5
  }
}
```

### Sentiment Analytics

**GET** `/api/analytics/sentiment`

Retrieve detailed sentiment analysis data.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | string | No | Start date filter |
| `date_to` | string | No | End date filter |
| `speaker` | string | No | Filter by speaker |
| `topic` | string | No | Filter by topic |

#### Example Response
```json
{
  "overall_sentiment": {
    "vader": 0.12,
    "harvard_iv": 0.08,
    "loughran_mcdonald": 0.05
  },
  "sentiment_trends": [
    {
      "date": "2024-01-01",
      "avg_sentiment": 0.15,
      "segment_count": 45
    }
  ],
  "speaker_sentiment": [
    {
      "speaker": "Joe Biden",
      "avg_sentiment": 0.18,
      "segment_count": 98
    }
  ],
  "topic_sentiment": [
    {
      "topic": "Economy",
      "avg_sentiment": 0.22,
      "frequency": 23
    }
  ]
}
```

### Topic Analytics

**GET** `/api/analytics/topics`

Retrieve topic classification and frequency data.

#### Example Response
```json
{
  "top_topics": [
    {
      "name": "Economy",
      "frequency": 234,
      "avg_score": 0.85,
      "trend": "increasing"
    }
  ],
  "topic_timeline": [
    {
      "date": "2024-01-01",
      "topics": [
        {
          "name": "Economy",
          "frequency": 12
        }
      ]
    }
  ],
  "topic_associations": [
    {
      "topic1": "Economy",
      "topic2": "Jobs",
      "correlation": 0.78
    }
  ]
}
```

### Readability Analytics

**GET** `/api/analytics/readability`

Retrieve readability metrics and analysis.

#### Example Response
```json
{
  "overall_readability": {
    "flesch_kincaid": 11.8,
    "gunning_fog": 13.2,
    "coleman_liau": 10.9,
    "flesch_reading_ease": 52.3
  },
  "grade_distribution": {
    "elementary": 15,
    "middle_school": 45,
    "high_school": 78,
    "college": 12
  },
  "speaker_readability": [
    {
      "speaker": "Joe Biden",
      "avg_grade_level": 12.5,
      "segment_count": 98
    }
  ]
}
```

### Content Moderation Analytics

**GET** `/api/analytics/moderation`

Retrieve content moderation flags and safety metrics.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threshold` | float | No | Minimum flagging threshold (default: 0.5) |

#### Example Response
```json
{
  "total_flags": 25,
  "categories": {
    "harassment": 8,
    "hate": 2,
    "self_harm": 0,
    "sexual": 1,
    "violence": 5,
    "violence_graphic": 0
  },
  "flagged_segments": [
    {
      "segment_id": 12345,
      "video_id": 789,
      "category": "harassment",
      "score": 0.75,
      "content_preview": "This rhetoric is completely unacceptable..."
    }
  ],
  "trends": [
    {
      "date": "2024-01-01",
      "total_flags": 3
    }
  ]
}
```

---

## Upload & Import Endpoints

### Start HTML Import

**POST** `/api/upload/import-html`

Start the HTML transcript import process.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_dir` | string | No | Source directory path |
| `force_reimport` | boolean | No | Force reimport existing files |

#### Example Request
```bash
curl -X POST "http://localhost:8000/api/upload/import-html" \
  -d "source_dir=/data/transcripts" \
  -d "force_reimport=false"
```

#### Example Response
```json
{
  "message": "Import started successfully",
  "status": "running",
  "source_directory": "/data/transcripts"
}
```

### Get Import Status

**GET** `/api/upload/import-status`

Check the status of the current import process.

#### Example Response
```json
{
  "status": "running",
  "progress": {
    "total_files": 150,
    "processed_files": 75,
    "failed_files": 2,
    "current_file": "debate_2024_01_15.html",
    "percentage": 50.0
  },
  "started_at": "2024-01-15T20:00:00Z",
  "estimated_completion": "2024-01-15T20:30:00Z",
  "errors": [
    {
      "file": "corrupted_file.html",
      "error": "Invalid HTML structure"
    }
  ]
}
```

### Cancel Import

**POST** `/api/upload/import-cancel`

Cancel the current import process.

#### Example Response
```json
{
  "message": "Import cancelled successfully"
}
```

### Import Single File

**POST** `/api/upload/import-file`

Import a single HTML transcript file.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the HTML file |
| `force_reimport` | boolean | No | Force reimport if exists |

#### Example Response
```json
{
  "message": "File imported successfully",
  "file_path": "/data/transcripts/debate.html",
  "result": {
    "video_id": 789,
    "segments_created": 245,
    "speakers_found": 6,
    "topics_extracted": 12
  }
}
```

### Get Import Statistics

**GET** `/api/upload/import-stats`

Retrieve statistics about imported data.

#### Example Response
```json
{
  "total_videos": 150,
  "total_segments": 12450,
  "total_speakers": 89,
  "total_topics": 156,
  "recent_imports": [
    {
      "id": 789,
      "title": "Presidential Debate 2024",
      "filename": "debate_2024_01_15.html",
      "imported_at": "2024-01-15T20:00:00Z"
    }
  ]
}
```

### Clear All Data

**DELETE** `/api/upload/clear-data`

Clear all imported data from the database.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `confirm` | boolean | Yes | Confirmation flag |

#### Example Response
```json
{
  "message": "All data cleared successfully"
}
```

---

## Health Check

### API Health Check

**GET** `/health`

Check the health status of the API and its dependencies.

#### Example Response
```json
{
  "status": "healthy",
  "message": "All systems operational",
  "checks": {
    "database": "healthy",
    "meilisearch": "healthy",
    "ai_services": "healthy"
  },
  "version": "1.0.0",
  "uptime": 86400
}
```

---

## WebSocket Events

### Real-time Import Updates

Connect to `/ws/import-status` for real-time import progress updates.

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/import-status');

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Import progress:', data);
};
```

#### Message Format
```json
{
  "type": "import_progress",
  "data": {
    "total_files": 150,
    "processed_files": 75,
    "percentage": 50.0,
    "current_file": "debate.html"
  }
}
```

---

## Examples

### Complete Search Workflow

```bash
# 1. Get search suggestions
curl -X GET "http://localhost:8000/api/search/suggest?q=clim&limit=5"

# 2. Perform search
curl -X GET "http://localhost:8000/api/search/" \
  -G \
  -d "q=climate change" \
  -d "date_from=2024-01-01" \
  -d "page=1" \
  -d "page_size=10"

# 3. Export results
curl -X GET "http://localhost:8000/api/search/export" \
  -G \
  -d "q=climate change" \
  -d "format=csv" \
  --output results.csv
```

### Video Summary Generation

```bash
# 1. Check if video can be summarized
curl -X GET "http://localhost:8000/api/summarization/video/789/can-summarize"

# 2. Generate summary
curl -X POST "http://localhost:8000/api/summarization/video/789/summary" \
  -H "Content-Type: application/json" \
  -d '{
    "bullet_points": 4,
    "provider": "openai",
    "model": "gpt-3.5-turbo"
  }'

# 3. Search summaries
curl -X GET "http://localhost:8000/api/summarization/search?q=economic policy"
```

### Analytics Dashboard

```bash
# 1. Get dashboard overview
curl -X GET "http://localhost:8000/api/analytics/dashboard" \
  -G \
  -d "date_from=2024-01-01" \
  -d "date_to=2024-12-31"

# 2. Get sentiment analysis
curl -X GET "http://localhost:8000/api/analytics/sentiment" \
  -G \
  -d "speaker=Biden"

# 3. Get topic analytics
curl -X GET "http://localhost:8000/api/analytics/topics"
```

---

## SDK and Client Libraries

### Python SDK
```python
from political_transcripts import PoliticalTranscriptsAPI

client = PoliticalTranscriptsAPI(base_url="http://localhost:8000")

# Search transcripts
results = client.search("climate change", date_from="2024-01-01")

# Generate summary
summary = client.summarize_video(789, bullet_points=4)

# Get analytics
analytics = client.get_analytics(date_from="2024-01-01")
```

### JavaScript SDK
```javascript
import { PoliticalTranscriptsAPI } from 'political-transcripts-js';

const client = new PoliticalTranscriptsAPI({
  baseURL: 'http://localhost:8000'
});

// Search transcripts
const results = await client.search('climate change', {
  dateFrom: '2024-01-01'
});

// Generate summary
const summary = await client.summarizeVideo(789, {
  bulletPoints: 4
});
```

---

## Rate Limiting and Best Practices

### Rate Limits
- **Search**: 100 requests/minute
- **Summarization**: 10 requests/minute
- **Export**: 5 requests/minute

### Best Practices
1. **Pagination**: Use appropriate page sizes (25-50 for UI, 100 for bulk)
2. **Caching**: Cache search results and summaries when possible
3. **Error Handling**: Implement retry logic with exponential backoff
4. **Batch Operations**: Use batch endpoints for multiple operations
5. **Monitoring**: Monitor rate limit headers and adjust accordingly

### Error Handling Example
```python
import time
import requests
from requests.exceptions import RequestException

def api_call_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.get(url)
            if response.status_code == 429:  # Rate limited
                wait_time = int(response.headers.get('Retry-After', 60))
                time.sleep(wait_time)
                continue
            response.raise_for_status()
            return response.json()
        except RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

---

**For additional support or questions about the API, please refer to the main [README.md](README.md) or create an issue on GitHub.**