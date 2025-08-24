"""
Database configuration and initialization
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
from sqlalchemy.engine import Engine
import sqlite3

from .config import settings


# Create async engine
engine = create_async_engine(
    settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_recycle=300,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


async def get_db() -> AsyncSession:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables"""
    from . import models  # Import models to register them
    from sqlalchemy import text
    
    async with engine.begin() as conn:
        # Ensure only one process performs DDL at startup (multiple Uvicorn workers)
        lock_key = 91540531  # arbitrary unique integer for advisory lock
        try:
            result = await conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_key})
            got_lock = bool(result.scalar())
        except Exception:
            # If not Postgres (e.g., SQLite in tests), skip locking
            got_lock = True

        if got_lock:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
        
            # Enable full-text search extensions (these should already exist from init.sql)
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
            except Exception as e:
                print(f"Extensions might already exist: {e}")
            
            # Create full-text search indexes
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS transcript_text_fts_idx 
                ON transcript_segments 
                USING gin(to_tsvector('english', transcript_text))
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS transcript_text_trigram_idx 
                ON transcript_segments 
                USING gin(transcript_text gin_trgm_ops)
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS speaker_name_idx 
                ON transcript_segments 
                USING gin(speaker_name gin_trgm_ops)
            """))

            # Trigram indexes to speed up ILIKE filters on video metadata and topics
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS video_source_trgm_idx
                ON videos
                USING gin(source gin_trgm_ops)
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS video_format_trgm_idx
                ON videos
                USING gin(format gin_trgm_ops)
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS video_candidate_trgm_idx
                ON videos
                USING gin(candidate gin_trgm_ops)
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS video_place_trgm_idx
                ON videos
                USING gin(place gin_trgm_ops)
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS video_record_type_trgm_idx
                ON videos
                USING gin(record_type gin_trgm_ops)
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS topic_name_trgm_idx
                ON topics
                USING gin(name gin_trgm_ops)
            """))

            # Release advisory lock
            try:
                await conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_key})
            except Exception:
                pass


def get_db_engine():
    """Get synchronous database engine for scripts"""
    from sqlalchemy import create_engine
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    return create_engine(sync_url)


# Enable foreign key constraints for SQLite (if used for testing)
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key constraints for SQLite"""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
