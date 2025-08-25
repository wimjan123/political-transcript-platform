"""
Tests for the segments list API endpoint
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

# Set test environment before imports
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


def _patch_startup_for_tests():
    """Patch the startup to use SQLite for testing"""
    from backend.src import main as main_module
    from backend.src.database import Base, engine

    # Replace init_db with a no-op table creation for SQLite
    async def _init_db_sqlite_only():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    main_module.init_db = _init_db_sqlite_only
    return main_module


@pytest.fixture
def client():
    """Test client fixture"""
    main_module = _patch_startup_for_tests()
    return TestClient(main_module.app)


@pytest.fixture
def seed_data(client):
    """Seed test data for segments testing"""
    from backend.src.database import get_db_sync
    from backend.src.models import Video, TranscriptSegment, Speaker
    from datetime import datetime, date
    
    # Get synchronous database session for testing
    db = next(get_db_sync())
    
    try:
        # Create test video
        video = Video(
            id=1,
            title="Test Political Video",
            filename="test_video.html",
            date=date.today(),
            source="test_source",
            dataset="trump",
            source_type="html"
        )
        db.add(video)
        db.flush()
        
        # Create test speaker
        speaker = Speaker(
            id=1,
            name="Test Speaker",
            normalized_name="test speaker"
        )
        db.add(speaker)
        db.flush()
        
        # Create test segments
        segments = [
            TranscriptSegment(
                id=1,
                segment_id="seg_1",
                video_id=1,
                speaker_id=1,
                speaker_name="Test Speaker",
                transcript_text="This is the first test segment about immigration.",
                video_seconds=10,
                timestamp_start="00:00:10",
                timestamp_end="00:00:15",
                word_count=9,
                char_count=45,
                sentiment_loughran_score=0.2,
                sentiment_harvard_score=-0.1,
                sentiment_vader_score=0.0,
                emotion_label="Neutral",
                emotion_intensity=30,
                heat_score=0.3,
                heat_components={"tox": 0.1, "neg": 0.2}
            ),
            TranscriptSegment(
                id=2,
                segment_id="seg_2",
                video_id=1,
                speaker_id=1,
                speaker_name="Test Speaker",
                transcript_text="This is the second test segment about healthcare.",
                video_seconds=20,
                timestamp_start="00:00:20",
                timestamp_end="00:00:25",
                word_count=8,
                char_count=49,
                sentiment_loughran_score=-0.3,
                sentiment_harvard_score=0.1,
                sentiment_vader_score=-0.2,
                emotion_label="Concerned",
                emotion_intensity=65,
                heat_score=0.5,
                heat_components={"tox": 0.3, "neg": 0.2}
            ),
            TranscriptSegment(
                id=3,
                segment_id="seg_3",
                video_id=1,
                speaker_id=1,
                speaker_name="Different Speaker",
                transcript_text="Third segment from a different speaker.",
                video_seconds=30,
                timestamp_start="00:00:30",
                timestamp_end="00:00:35",
                word_count=6,
                char_count=38,
                sentiment_loughran_score=0.1,
                sentiment_harvard_score=0.0,
                sentiment_vader_score=0.1
            )
        ]
        
        for segment in segments:
            db.add(segment)
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def test_segments_list_basic(client, seed_data):
    """Test basic segments list functionality"""
    response = client.get("/api/segments/?page=1&page_size=10")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check response structure
    assert "data" in data
    assert "pagination" in data
    assert "message" in data
    assert "status_code" in data
    
    # Check pagination metadata
    pagination = data["pagination"]
    assert pagination["page"] == 1
    assert pagination["page_size"] == 10
    assert pagination["total"] == 3  # We seeded 3 segments
    assert pagination["total_pages"] == 1
    assert "has_next" in pagination
    assert "has_prev" in pagination
    
    # Check data
    segments = data["data"]
    assert len(segments) == 3
    
    # Check first segment structure
    first_segment = segments[0]
    assert "id" in first_segment
    assert "video_id" in first_segment
    assert "segment_id" in first_segment
    assert "speaker_name" in first_segment
    assert "transcript_text" in first_segment
    assert "emotion_label" in first_segment
    assert "emotion_intensity" in first_segment
    assert "heat_score" in first_segment
    assert "heat_components" in first_segment


def test_segments_list_pagination(client, seed_data):
    """Test pagination with small page size"""
    response = client.get("/api/segments/?page=1&page_size=2")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should get 2 results on first page
    assert len(data["data"]) == 2
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["page_size"] == 2
    assert data["pagination"]["total"] == 3
    assert data["pagination"]["total_pages"] == 2
    assert data["pagination"]["has_next"] == True
    assert data["pagination"]["has_prev"] == False
    
    # Test second page
    response = client.get("/api/segments/?page=2&page_size=2")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["data"]) == 1  # Only 1 segment on second page
    assert data["pagination"]["page"] == 2
    assert data["pagination"]["has_next"] == False
    assert data["pagination"]["has_prev"] == True


def test_segments_list_filter_by_speaker(client, seed_data):
    """Test filtering by speaker name"""
    response = client.get("/api/segments/?speaker=Different")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should find 1 segment from "Different Speaker"
    assert len(data["data"]) == 1
    assert data["pagination"]["total"] == 1
    assert data["data"][0]["speaker_name"] == "Different Speaker"


def test_segments_list_filter_by_video_id(client, seed_data):
    """Test filtering by video ID"""
    response = client.get("/api/segments/?video_id=1")
    
    assert response.status_code == 200
    data = response.json()
    
    # All 3 segments belong to video_id=1
    assert len(data["data"]) == 3
    assert data["pagination"]["total"] == 3
    for segment in data["data"]:
        assert segment["video_id"] == 1


def test_segments_list_text_search(client, seed_data):
    """Test text search functionality"""
    response = client.get("/api/segments/?q=immigration")
    
    assert response.status_code == 200
    data = response.json()
    
    # Should find 1 segment containing "immigration"
    assert len(data["data"]) == 1
    assert data["pagination"]["total"] == 1
    assert "immigration" in data["data"][0]["transcript_text"].lower()


def test_segments_list_emotion_fields(client, seed_data):
    """Test that emotion fields are properly included"""
    response = client.get("/api/segments/?page=1&page_size=1")
    
    assert response.status_code == 200
    data = response.json()
    
    segment = data["data"][0]
    
    # Check emotion fields are present
    assert segment["emotion_label"] == "Neutral"
    assert segment["emotion_intensity"] == 30
    assert segment["heat_score"] == 0.3
    assert segment["heat_components"] == {"tox": 0.1, "neg": 0.2}


def test_segments_list_invalid_page(client, seed_data):
    """Test invalid page parameters"""
    # Page must be >= 1
    response = client.get("/api/segments/?page=0")
    assert response.status_code == 422  # Validation error
    
    # Page size must be <= 100
    response = client.get("/api/segments/?page_size=101")
    assert response.status_code == 422  # Validation error


def test_segments_list_empty_results(client):
    """Test response with no segments in database"""
    response = client.get("/api/segments/?page=1&page_size=10")
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["data"]) == 0
    assert data["pagination"]["total"] == 0
    assert data["pagination"]["total_pages"] == 0
    assert data["message"] == "Success"
    assert data["status_code"] == 200