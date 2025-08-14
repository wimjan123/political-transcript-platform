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


# Enable foreign key constraints for SQLite (if used for testing)
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key constraints for SQLite"""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()