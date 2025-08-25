"""
Tests for the emotions ingest API endpoint
"""
import os
import pytest
from fastapi.testclient import TestClient
import json

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
def seed_segment(client):
    """Seed a test segment for emotions testing"""
    from backend.src.database import get_db_sync
    from backend.src.models import Video, TranscriptSegment, Speaker
    from datetime import date
    
    # Get synchronous database session for testing
    db = next(get_db_sync())
    
    try:
        # Create test video
        video = Video(
            id=1,
            title="Test Video for Emotions",
            filename="test_emotions.html",
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
                id=123,  # Specific ID for testing
                segment_id="seg_123",
                video_id=1,
                speaker_id=1,
                speaker_name="Test Speaker",
                transcript_text="This segment will get emotion annotations.",
                video_seconds=10,
                word_count=7,
                char_count=44
            ),
            TranscriptSegment(
                id=124,
                segment_id="seg_124", 
                video_id=1,
                speaker_id=1,
                speaker_name="Test Speaker",
                transcript_text="This is another segment for batch testing.",
                video_seconds=20,
                word_count=8,
                char_count=43
            ),
            TranscriptSegment(
                id=125,
                segment_id="seg_125",
                video_id=1,
                speaker_id=1,
                speaker_name="Test Speaker",
                transcript_text="Third segment for emotions testing.",
                video_seconds=30,
                word_count=6,
                char_count=34
            )
        ]
        
        for segment in segments:
            db.add(segment)
        
        db.commit()
        
        return [123, 124, 125]  # Return segment IDs
        
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def test_ingest_emotions_single_item(client, seed_segment):
    """Test ingesting emotions for a single segment"""
    segment_ids = seed_segment
    
    payload = {
        "items": [
            {
                "segment_id": segment_ids[0],
                "emotion_label": "Angry",
                "emotion_intensity": 82,
                "heat_score": 0.76,
                "heat_components": {"tox": 0.31, "neg": 0.62, "punc": 0.11}
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Check response structure
    assert "updated" in data
    assert "errors" in data
    assert "message" in data
    assert "status_code" in data
    
    # Check results
    assert data["updated"] == 1
    assert len(data["errors"]) == 0
    assert data["status_code"] == 200
    assert "Successfully updated" in data["message"]
    
    # Verify the segment was updated in the database
    segment_response = client.get(f"/api/segments/{segment_ids[0]}")
    assert segment_response.status_code == 200
    segment_data = segment_response.json()
    
    assert segment_data["emotion_label"] == "Angry"
    assert segment_data["emotion_intensity"] == 82
    assert segment_data["heat_score"] == 0.76
    assert segment_data["heat_components"] == {"tox": 0.31, "neg": 0.62, "punc": 0.11}


def test_ingest_emotions_batch(client, seed_segment):
    """Test batch emotions ingest"""
    segment_ids = seed_segment
    
    payload = {
        "items": [
            {
                "segment_id": segment_ids[0],
                "emotion_label": "Joy",
                "emotion_intensity": 75
            },
            {
                "segment_id": segment_ids[1],
                "emotion_label": "Sadness",
                "emotion_intensity": 60,
                "heat_score": 0.2
            },
            {
                "segment_id": segment_ids[2],
                "emotion_label": "Fear",
                "emotion_intensity": 90,
                "heat_score": 0.8,
                "heat_components": {"threat": 0.5, "uncertainty": 0.3}
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Should update all 3 segments
    assert data["updated"] == 3
    assert len(data["errors"]) == 0
    assert data["status_code"] == 200


def test_ingest_emotions_nonexistent_segment(client, seed_segment):
    """Test handling of nonexistent segment ID"""
    payload = {
        "items": [
            {
                "segment_id": 99999,  # Doesn't exist
                "emotion_label": "Angry",
                "emotion_intensity": 50
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    # Should return 400 since all items failed
    assert response.status_code == 400
    data = response.json()
    
    assert data["updated"] == 0
    assert len(data["errors"]) == 1
    assert data["errors"][0]["segment_id"] == 99999
    assert data["errors"][0]["error"] == "segment_not_found"
    assert "All items failed" in data["message"]


def test_ingest_emotions_partial_success(client, seed_segment):
    """Test partial success scenario"""
    segment_ids = seed_segment
    
    payload = {
        "items": [
            {
                "segment_id": segment_ids[0],  # Valid
                "emotion_label": "Happy",
                "emotion_intensity": 80
            },
            {
                "segment_id": 99999,  # Invalid
                "emotion_label": "Sad",
                "emotion_intensity": 70
            },
            {
                "segment_id": segment_ids[1],  # Valid
                "emotion_label": "Neutral",
                "emotion_intensity": 40
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    # Should return 207 (multi-status) for partial success
    assert response.status_code == 207
    data = response.json()
    
    assert data["updated"] == 2  # 2 successful updates
    assert len(data["errors"]) == 1  # 1 error
    assert data["errors"][0]["segment_id"] == 99999
    assert "Partially successful" in data["message"]


def test_ingest_emotions_validation_errors(client, seed_segment):
    """Test validation errors in request"""
    segment_ids = seed_segment
    
    # Test emotion_intensity out of range
    payload = {
        "items": [
            {
                "segment_id": segment_ids[0],
                "emotion_label": "Angry",
                "emotion_intensity": 150  # > 100, should fail validation
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    assert response.status_code == 422  # Validation error
    
    # Test heat_score out of range
    payload = {
        "items": [
            {
                "segment_id": segment_ids[0],
                "emotion_label": "Angry",
                "emotion_intensity": 80,
                "heat_score": 1.5  # > 1.0, should fail validation
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    assert response.status_code == 422  # Validation error


def test_ingest_emotions_empty_batch(client):
    """Test empty batch handling"""
    payload = {"items": []}
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    assert response.status_code == 422  # Validation error - min_items=1


def test_ingest_emotions_large_batch(client):
    """Test batch size limit"""
    # Create a batch that's too large (>10,000 items)
    large_batch = []
    for i in range(10001):
        large_batch.append({
            "segment_id": i,
            "emotion_label": "Test",
            "emotion_intensity": 50
        })
    
    payload = {"items": large_batch}
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    
    assert response.status_code == 400
    data = response.json()
    assert "exceeds maximum" in data["detail"]


def test_emotion_stats_endpoint(client, seed_segment):
    """Test the emotion statistics endpoint"""
    segment_ids = seed_segment
    
    # First, add some emotion data
    payload = {
        "items": [
            {
                "segment_id": segment_ids[0],
                "emotion_label": "Joy",
                "emotion_intensity": 75,
                "heat_score": 0.3
            },
            {
                "segment_id": segment_ids[1], 
                "emotion_label": "Anger",
                "emotion_intensity": 85,
                "heat_score": 0.7
            }
        ]
    }
    
    response = client.post(
        "/api/analytics/ingest-emotions",
        json=payload
    )
    assert response.status_code == 200
    
    # Now test the stats endpoint
    response = client.get("/api/analytics/emotion-stats")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "data" in data
    assert "message" in data
    assert "status_code" in data
    
    stats = data["data"]
    assert "total_segments_with_emotions" in stats
    assert "unique_emotion_labels" in stats
    assert "average_emotion_intensity" in stats
    assert "total_segments_with_heat_scores" in stats
    assert "average_heat_score" in stats
    
    # Should reflect our test data
    assert stats["total_segments_with_emotions"] == 2
    assert stats["unique_emotion_labels"] == 2  # Joy and Anger
    assert stats["total_segments_with_heat_scores"] == 2